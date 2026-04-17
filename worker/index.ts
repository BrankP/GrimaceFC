export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  TEAM_PASSCODE?: string;
}

type RateEntry = { count: number; resetAt: number };
const rateStore = new Map<string, RateEntry>();

const RATE_WINDOW_MS = 60_000;
const READ_LIMIT = 60;
const WRITE_LIMIT = 20;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,x-team-passcode',
};

const jsonResponse = (data: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders, ...extraHeaders },
  });

const errorResponse = (message: string, status = 400, extraHeaders: Record<string, string> = {}) =>
  jsonResponse({ error: message }, status, extraHeaders);

const getClientIp = (request: Request) => request.headers.get('CF-Connecting-IP') ?? 'unknown';

// In-memory limiter (simple protection). Limitation: this is isolate-local and not globally durable across Worker instances.
// Keep API shape simple so it can be swapped with KV or Durable Objects later.
const rateLimit = (request: Request) => {
  const ip = getClientIp(request);
  const method = request.method.toUpperCase();
  const isRead = method === 'GET' || method === 'HEAD' || method === 'OPTIONS';
  const limit = isRead ? READ_LIMIT : WRITE_LIMIT;
  const now = Date.now();
  const bucket = `${ip}:${isRead ? 'read' : 'write'}`;

  const current = rateStore.get(bucket);
  if (!current || now >= current.resetAt) {
    rateStore.set(bucket, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return { allowed: true, retryAfter: 0 };
  }

  if (current.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    return { allowed: false, retryAfter: retryAfterSeconds };
  }

  current.count += 1;
  rateStore.set(bucket, current);
  return { allowed: true, retryAfter: 0 };
};

const isWriteMethod = (method: string) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase());

const requireTeamPasscode = (request: Request, env: Env) => {
  if (!isWriteMethod(request.method)) return null;
  const configuredPasscode = env.TEAM_PASSCODE ?? 'nah';
  const provided = request.headers.get('x-team-passcode');
  if (!provided) return errorResponse('x-team-passcode header is required', 401);
  if (provided !== configuredPasscode) return errorResponse('Invalid team passcode', 403);
  return null;
};

const cacheHeadersFor = (pathname: string) => {
  if (pathname === '/api/events' || pathname === '/api/next-game') return { 'Cache-Control': 'public, max-age=60' };
  if (pathname === '/api/messages' || pathname === '/api/fines') {
    return { 'Cache-Control': 'public, max-age=20' };
  }
  if (pathname === '/api/lineup') return { 'Cache-Control': 'no-store' };
  return { 'Cache-Control': 'no-store' };
};

