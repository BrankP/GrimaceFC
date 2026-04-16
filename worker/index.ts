export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });

const error = (message: string, status = 400) => json({ error: message }, status);

const nowIso = () => new Date().toISOString();
const createId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

const lineupFromRow = (row: Record<string, unknown>) => ({
  id: String(row.id),
  eventId: String(row.event_id),
  formation: String(row.formation),
  positions: JSON.parse(String(row.positions_json)),
  subs: JSON.parse(String(row.subs_json)),
  notAvailable: JSON.parse(String(row.not_available_json)),
  updatedAt: String(row.updated_at),
});

async function handleApi(request: Request, env: Env) {
  const { pathname, searchParams } = new URL(request.url);
  const method = request.method;

  if (method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  try {
    if (pathname === '/api/events' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM events ORDER BY date ASC').all();
      return json(
        results.map((row) => ({
          id: row.id,
          eventType: row.event_type,
          date: row.date,
          dayOfWeek: row.day_of_week,
          homeAway: row.home_away,
          duties: row.duties,
          location: row.location,
          opponent: row.opponent,
          occasion: row.occasion,
          teamName: row.team_name,
          isNextUp: Boolean(row.is_next_up),
        })),
      );
    }

    if (pathname === '/api/next-game' && method === 'GET') {
      const row = await env.DB.prepare("SELECT * FROM events WHERE event_type = 'Game' ORDER BY date ASC LIMIT 1").first();
      if (!row) return json(null);
      return json({
        id: row.id,
        eventType: row.event_type,
        date: row.date,
        dayOfWeek: row.day_of_week,
        homeAway: row.home_away,
        duties: row.duties,
        location: row.location,
        opponent: row.opponent,
        occasion: row.occasion,
        teamName: row.team_name,
        isNextUp: Boolean(row.is_next_up),
      });
    }

    if (pathname === '/api/users' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM users ORDER BY created_at ASC').all();
      return json(
        results.map((row) => ({
          id: row.id,
          name: row.name,
          nickname: row.nickname,
          createdYear: row.created_year,
          createdAt: row.created_at,
        })),
      );
    }

    if (pathname === '/api/messages' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM messages ORDER BY created_at ASC').all();
      return json(results.map((row) => ({ id: row.id, userId: row.user_id, text: row.text, createdAt: row.created_at })));
    }

    if (pathname === '/api/messages' && method === 'POST') {
      const body = (await request.json()) as { userId?: string; text?: string };
      if (!body.userId || !body.text?.trim()) return error('userId and text are required');
      const id = createId('msg');
      const createdAt = nowIso();

      await env.DB.prepare('INSERT INTO messages (id, user_id, text, created_at) VALUES (?1, ?2, ?3, ?4)')
        .bind(id, body.userId, body.text.trim(), createdAt)
        .run();

      return json({ id, userId: body.userId, text: body.text.trim(), createdAt }, 201);
    }

    if (pathname === '/api/fines' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM fines ORDER BY submitted_at DESC').all();
      return json(
        results.map((row) => ({
          id: row.id,
          whoUserId: row.who_user_id,
          amount: Number(row.amount),
          reason: row.reason,
          submittedByUserId: row.submitted_by_user_id,
          submittedAt: row.submitted_at,
        })),
      );
    }

    if (pathname === '/api/fines' && method === 'POST') {
      const body = (await request.json()) as {
        whoUserId?: string;
        amount?: number;
        reason?: string;
        submittedByUserId?: string;
      };
      if (!body.whoUserId || !body.submittedByUserId || !body.reason?.trim() || typeof body.amount !== 'number') {
        return error('whoUserId, amount, reason, submittedByUserId are required');
      }
      const id = createId('fine');
      const submittedAt = nowIso();

      await env.DB.prepare(
        'INSERT INTO fines (id, who_user_id, amount, reason, submitted_by_user_id, submitted_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
      )
        .bind(id, body.whoUserId, body.amount, body.reason.trim(), body.submittedByUserId, submittedAt, submittedAt)
        .run();

      return json(
        {
          id,
          whoUserId: body.whoUserId,
          amount: body.amount,
          reason: body.reason.trim(),
          submittedByUserId: body.submittedByUserId,
          submittedAt,
        },
        201,
      );
    }

    if (pathname === '/api/lineup' && method === 'GET') {
      const eventId = searchParams.get('eventId');
      if (!eventId) return error('eventId is required');
      const row = await env.DB.prepare('SELECT * FROM lineups WHERE event_id = ?1 LIMIT 1').bind(eventId).first();
      return json(row ? lineupFromRow(row as Record<string, unknown>) : null);
    }

    if (pathname === '/api/lineup' && method === 'POST') {
      const body = (await request.json()) as {
        id?: string;
        eventId?: string;
        formation?: string;
        positions?: Record<string, string | null>;
        subs?: string[];
        notAvailable?: string[];
      };
      if (!body.eventId || !body.formation || !body.positions || !body.subs || !body.notAvailable) {
        return error('eventId, formation, positions, subs, notAvailable are required');
      }
      const id = body.id || createId('lineup');
      const updatedAt = nowIso();

      await env.DB.prepare(
        'INSERT INTO lineups (id, event_id, formation, positions_json, subs_json, not_available_json, updated_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) ON CONFLICT(id) DO UPDATE SET event_id=excluded.event_id, formation=excluded.formation, positions_json=excluded.positions_json, subs_json=excluded.subs_json, not_available_json=excluded.not_available_json, updated_at=excluded.updated_at',
      )
        .bind(id, body.eventId, body.formation, JSON.stringify(body.positions), JSON.stringify(body.subs), JSON.stringify(body.notAvailable), updatedAt, updatedAt)
        .run();

      return json({ id, eventId: body.eventId, formation: body.formation, positions: body.positions, subs: body.subs, notAvailable: body.notAvailable, updatedAt }, 201);
    }

    if (pathname === '/api/availability' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM availability ORDER BY updated_at DESC').all();
      return json(results.map((row) => ({ id: row.id, eventId: row.event_id, userId: row.user_id, status: row.status, updatedAt: row.updated_at })));
    }

    if (pathname === '/api/availability' && method === 'POST') {
      const body = (await request.json()) as { eventId?: string; userId?: string; status?: 'available' | 'not_available' };
      if (!body.eventId || !body.userId || !body.status) return error('eventId, userId, status are required');
      if (!['available', 'not_available'].includes(body.status)) return error('status must be available or not_available');

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

      return json({ id, eventId: body.eventId, userId: body.userId, status: body.status, updatedAt }, 201);
    }

    if (pathname === '/api/users/upsert' && method === 'POST') {
      const body = (await request.json()) as { id?: string; name?: string; nickname?: string | null; createdYear?: number };
      if (!body.name?.trim()) return error('name is required');
      const normalized = body.name.trim();

      const byName = await env.DB.prepare('SELECT * FROM users WHERE lower(name) = lower(?1) LIMIT 1').bind(normalized).first();
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

      return json({ id, name: normalized, nickname, createdYear, createdAt }, 201);
    }

    return error('Not found', 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    return error(message, 500);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/')) {
      return handleApi(request, env);
    }

    return env.ASSETS.fetch(request);
  },
};