const nowIso = () => new Date().toISOString();
const createId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nickname TEXT,
    created_year INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL CHECK(event_type IN ('Game','Sesh')),
    date TEXT NOT NULL,
    day_of_week TEXT NOT NULL,
    home_away TEXT,
    beer_duty_user_id TEXT,
    ref_duty_user_id TEXT,
    location TEXT NOT NULL,
    opponent TEXT,
    occasion TEXT,
    team_name TEXT NOT NULL,
    is_next_up INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(beer_duty_user_id) REFERENCES users(id),
    FOREIGN KEY(ref_duty_user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS fines (
    id TEXT PRIMARY KEY,
    who_user_id TEXT NOT NULL,
    amount REAL NOT NULL,
    reason TEXT NOT NULL,
    submitted_by_user_id TEXT NOT NULL,
    submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(who_user_id) REFERENCES users(id),
    FOREIGN KEY(submitted_by_user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS lineups (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    formation TEXT NOT NULL,
    positions_json TEXT NOT NULL,
    subs_json TEXT NOT NULL,
    not_available_json TEXT NOT NULL,
    beer_duty_user_id TEXT,
    ref_duty_user_id TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(event_id) REFERENCES events(id),
    FOREIGN KEY(beer_duty_user_id) REFERENCES users(id),
    FOREIGN KEY(ref_duty_user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS availability (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('available','not_available')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(event_id, user_id),
    FOREIGN KEY(event_id) REFERENCES events(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`,
  'CREATE INDEX IF NOT EXISTS idx_events_date ON events(date)',
  'CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_availability_event_user ON availability(event_id, user_id)',
] as const;

let schemaInitPromise: Promise<void> | null = null;

const ensureEventDutyColumns = async (env: Env) => {
  const columnsResult = await env.DB.prepare('PRAGMA table_info(events)').all<{ name: string }>();
  const existingColumns = new Set(columnsResult.results.map((column) => String(column.name)));

  if (!existingColumns.has('beer_duty_user_id')) {
    await env.DB.prepare('ALTER TABLE events ADD COLUMN beer_duty_user_id TEXT').run();
  }
  if (!existingColumns.has('ref_duty_user_id')) {
    await env.DB.prepare('ALTER TABLE events ADD COLUMN ref_duty_user_id TEXT').run();
  }
};

const ensureLineupDutyColumns = async (env: Env) => {
  const columnsResult = await env.DB.prepare('PRAGMA table_info(lineups)').all<{ name: string }>();
  const existingColumns = new Set(columnsResult.results.map((column) => String(column.name)));

  if (!existingColumns.has('beer_duty_user_id')) {
    await env.DB.prepare('ALTER TABLE lineups ADD COLUMN beer_duty_user_id TEXT').run();
  }
  if (!existingColumns.has('ref_duty_user_id')) {
    await env.DB.prepare('ALTER TABLE lineups ADD COLUMN ref_duty_user_id TEXT').run();
  }
};

const ensureDefaultDutyAssignments = async (env: Env) => {
  const users = await env.DB.prepare('SELECT id FROM users ORDER BY created_at ASC LIMIT 50').all<{ id: string }>();
  const userIds = users.results.map((user) => String(user.id));
  if (userIds.length === 0) return;

  const events = await env.DB.prepare(
    "SELECT id, home_away, beer_duty_user_id, ref_duty_user_id FROM events WHERE event_type = 'Game' ORDER BY date ASC LIMIT 100",
  ).all<{ id: string; home_away: string | null; beer_duty_user_id: string | null; ref_duty_user_id: string | null }>();

  let idx = 0;
  for (const event of events.results) {
    const beerDutyUserId = event.beer_duty_user_id ?? userIds[idx % userIds.length];
    const refDutyUserId = event.home_away === 'Away' ? event.ref_duty_user_id ?? userIds[(idx + 1) % userIds.length] ?? beerDutyUserId : null;
    idx += 1;

    await env.DB.prepare('UPDATE events SET beer_duty_user_id = ?1, ref_duty_user_id = ?2 WHERE id = ?3')
      .bind(beerDutyUserId, refDutyUserId, event.id)
      .run();
  }
};

const ensureSchema = async (env: Env) => {
  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      for (const statement of schemaStatements) {
        await env.DB.prepare(statement).run();
      }
      await ensureEventDutyColumns(env);
      await ensureLineupDutyColumns(env);
      await ensureDefaultDutyAssignments(env);
    })();
  }
  await schemaInitPromise;
};

const lineupFromRow = (row: Record<string, unknown>) => ({
  id: String(row.id),
  eventId: String(row.event_id),
  formation: String(row.formation),
  positions: JSON.parse(String(row.positions_json)),
  subs: JSON.parse(String(row.subs_json)),
  notAvailable: JSON.parse(String(row.not_available_json)),
  beerDutyUserId: row.beer_duty_user_id ? String(row.beer_duty_user_id) : null,
  refDutyUserId: row.ref_duty_user_id ? String(row.ref_duty_user_id) : null,
  updatedAt: String(row.updated_at),
});

async function handleApi(request: Request, env: Env) {
  const url = new URL(request.url);
  const { pathname, searchParams } = url;
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const limitResult = rateLimit(request);
  if (!limitResult.allowed) {
    return errorResponse('Rate limit exceeded', 429, { 'Retry-After': String(limitResult.retryAfter), 'Cache-Control': 'no-store' });
  }

  const passcodeError = requireTeamPasscode(request, env);
  if (passcodeError) return passcodeError;

  try {
    if (pathname === '/api/events' && method === 'GET') {
      const { results } = await env.DB.prepare(
        'SELECT id, event_type, date, day_of_week, home_away, beer_duty_user_id, ref_duty_user_id, location, opponent, occasion, team_name, is_next_up FROM events ORDER BY date ASC LIMIT 50',
      ).all();

      return jsonResponse(
        results.map((row) => ({
          id: row.id,
          eventType: row.event_type,
          date: row.date,
          dayOfWeek: row.day_of_week,
          homeAway: row.home_away,
          beerDutyUserId: row.beer_duty_user_id,
          refDutyUserId: row.ref_duty_user_id,
          location: row.location,
          opponent: row.opponent,
          occasion: row.occasion,
          teamName: row.team_name,
          isNextUp: Boolean(row.is_next_up),
        })),
        200,
        cacheHeadersFor(pathname),
      );
    }

    if (pathname === '/api/next-game' && method === 'GET') {
      const row = await env.DB.prepare(
        "SELECT id, event_type, date, day_of_week, home_away, beer_duty_user_id, ref_duty_user_id, location, opponent, occasion, team_name, is_next_up FROM events WHERE event_type = 'Game' ORDER BY date ASC LIMIT 1",
      ).first();
      if (!row) return jsonResponse(null, 200, cacheHeadersFor(pathname));
      return jsonResponse(
        {
          id: row.id,
          eventType: row.event_type,
          date: row.date,
          dayOfWeek: row.day_of_week,
          homeAway: row.home_away,
          beerDutyUserId: row.beer_duty_user_id,
          refDutyUserId: row.ref_duty_user_id,
          location: row.location,
          opponent: row.opponent,
          occasion: row.occasion,
          teamName: row.team_name,
          isNextUp: Boolean(row.is_next_up),
        },
        200,
        cacheHeadersFor(pathname),
      );
    }

    if (pathname === '/api/users' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT id, name, nickname, created_year, created_at FROM users ORDER BY created_at ASC LIMIT 50').all();
      return jsonResponse(
        results.map((row) => ({ id: row.id, name: row.name, nickname: row.nickname, createdYear: row.created_year, createdAt: row.created_at })),
      );
    }

    if (pathname === '/api/messages' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT id, user_id, text, created_at FROM messages ORDER BY created_at DESC LIMIT 50').all();
      return jsonResponse(
        results
          .reverse()
          .map((row) => ({ id: row.id, userId: row.user_id, text: row.text, createdAt: row.created_at })),
        200,
        cacheHeadersFor(pathname),
      );
    }

    if (pathname === '/api/messages' && method === 'POST') {
      const body = (await request.json()) as { userId?: string; text?: string };
      if (!body.userId || !body.text?.trim()) return errorResponse('userId and text are required');
      const id = createId('msg');
      const createdAt = nowIso();

      await env.DB.prepare('INSERT INTO messages (id, user_id, text, created_at) VALUES (?1, ?2, ?3, ?4)')
        .bind(id, body.userId, body.text.trim(), createdAt)
        .run();

      return jsonResponse({ id, userId: body.userId, text: body.text.trim(), createdAt }, 201, { 'Cache-Control': 'no-store' });
    }

    if (pathname === '/api/fines' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT id, who_user_id, amount, reason, submitted_by_user_id, submitted_at FROM fines ORDER BY submitted_at DESC LIMIT 50').all();
      return jsonResponse(
        results.map((row) => ({
          id: row.id,
          whoUserId: row.who_user_id,
          amount: Number(row.amount),
          reason: row.reason,
          submittedByUserId: row.submitted_by_user_id,
          submittedAt: row.submitted_at,
        })),
        200,
        cacheHeadersFor(pathname),
      );
    }

    if (pathname === '/api/fines' && method === 'POST') {
      const body = (await request.json()) as { whoUserId?: string; amount?: number; reason?: string; submittedByUserId?: string };
      if (!body.whoUserId || !body.submittedByUserId || !body.reason?.trim() || typeof body.amount !== 'number') {
        return errorResponse('whoUserId, amount, reason, submittedByUserId are required');
      }
      const id = createId('fine');
      const submittedAt = nowIso();

      await env.DB.prepare(
        'INSERT INTO fines (id, who_user_id, amount, reason, submitted_by_user_id, submitted_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
      )
        .bind(id, body.whoUserId, body.amount, body.reason.trim(), body.submittedByUserId, submittedAt, submittedAt)
        .run();

      return jsonResponse({ id, whoUserId: body.whoUserId, amount: body.amount, reason: body.reason.trim(), submittedByUserId: body.submittedByUserId, submittedAt }, 201, {
        'Cache-Control': 'no-store',
      });
    }

    if (pathname === '/api/lineup' && method === 'GET') {
      const eventId = searchParams.get('eventId');
      if (!eventId) return errorResponse('eventId is required');
      const row = await env.DB.prepare(
        'SELECT id, event_id, formation, positions_json, subs_json, not_available_json, beer_duty_user_id, ref_duty_user_id, updated_at FROM lineups WHERE event_id = ?1 LIMIT 1',
      )
        .bind(eventId)
        .first();
      return jsonResponse(row ? lineupFromRow(row as Record<string, unknown>) : null, 200, cacheHeadersFor(pathname));
    }

    if (pathname === '/api/lineup' && method === 'POST') {
      const body = (await request.json()) as {
        id?: string;
        eventId?: string;
        formation?: string;
        positions?: Record<string, string | null>;
        subs?: string[];
        notAvailable?: string[];
        beerDutyUserId?: string | null;
        refDutyUserId?: string | null;
      };
      if (!body.eventId || !body.formation || !body.positions || !body.subs || !body.notAvailable) {
        return errorResponse('eventId, formation, positions, subs, notAvailable are required');
      }

      const existing = await env.DB.prepare('SELECT id FROM lineups WHERE event_id = ?1 LIMIT 1').bind(body.eventId).first<{ id: string }>();
      const id = body.id || existing?.id || createId('lineup');
      const updatedAt = nowIso();

      await env.DB.prepare(
        'INSERT INTO lineups (id, event_id, formation, positions_json, subs_json, not_available_json, beer_duty_user_id, ref_duty_user_id, updated_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10) ON CONFLICT(id) DO UPDATE SET event_id=excluded.event_id, formation=excluded.formation, positions_json=excluded.positions_json, subs_json=excluded.subs_json, not_available_json=excluded.not_available_json, beer_duty_user_id=excluded.beer_duty_user_id, ref_duty_user_id=excluded.ref_duty_user_id, updated_at=excluded.updated_at',
      )
        .bind(
          id,
          body.eventId,
          body.formation,
          JSON.stringify(body.positions),
          JSON.stringify(body.subs),
          JSON.stringify(body.notAvailable),
          body.beerDutyUserId ?? null,
          body.refDutyUserId ?? null,
          updatedAt,
          updatedAt,
        )
        .run();

      return jsonResponse(
        {
          id,
          eventId: body.eventId,
          formation: body.formation,
          positions: body.positions,
          subs: body.subs,
          notAvailable: body.notAvailable,
          beerDutyUserId: body.beerDutyUserId ?? null,
          refDutyUserId: body.refDutyUserId ?? null,
          updatedAt,
        },
        201,
        { 'Cache-Control': 'no-store' },
      );
    }

    if (pathname === '/api/availability' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT id, event_id, user_id, status, updated_at FROM availability ORDER BY updated_at DESC LIMIT 500').all();
      return jsonResponse(results.map((row) => ({ id: row.id, eventId: row.event_id, userId: row.user_id, status: row.status, updatedAt: row.updated_at })));
    }

    if (pathname === '/api/availability' && method === 'POST') {
      const body = (await request.json()) as { eventId?: string; userId?: string; status?: 'available' | 'not_available' };
      if (!body.eventId || !body.userId || !body.status) return errorResponse('eventId, userId, status are required');
      if (!['available', 'not_available'].includes(body.status)) return errorResponse('status must be available or not_available');

      const existing = await env.DB.prepare('SELECT id FROM availability WHERE event_id = ?1 AND user_id = ?2 LIMIT 1')
        .bind(body.eventId, body.userId)
        .first<{ id: string }>();
      const id = existing?.id ?? createId('avail');
      const updatedAt = nowIso();

      await env.DB.prepare(
        'INSERT INTO availability (id, event_id, user_id, status, updated_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6) ON CONFLICT(event_id, user_id) DO UPDATE SET id=excluded.id, status=excluded.status, updated_at=excluded.updated_at',
      )
        .bind(id, body.eventId, body.userId, body.status, updatedAt, updatedAt)
        .run();

      return jsonResponse({ id, eventId: body.eventId, userId: body.userId, status: body.status, updatedAt }, 201, { 'Cache-Control': 'no-store' });
    }

    if (pathname === '/api/users/upsert' && method === 'POST') {
      const body = (await request.json()) as { id?: string; name?: string; nickname?: string | null; createdYear?: number };
      if (!body.name?.trim()) return errorResponse('name is required');
      const normalized = body.name.trim();

      const byName = await env.DB.prepare('SELECT id, created_year, created_at, nickname FROM users WHERE lower(name) = lower(?1) LIMIT 1')
        .bind(normalized)
        .first();
      const id = body.id || (byName?.id as string | undefined) || createId('usr');
      const createdAt = (byName?.created_at as string | undefined) ?? nowIso();
      const createdYear = Number(body.createdYear ?? byName?.created_year ?? new Date().getFullYear());
      const nickname = body.nickname ?? (byName?.nickname as string | null) ?? null;

      await env.DB.prepare(
        'INSERT INTO users (id, name, nickname, created_year, created_at) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(id) DO UPDATE SET name=excluded.name, nickname=excluded.nickname',
      )
        .bind(id, normalized, nickname, createdYear, createdAt)
        .run();

      await env.DB.prepare(
        "INSERT INTO availability (id, event_id, user_id, status, updated_at, created_at) SELECT ?1 || '-' || events.id, events.id, ?2, 'not_available', ?3, ?4 FROM events WHERE NOT EXISTS (SELECT 1 FROM availability WHERE availability.event_id = events.id AND availability.user_id = ?2)",
      )
        .bind(id, id, nowIso(), createdAt)
        .run();

      return jsonResponse({ id, name: normalized, nickname, createdYear, createdAt }, 201, { 'Cache-Control': 'no-store' });
    }

    return errorResponse('Not found', 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    return errorResponse(message, 500, { 'Cache-Control': 'no-store' });
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      await ensureSchema(env);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize database schema';
      return errorResponse(message, 500, { 'Cache-Control': 'no-store' });
    }

    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env);
    return env.ASSETS.fetch(request);
  },
};
