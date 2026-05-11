export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  ADMIN_PASSCODE?: string;
  VIEW_PASSCODE?: string;
  TEAM_PASSCODE?: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

type RateEntry = { count: number; resetAt: number };
type WebPushSubscription = {
  endpoint: string;
  expirationTime?: number | null;
  keys: {
    p256dh: string;
    auth: string;
  };
};
type PendingPushNotification = { title: string; body: string; url: string; tag?: string };
type PushSubscriptionMetadata = {
  userAgent?: string;
  deviceLabel?: string;
  standalone?: boolean;
  notificationPermission?: string;
};

const rateStore = new Map<string, RateEntry>();

const RATE_WINDOW_MS = 60_000;
const READ_LIMIT = 60;
const WRITE_LIMIT = 20;
const SYSTEM_USER_ID = 'grimace-bot';
const DRIBL_LADDER_URL = 'https://mc-api.dribl.com/api/ladders?date_range=default&season=bam17yAKwX&competition=2PmjO2ojNZ&league=nmYJEzqaNz&ladder_type=regular&tenant=kbam1QjmwX&require_pools=true';
const DRIBL_LADDER_PAGE_URL = 'https://mwfa.dribl.com/ladders/?competition=2PmjO2ojNZ&date_range=default&ladder_type=regular&league=nmYJEzqaNz&season=bam17yAKwX&timezone=Australia%2FSydney';
const OUR_LADDER_TEAM_NAME = 'Allambie Beacon Hill United FC AL 06 Mixed B';

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

const resolvePasscodeRole = (provided: string, env: Env): 'admin' | 'view' | null => {
  const adminPasscode = env.ADMIN_PASSCODE ?? 'adminadmin';
  const viewPasscode = env.VIEW_PASSCODE ?? env.TEAM_PASSCODE ?? 'upthegrimace';
  if (provided === adminPasscode) return 'admin';
  if (provided === viewPasscode) return 'view';
  return null;
};

const insertSystemMessage = async (env: Env, text: string, fallbackUserId?: string) => {
  await ensureGrimaceUser(env);
  try {
    await env.DB.prepare('INSERT INTO messages (id, user_id, text, created_at) VALUES (?1, ?2, ?3, ?4)')
      .bind(createId('msg'), SYSTEM_USER_ID, text, nowIso())
      .run();
  } catch (err) {
    if (!fallbackUserId) throw err;
    await env.DB.prepare('INSERT INTO messages (id, user_id, text, created_at) VALUES (?1, ?2, ?3, ?4)')
      .bind(createId('msg'), fallbackUserId, text, nowIso())
      .run();
  }
};

const getRefGameLabel = async (env: Env, eventId: string) => {
  const event = await env.DB.prepare('SELECT opponent, date FROM events WHERE id = ?1 LIMIT 1')
    .bind(eventId)
    .first<{ opponent: string | null; date: string | null }>();
  if (event?.opponent) return `the ${event.opponent} game`;
  if (event?.date) return `the away game on ${event.date.slice(0, 10)}`;
  return 'the away game';
};

const announceNextRefDecision = async (
  env: Env,
  payload: { decisionText: string; eventId: string; nextRefName?: string | null; fallbackUserId?: string },
) => {
  const gameLabel = await getRefGameLabel(env, payload.eventId);
  const nextDecisionText = payload.nextRefName
    ? ` @${payload.nextRefName}, it's your turn to decide for ${gameLabel}.`
    : '';
  await insertSystemMessage(env, `${payload.decisionText} for ${gameLabel}.${nextDecisionText}`, payload.fallbackUserId);
};


const maybePostAttendanceReminders = async (env: Env) => {
  const reminderDate = new Date().toISOString().slice(0, 10);
  const events = await env.DB.prepare(
    "SELECT id, event_type, opponent, occasion FROM events WHERE date(date) = date('now', '+2 day') ORDER BY date ASC LIMIT 20",
  ).all<{ id: string; event_type: 'Game' | 'Sesh'; opponent: string | null; occasion: string | null }>();

  for (const event of events.results) {
    const missing = await env.DB.prepare(
      'SELECT users.name AS name FROM users LEFT JOIN availability ON availability.user_id = users.id AND availability.event_id = ?1 WHERE availability.id IS NULL AND users.id != ?2 ORDER BY users.name ASC',
    )
      .bind(event.id, SYSTEM_USER_ID)
      .all<{ name: string }>();

    if (!missing.results.length) continue;

    const marker = `[attendance-reminder:${event.id}:${reminderDate}]`;
    const existing = await env.DB.prepare('SELECT id FROM messages WHERE text LIKE ?1 LIMIT 1')
      .bind(`%${marker}%`)
      .first<{ id: string }>();
    if (existing) continue;

    const subject = event.event_type === 'Game' ? `${event.opponent ?? 'upcoming game'}` : `${event.occasion ?? 'upcoming session'}`;
    const names = missing.results.map((row) => `@${row.name}`).join(', ');
    const text = `Shame corner: ${names} still haven't marked attendance for ${subject} (in 2 days). ${marker}`;

    await insertSystemMessage(env, text);
  }
};

const requireTeamPasscode = (request: Request, env: Env) => {
  if (!isWriteMethod(request.method)) return null;
  const provided = request.headers.get('x-team-passcode');
  if (!provided) return errorResponse('x-team-passcode header is required', 401);
  if (!resolvePasscodeRole(provided, env)) return errorResponse('Invalid team passcode', 403);
  return null;
};

const requireAdminPasscode = (request: Request, env: Env) => {
  const provided = request.headers.get('x-team-passcode');
  if (!provided) return errorResponse('x-team-passcode header is required', 401);
  if (resolvePasscodeRole(provided, env) !== 'admin') return errorResponse('Admin passcode required for lineup edits', 403);
  return null;
};

const cacheHeadersFor = (pathname: string) => {
  if (pathname === '/api/events' || pathname === '/api/next-game') return { 'Cache-Control': 'no-store' };
  if (pathname === '/api/next-ref' || pathname === '/api/next-ref/history') return { 'Cache-Control': 'no-store' };
  if (pathname === '/api/messages') {
    return { 'Cache-Control': 'public, max-age=20' };
  }
  if (pathname === '/api/lineup') return { 'Cache-Control': 'no-store' };
  return { 'Cache-Control': 'no-store' };
};

const nowIso = () => new Date().toISOString();
const normalizeNullableString = (value: unknown) => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text.length ? text : null;
};
const normalizeNumber = (value: unknown, fallback = 0) => {
  const normalized = Number(value ?? fallback);
  return Number.isFinite(normalized) ? normalized : fallback;
};
const createId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
const normalizeMentionName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

const pushLog = (event: string, details: Record<string, unknown> = {}) => {
  console.error(JSON.stringify({ event, at: nowIso(), ...details }));
};

const safeEndpointSummary = (endpoint: string) => {
  let host = 'invalid-endpoint';
  try {
    host = new URL(endpoint).host;
  } catch {
    // Keep the fallback host.
  }
  return {
    host,
    prefix: endpoint.slice(0, 32),
    length: endpoint.length,
  };
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const parseTaggedNamesFromCandidates = (text: string, candidateNames: string[]) => {
  const normalizedCandidates = Array.from(
    new Set(
      candidateNames
        .map((name) => normalizeMentionName(name))
        .filter((name) => Boolean(name)),
    ),
  ).sort((a, b) => b.length - a.length);

  if (!normalizedCandidates.length) return [];

  const matched = new Set<string>();
  for (const candidate of normalizedCandidates) {
    const pattern = new RegExp(`(^|[^A-Za-z0-9_])@${escapeRegExp(candidate)}(?=$|[^A-Za-z0-9_])`, 'i');
    if (pattern.test(text)) matched.add(candidate);
  }
  return Array.from(matched);
};

const getVapidConfig = (env: Env) => {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return null;
  return {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
    subject: env.VAPID_SUBJECT ?? 'mailto:admin@grimacefc.local',
  };
};

const toBase64Url = (input: ArrayBuffer | Uint8Array | string) => {
  const bytes = typeof input === 'string' ? Uint8Array.from(input, (ch) => ch.charCodeAt(0)) : input instanceof Uint8Array ? input : new Uint8Array(input);
  const binary = String.fromCharCode(...bytes);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
};

const base64UrlToUint8Array = (base64Url: string): Uint8Array => {
  const padded = `${base64Url}${'='.repeat((4 - (base64Url.length % 4)) % 4)}`;
  const base64 = padded.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
  return bytes;
};

const sanitizePushSubscription = (raw: unknown): WebPushSubscription | null => {
  if (!raw || typeof raw !== 'object') return null;
  const maybe = raw as Partial<WebPushSubscription>;
  if (!maybe.endpoint || typeof maybe.endpoint !== 'string') return null;
  if (!maybe.keys?.p256dh || !maybe.keys?.auth) return null;
  try {
    base64UrlToUint8Array(maybe.keys.p256dh);
    base64UrlToUint8Array(maybe.keys.auth);
  } catch {
    return null;
  }

  return {
    endpoint: maybe.endpoint,
    expirationTime: typeof maybe.expirationTime === 'number' ? maybe.expirationTime : null,
    keys: {
      p256dh: maybe.keys.p256dh,
      auth: maybe.keys.auth,
    },
  };
};

const derToJose = (der: Uint8Array, outputLength: number) => {
  if (der[0] !== 0x30) throw new Error('Invalid DER signature');

  let offset = 1;
  let seqLen = der[offset];
  offset += 1;
  if (seqLen & 0x80) {
    const lenBytes = seqLen & 0x7f;
    seqLen = 0;
    for (let idx = 0; idx < lenBytes; idx += 1) {
      seqLen = (seqLen << 8) | der[offset];
      offset += 1;
    }
  }

  if (offset + seqLen > der.length) throw new Error('Invalid DER signature length');

  if (der[offset] !== 0x02) throw new Error('Invalid DER signature');
  offset += 1;
  const rLength = der[offset];
  offset += 1;
  let r = der.slice(offset, offset + rLength);
  offset += rLength;

  if (der[offset] !== 0x02) throw new Error('Invalid DER signature');
  offset += 1;
  const sLength = der[offset];
  offset += 1;
  let s = der.slice(offset, offset + sLength);

  while (r.length > outputLength / 2 && r[0] === 0) r = r.slice(1);
  while (s.length > outputLength / 2 && s[0] === 0) s = s.slice(1);
  if (r.length > outputLength / 2 || s.length > outputLength / 2) throw new Error('Invalid DER signature component size');

  const rPadded = new Uint8Array(outputLength / 2);
  const sPadded = new Uint8Array(outputLength / 2);
  rPadded.set(r, outputLength / 2 - r.length);
  sPadded.set(s, outputLength / 2 - s.length);
  const combined = new Uint8Array(outputLength);
  combined.set(rPadded, 0);
  combined.set(sPadded, outputLength / 2);
  return toBase64Url(combined);
};

const ecdsaSignatureToJose = (signature: Uint8Array, outputLength: number) => {
  if (signature.length === outputLength) return toBase64Url(signature);
  return derToJose(signature, outputLength);
};

const createVapidJwt = async (env: Env, endpoint: string) => {
  const vapid = getVapidConfig(env);
  if (!vapid) return null;
  const audience = new URL(endpoint).origin;
  const header = { typ: 'JWT', alg: 'ES256' };
  const claims = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60,
    sub: vapid.subject,
  };
  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedClaims = toBase64Url(JSON.stringify(claims));
  const data = `${encodedHeader}.${encodedClaims}`;

  const publicBytes = base64UrlToUint8Array(vapid.publicKey);
  const privateBytes = base64UrlToUint8Array(vapid.privateKey);
  const x = toBase64Url(publicBytes.slice(1, 33));
  const y = toBase64Url(publicBytes.slice(33, 65));
  const d = toBase64Url(privateBytes);
  const signingKey = await crypto.subtle.importKey(
    'jwk',
    { kty: 'EC', crv: 'P-256', x, y, d, key_ops: ['sign'], ext: false },
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const signatureDer = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      signingKey,
      new TextEncoder().encode(data),
    ),
  );
  const signatureJose = ecdsaSignatureToJose(signatureDer, 64);
  return `${data}.${signatureJose}`;
};

const storePendingNotification = async (env: Env, endpoint: string, notification: PendingPushNotification) => {
  const now = nowIso();
  await env.DB.prepare(
    `INSERT INTO push_notification_queue (id, endpoint, payload_json, created_at)
     VALUES (?1, ?2, ?3, ?4)
     ON CONFLICT(endpoint) DO UPDATE SET payload_json=excluded.payload_json, created_at=excluded.created_at`,
  )
    .bind(createId('pushmsg'), endpoint, JSON.stringify(notification), now)
    .run();
};

const sendPushPing = async (env: Env, endpoint: string) => {
  const vapid = getVapidConfig(env);
  if (!vapid) return { ok: false, status: 0 };
  const jwt = await createVapidJwt(env, endpoint);
  if (!jwt) return { ok: false, status: 0 };
  const response = await fetch(endpoint, {
    method: 'POST',
    body: null,
    headers: {
      TTL: '60',
      Urgency: 'high',
      Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
      'Crypto-Key': `p256ecdsa=${vapid.publicKey}`,
    },
  });
  const responseText = response.ok ? '' : await response.text();
  return { ok: response.ok, status: response.status, responseText };
};

const sendTagNotifications = async (env: Env, payload: { senderUserId: string; messageText: string }) => {
  pushLog('push_flow_start', {
    senderUserId: payload.senderUserId,
    messagePreview: payload.messageText.slice(0, 160),
    hasAtSymbol: payload.messageText.includes('@'),
  });

  const vapid = getVapidConfig(env);
  if (!vapid) {
    pushLog('push_flow_skipped_missing_vapid', { senderUserId: payload.senderUserId });
    return;
  }

  const allChatRecipients = await env.DB.prepare(
    "SELECT id FROM users WHERE id != ?1 AND notification_preference = 'all_chats'",
  )
    .bind(payload.senderUserId)
    .all<{ id: string }>();
  const allChatRecipientIds = allChatRecipients.results.map((user) => user.id);

  let taggedNames: string[] = [];
  let taggedOnlyRecipientIds: string[] = [];

  if (payload.messageText.includes('@')) {
    const taggedCandidates = await env.DB.prepare("SELECT id, name FROM users WHERE notification_preference = 'tagged_only'").all<{ id: string; name: string }>();
    taggedNames = parseTaggedNamesFromCandidates(payload.messageText, taggedCandidates.results.map((user) => user.name));

    pushLog('push_flow_tag_parse', {
      senderUserId: payload.senderUserId,
      taggedOnlyCandidateCount: taggedCandidates.results.length,
      taggedOnlyCandidateIds: taggedCandidates.results.map((user) => user.id),
      taggedNames,
    });

    if (taggedNames.length) {
      taggedOnlyRecipientIds = taggedCandidates.results
        .filter((user) => user.id !== payload.senderUserId && taggedNames.includes(normalizeMentionName(user.name)))
        .map((user) => user.id);
    } else {
      pushLog('push_flow_no_valid_tags', {
        senderUserId: payload.senderUserId,
        messageText: payload.messageText.slice(0, 160),
      });
    }
  }

  const senderSubscriptionCount = await env.DB.prepare('SELECT COUNT(1) AS count FROM push_subscriptions WHERE user_id = ?1')
    .bind(payload.senderUserId)
    .first<{ count: number }>();
  const preferenceRows = await env.DB.prepare('SELECT id, notification_preference FROM users WHERE id != ?1')
    .bind(payload.senderUserId)
    .all<{ id: string; notification_preference: string }>();
  const disabledRecipientIds = preferenceRows.results
    .filter((user) => user.notification_preference === 'disabled')
    .map((user) => user.id);
  const recipientIds = Array.from(new Set([...allChatRecipientIds, ...taggedOnlyRecipientIds]));
  pushLog('push_flow_recipient_summary', {
    senderUserId: payload.senderUserId,
    senderIncludedInRecipients: recipientIds.includes(payload.senderUserId),
    senderSubscriptionCount: senderSubscriptionCount?.count ?? 0,
    allChatRecipientIds,
    taggedOnlyRecipientIds,
    disabledRecipientIds,
    preferenceCounts: preferenceRows.results.reduce<Record<string, number>>((counts, user) => {
      counts[user.notification_preference] = (counts[user.notification_preference] ?? 0) + 1;
      return counts;
    }, {}),
    recipientIds,
    taggedNames,
  });

  if (!recipientIds.length) {
    pushLog('push_flow_no_recipients', {
      senderUserId: payload.senderUserId,
      taggedNames,
    });
    return;
  }

  const subPlaceholders = recipientIds.map((_, idx) => `?${idx + 1}`).join(', ');
  const subscriptions = await env.DB.prepare(
    `SELECT id, user_id, endpoint, p256dh_key, auth_key FROM push_subscriptions WHERE user_id IN (${subPlaceholders})`,
  )
    .bind(...recipientIds)
    .all<{ id: string; user_id: string; endpoint: string; p256dh_key: string; auth_key: string }>();

  if (!subscriptions.results.length) {
    pushLog('push_flow_no_subscriptions', {
      senderUserId: payload.senderUserId,
      recipientIds,
      taggedNames,
    });
    return;
  }

  pushLog('push_flow_dispatch_start', {
    senderUserId: payload.senderUserId,
    taggedNames,
    recipientIds,
    subscriptionCount: subscriptions.results.length,
  });

  const senderNameRow = await env.DB.prepare('SELECT name FROM users WHERE id = ?1 LIMIT 1').bind(payload.senderUserId).first<{ name: string }>();
  const senderLabel = senderNameRow?.name?.trim() || 'Teammate';
  const compactMessage = payload.messageText.replace(/\s+/g, ' ').trim();
  const truncatedMessage = compactMessage.length > 120 ? `${compactMessage.slice(0, 117)}...` : compactMessage;
  const notificationPayload: PendingPushNotification = {
    title: 'New message in chat',
    body: `${senderLabel}: ${truncatedMessage}`,
    url: '/chat',
    tag: 'Grimace FC',
  };

  for (const subscription of subscriptions.results) {
    try {
      await storePendingNotification(env, subscription.endpoint, notificationPayload);
      const pushResult = await sendPushPing(env, subscription.endpoint);
      if (pushResult.ok) {
        await env.DB.prepare('UPDATE push_subscriptions SET last_attempt_at = ?1, last_success_at = ?1, last_failure_at = NULL, last_failure_status = NULL, last_failure_reason = NULL, last_attempt_message = ?2 WHERE id = ?3')
          .bind(nowIso(), 'accepted', subscription.id)
          .run();
        pushLog('push_send_ok', {
          userId: subscription.user_id,
          endpoint: safeEndpointSummary(subscription.endpoint),
        });
        continue;
      }
      const responseText = pushResult.responseText ?? '';
      const shouldDelete =
        pushResult.status === 404 ||
        pushResult.status === 410 ||
        (pushResult.status === 403 && responseText.toLowerCase().includes('do not correspond to the credentials used to create the subscriptions'));
      if (shouldDelete) {
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE id = ?1').bind(subscription.id).run();
      } else {
        await env.DB.prepare('UPDATE push_subscriptions SET last_attempt_at = ?1, last_failure_at = ?1, last_failure_status = ?2, last_failure_reason = ?3, last_attempt_message = ?4 WHERE id = ?5')
          .bind(nowIso(), pushResult.status, 'provider_rejected', responseText.slice(0, 500), subscription.id)
          .run();
      }
      pushLog('push_send_failed', {
        endpoint: safeEndpointSummary(subscription.endpoint),
        userId: subscription.user_id,
        statusCode: pushResult.status,
        deletedSubscription: shouldDelete,
        responseText: responseText.slice(0, 200),
      });
    } catch (err) {
      await env.DB.prepare('UPDATE push_subscriptions SET last_attempt_at = ?1, last_failure_at = ?1, last_failure_status = NULL, last_failure_reason = ?2, last_attempt_message = ?3 WHERE id = ?4')
        .bind(nowIso(), 'send_exception', err instanceof Error ? err.message.slice(0, 500) : String(err).slice(0, 500), subscription.id)
        .run();
      pushLog('push_send_failed', {
        endpoint: safeEndpointSummary(subscription.endpoint),
        userId: subscription.user_id,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
};

const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nickname TEXT,
    goals INTEGER NOT NULL DEFAULT 0,
    assists INTEGER NOT NULL DEFAULT 0,
    notification_preference TEXT NOT NULL DEFAULT 'all_chats' CHECK(notification_preference IN ('all_chats','tagged_only','disabled'))
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
    map_address TEXT,
    opponent TEXT,
    occasion TEXT,
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
    edited_at TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS message_reactions (
    id TEXT PRIMARY KEY,
    message_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    emoji TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(message_id, user_id, emoji),
    FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    expiration_time INTEGER,
    user_agent TEXT,
    device_label TEXT,
    standalone INTEGER,
    notification_permission TEXT,
    last_attempt_at TEXT,
    last_success_at TEXT,
    last_failure_at TEXT,
    last_failure_status INTEGER,
    last_failure_reason TEXT,
    last_attempt_message TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')), 
    UNIQUE(user_id, endpoint),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS push_notification_queue (
    id TEXT PRIMARY KEY,
    endpoint TEXT NOT NULL UNIQUE,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    notification_preference TEXT NOT NULL DEFAULT 'all_chats' CHECK(notification_preference IN ('all_chats','tagged_only','disabled'))
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
  `CREATE TABLE IF NOT EXISTS event_scores (
    event_id TEXT PRIMARY KEY,
    grimace_score INTEGER NOT NULL CHECK(grimace_score >= 0),
    opponent_score INTEGER NOT NULL CHECK(opponent_score >= 0),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS event_goal_details (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    scorer_user_id TEXT,
    assist_user_id TEXT,
    is_own_goal INTEGER NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY(scorer_user_id) REFERENCES users(id),
    FOREIGN KEY(assist_user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS ref_roster (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    roster_order INTEGER NOT NULL UNIQUE,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS next_ref_state (
    event_id TEXT PRIMARY KEY,
    current_ref_slot_id TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('Pending Decision','Accepted')),
    running_balance INTEGER NOT NULL DEFAULT 0,
    accepted_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(event_id) REFERENCES events(id),
    FOREIGN KEY(current_ref_slot_id) REFERENCES ref_roster(id)
  )`,
  `CREATE TABLE IF NOT EXISTS next_ref_passes (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    passed_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(event_id) REFERENCES events(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS next_ref_skips (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    ref_slot_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    skipped_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(event_id) REFERENCES events(id),
    FOREIGN KEY(ref_slot_id) REFERENCES ref_roster(id),
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS next_ref_history (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL,
    referee_user_id TEXT NOT NULL,
    final_balance INTEGER NOT NULL,
    passed_json TEXT NOT NULL,
    accepted_at TEXT,
    completed_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(event_id) REFERENCES events(id),
    FOREIGN KEY(referee_user_id) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS season_ladder_current (
    id TEXT PRIMARY KEY,
    position INTEGER,
    team_hash_id TEXT,
    team_name TEXT NOT NULL,
    club_name TEXT,
    club_code TEXT,
    club_logo TEXT,
    played INTEGER DEFAULT 0,
    won INTEGER DEFAULT 0,
    drawn INTEGER DEFAULT 0,
    lost INTEGER DEFAULT 0,
    byes INTEGER DEFAULT 0,
    forfeits INTEGER DEFAULT 0,
    goals_for INTEGER DEFAULT 0,
    goals_against INTEGER DEFAULT 0,
    goal_difference INTEGER DEFAULT 0,
    point_adjustment INTEGER DEFAULT 0,
    points_per_game REAL DEFAULT 0,
    points INTEGER DEFAULT 0,
    recent_form_json TEXT,
    upcoming_matches_json TEXT,
    up_next_logo TEXT,
    is_our_team INTEGER DEFAULT 0,
    raw_json TEXT,
    updated_at TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS idx_events_date ON events(date)',
  'CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id, emoji)',
  'CREATE INDEX IF NOT EXISTS idx_message_reactions_user ON message_reactions(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_push_subscriptions_updated_at ON push_subscriptions(updated_at)',
  'CREATE INDEX IF NOT EXISTS idx_push_queue_created_at ON push_notification_queue(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_availability_event_user ON availability(event_id, user_id)',
  'CREATE INDEX IF NOT EXISTS idx_event_goal_details_event_sort ON event_goal_details(event_id, sort_order, created_at)',
  'CREATE INDEX IF NOT EXISTS idx_ref_roster_order ON ref_roster(roster_order)',
  'CREATE INDEX IF NOT EXISTS idx_next_ref_passes_event ON next_ref_passes(event_id, passed_at)',
  'CREATE INDEX IF NOT EXISTS idx_next_ref_skips_event_slot ON next_ref_skips(event_id, ref_slot_id)',
  'CREATE INDEX IF NOT EXISTS idx_next_ref_history_completed ON next_ref_history(completed_at DESC)',
  'CREATE INDEX IF NOT EXISTS idx_season_ladder_current_position ON season_ladder_current(position)',
  'CREATE INDEX IF NOT EXISTS idx_season_ladder_current_updated_at ON season_ladder_current(updated_at)',
] as const;

let schemaInitPromise: Promise<void> | null = null;
let nextRefHasLegacyCurrentUserColumn: boolean | null = null;

const ensureEventDutyColumns = async (env: Env) => {
  const columnsResult = await env.DB.prepare('PRAGMA table_info(events)').all<{ name: string }>();
  const existingColumns = new Set(columnsResult.results.map((column) => String(column.name)));

  if (!existingColumns.has('beer_duty_user_id')) {
    await env.DB.prepare('ALTER TABLE events ADD COLUMN beer_duty_user_id TEXT').run();
  }
  if (!existingColumns.has('ref_duty_user_id')) {
    await env.DB.prepare('ALTER TABLE events ADD COLUMN ref_duty_user_id TEXT').run();
  }
  if (!existingColumns.has('map_address')) {
    await env.DB.prepare('ALTER TABLE events ADD COLUMN map_address TEXT').run();
  }
};

const ensureMessageEditColumn = async (env: Env) => {
  const columnsResult = await env.DB.prepare('PRAGMA table_info(messages)').all<{ name: string }>();
  const existingColumns = new Set(columnsResult.results.map((column) => String(column.name)));

  if (!existingColumns.has('edited_at')) {
    await env.DB.prepare('ALTER TABLE messages ADD COLUMN edited_at TEXT').run();
  }
};

const ensureRefRosterIdColumn = async (env: Env) => {
  const columnsResult = await env.DB.prepare('PRAGMA table_info(ref_roster)').all<{ name: string }>();
  const existingColumns = new Set(columnsResult.results.map((column) => String(column.name)));

  if (!existingColumns.has('id')) {
    await env.DB.prepare('ALTER TABLE ref_roster ADD COLUMN id TEXT').run();
    const rows = await env.DB.prepare('SELECT user_id, roster_order FROM ref_roster ORDER BY roster_order ASC').all<{ user_id: string; roster_order: number }>();
    for (const row of rows.results) {
      await env.DB.prepare('UPDATE ref_roster SET id = ?1 WHERE user_id = ?2 AND roster_order = ?3')
        .bind(`refslot-${String(Number(row.roster_order) + 1).padStart(3, '0')}`, row.user_id, row.roster_order)
        .run();
    }
  }
};


const ensureNextRefStateSlotColumn = async (env: Env) => {
  const columnsResult = await env.DB.prepare('PRAGMA table_info(next_ref_state)').all<{ name: string }>();
  const existingColumns = new Set(columnsResult.results.map((column) => String(column.name)));
  nextRefHasLegacyCurrentUserColumn = existingColumns.has('current_user_id');

  if (existingColumns.has('current_ref_slot_id')) return;

  if (existingColumns.has('current_user_id')) {
    await env.DB.prepare('ALTER TABLE next_ref_state ADD COLUMN current_ref_slot_id TEXT').run();

    const rows = await env.DB.prepare('SELECT event_id, current_user_id FROM next_ref_state').all<{ event_id: string; current_user_id: string }>();
    for (const row of rows.results) {
      const slot = await env.DB.prepare('SELECT id FROM ref_roster WHERE user_id = ?1 ORDER BY roster_order ASC LIMIT 1')
        .bind(row.current_user_id)
        .first<{ id: string }>();
      if (!slot) continue;
      await env.DB.prepare('UPDATE next_ref_state SET current_ref_slot_id = ?1 WHERE event_id = ?2')
        .bind(slot.id, row.event_id)
        .run();
    }
  }
};

const hasLegacyNextRefCurrentUserColumn = async (env: Env) => {
  if (nextRefHasLegacyCurrentUserColumn !== null) return nextRefHasLegacyCurrentUserColumn;
  const columnsResult = await env.DB.prepare('PRAGMA table_info(next_ref_state)').all<{ name: string }>();
  nextRefHasLegacyCurrentUserColumn = columnsResult.results.some((column) => String(column.name) === 'current_user_id');
  return nextRefHasLegacyCurrentUserColumn;
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

const ensureUserStatsColumns = async (env: Env) => {
  const columnsResult = await env.DB.prepare('PRAGMA table_info(users)').all<{ name: string }>();
  const existingColumns = new Set(columnsResult.results.map((column) => String(column.name)));

  if (!existingColumns.has('goals')) {
    await env.DB.prepare('ALTER TABLE users ADD COLUMN goals INTEGER NOT NULL DEFAULT 0').run();
  }
  if (!existingColumns.has('assists')) {
    await env.DB.prepare('ALTER TABLE users ADD COLUMN assists INTEGER NOT NULL DEFAULT 0').run();
  }
};


const ensureUserNotificationPreferenceColumn = async (env: Env) => {
  const columnsResult = await env.DB.prepare('PRAGMA table_info(users)').all<{ name: string }>();
  const existingColumns = new Set(columnsResult.results.map((column) => String(column.name)));

  if (!existingColumns.has('notification_preference')) {
    await env.DB.prepare("ALTER TABLE users ADD COLUMN notification_preference TEXT NOT NULL DEFAULT 'all_chats' CHECK(notification_preference IN ('all_chats','tagged_only','disabled'))").run();
  }

  const nullPreferenceCount = await env.DB.prepare("SELECT COUNT(1) AS count FROM users WHERE notification_preference IS NULL OR notification_preference = ''").first<{ count: number }>();
  if (Number(nullPreferenceCount?.count ?? 0) > 0) {
    await env.DB.prepare("UPDATE users SET notification_preference = 'all_chats' WHERE notification_preference IS NULL OR notification_preference = ''").run();
  }
};

const ensureDefaultDutyAssignments = async (env: Env) => {
  const users = await env.DB.prepare('SELECT id FROM users WHERE id != ?1 ORDER BY name ASC LIMIT 50').bind(SYSTEM_USER_ID).all<{ id: string }>();
  const userIds = users.results.map((user) => String(user.id));
  if (userIds.length === 0) return;

  const events = await env.DB.prepare(
    "SELECT id, home_away, beer_duty_user_id, ref_duty_user_id FROM events WHERE event_type = 'Game' ORDER BY date ASC LIMIT 100",
  ).all<{ id: string; home_away: string | null; beer_duty_user_id: string | null; ref_duty_user_id: string | null }>();

  let idx = 0;
  for (const event of events.results) {
    const beerDutyUserId = event.beer_duty_user_id ?? userIds[idx % userIds.length];
    const refDutyUserId = event.home_away === 'Away' ? event.ref_duty_user_id ?? null : null;
    idx += 1;

    await env.DB.prepare('UPDATE events SET beer_duty_user_id = ?1, ref_duty_user_id = ?2 WHERE id = ?3')
      .bind(beerDutyUserId, refDutyUserId, event.id)
      .run();
  }
};

const ensureRefRosterSeed = async (env: Env) => {
  const countRow = await env.DB.prepare('SELECT COUNT(1) AS count FROM ref_roster').first<{ count: number }>();
  if (Number(countRow?.count ?? 0) > 0) return;

  const users = await env.DB.prepare('SELECT id FROM users WHERE id != ?1 ORDER BY name ASC').bind(SYSTEM_USER_ID).all<{ id: string }>();
  let index = 0;
  for (const user of users.results) {
    await env.DB.prepare('INSERT INTO ref_roster (id, user_id, roster_order) VALUES (?1, ?2, ?3)')
      .bind(createId('refslot'), user.id, index)
      .run();
    index += 1;
  }
};

const ensureGrimaceUser = async (env: Env) => {
  await env.DB.prepare('INSERT INTO users (id, name, nickname) VALUES (?1, ?2, ?3) ON CONFLICT(id) DO NOTHING')
    .bind(SYSTEM_USER_ID, 'Grimace', null)
    .run();
};

const ensurePushSubscriptionDiagnosticColumns = async (env: Env) => {
  const columnsResult = await env.DB.prepare('PRAGMA table_info(push_subscriptions)').all<{ name: string }>();
  const existingColumns = new Set(columnsResult.results.map((column) => String(column.name)));
  const columnsToAdd = [
    ['user_agent', 'TEXT'],
    ['device_label', 'TEXT'],
    ['standalone', 'INTEGER'],
    ['notification_permission', 'TEXT'],
    ['last_attempt_at', 'TEXT'],
    ['last_success_at', 'TEXT'],
    ['last_failure_at', 'TEXT'],
    ['last_failure_status', 'INTEGER'],
    ['last_failure_reason', 'TEXT'],
    ['last_attempt_message', 'TEXT'],
  ] as const;

  for (const [name, definition] of columnsToAdd) {
    if (!existingColumns.has(name)) {
      await env.DB.prepare(`ALTER TABLE push_subscriptions ADD COLUMN ${name} ${definition}`).run();
    }
  }
};

const ensurePushUniquenessConstraints = async (env: Env) => {
  await env.DB.prepare(
    `DELETE FROM push_subscriptions
     WHERE rowid NOT IN (
       SELECT MAX(rowid)
       FROM push_subscriptions
       GROUP BY user_id, endpoint
     )`,
  ).run();

  await env.DB.prepare(
    `DELETE FROM push_subscriptions
     WHERE rowid NOT IN (
       SELECT MAX(rowid)
       FROM push_subscriptions
       GROUP BY endpoint
     )`,
  ).run();

  await env.DB.prepare(
    `DELETE FROM push_notification_queue
     WHERE rowid NOT IN (
       SELECT MAX(rowid)
       FROM push_notification_queue
       GROUP BY endpoint
     )`,
  ).run();

  await env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_user_endpoint ON push_subscriptions(user_id, endpoint)').run();
  await env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint)').run();
  await env.DB.prepare('CREATE UNIQUE INDEX IF NOT EXISTS idx_push_queue_endpoint ON push_notification_queue(endpoint)').run();
};

const ensureSchema = async (env: Env) => {
  if (!schemaInitPromise) {
    schemaInitPromise = (async () => {
      for (const statement of schemaStatements) {
        await env.DB.prepare(statement).run();
      }
      await ensureEventDutyColumns(env);
      await ensureLineupDutyColumns(env);
      await ensureUserStatsColumns(env);
      await ensureUserNotificationPreferenceColumn(env);
      await ensurePushSubscriptionDiagnosticColumns(env);
      await ensureMessageEditColumn(env);
      await ensureRefRosterIdColumn(env);
      await ensureNextRefStateSlotColumn(env);
      await ensureDefaultDutyAssignments(env);
      await ensureRefRosterSeed(env);
      await ensureGrimaceUser(env);
      await ensurePushUniquenessConstraints(env);
    })();
  }
  await schemaInitPromise;
};


type MessageRow = { id: string; user_id: string; text: string; created_at: string; edited_at: string | null };
type ReactionRow = { message_id: string; emoji: string; user_id: string; user_name: string; created_at: string };

const normalizeEmoji = (value: unknown) => String(value ?? '').trim().slice(0, 32);

const getMessagePayloads = async (env: Env, rows: MessageRow[]) => {
  if (!rows.length) return [];
  const messageIds = rows.map((row) => row.id);
  const placeholders = messageIds.map((_, index) => `?${index + 1}`).join(',');
  const reactions = await env.DB.prepare(
    `SELECT message_reactions.message_id AS message_id,
            message_reactions.emoji AS emoji,
            message_reactions.user_id AS user_id,
            users.name AS user_name,
            message_reactions.created_at AS created_at
       FROM message_reactions
       JOIN users ON users.id = message_reactions.user_id
      WHERE message_reactions.message_id IN (${placeholders})
      ORDER BY message_reactions.created_at ASC`,
  ).bind(...messageIds).all<ReactionRow>();

  const reactionsByMessage = new Map<string, Map<string, Array<{ id: string; name: string }>>>();
  for (const reaction of reactions.results) {
    const byEmoji = reactionsByMessage.get(reaction.message_id) ?? new Map<string, Array<{ id: string; name: string }>>();
    const users = byEmoji.get(reaction.emoji) ?? [];
    users.push({ id: reaction.user_id, name: reaction.user_name });
    byEmoji.set(reaction.emoji, users);
    reactionsByMessage.set(reaction.message_id, byEmoji);
  }

  return rows.map((row) => {
    const byEmoji = reactionsByMessage.get(row.id) ?? new Map<string, Array<{ id: string; name: string }>>();
    return {
      id: row.id,
      userId: row.user_id,
      text: row.text,
      createdAt: row.created_at,
      editedAt: row.edited_at,
      reactions: Array.from(byEmoji.entries()).map(([emoji, users]) => ({ emoji, count: users.length, users })),
    };
  });
};

const getMessagePayload = async (env: Env, messageId: string) => {
  const row = await env.DB.prepare('SELECT id, user_id, text, created_at, edited_at FROM messages WHERE id = ?1 LIMIT 1')
    .bind(messageId)
    .first<MessageRow>();
  if (!row) return null;
  const [payload] = await getMessagePayloads(env, [row]);
  return payload;
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

const getGoalDetailsForEvent = async (env: Env, eventId: string) => {
  const { results } = await env.DB.prepare(
    'SELECT id, scorer_user_id, assist_user_id, is_own_goal, sort_order FROM event_goal_details WHERE event_id = ?1 ORDER BY sort_order ASC, created_at ASC',
  )
    .bind(eventId)
    .all<{ id: string; scorer_user_id: string | null; assist_user_id: string | null; is_own_goal: number; sort_order: number }>();

  return results.map((row) => ({
    id: row.id,
    scorerUserId: row.scorer_user_id,
    assistUserId: row.assist_user_id,
    isOwnGoal: Boolean(row.is_own_goal),
    sortOrder: Number(row.sort_order ?? 0),
  }));
};

type NextAwayEventRow = {
  id: string;
  event_type: string;
  date: string;
  day_of_week: string;
  home_away: string | null;
  location: string;
  opponent: string | null;
  occasion: string | null;
  is_next_up: number;
};

const getNextAwayEvent = (env: Env) =>
  env.DB.prepare(
    "SELECT id, event_type, date, day_of_week, home_away, location, opponent, occasion, is_next_up FROM events WHERE event_type = 'Game' AND home_away = 'Away' AND ref_duty_user_id IS NULL AND datetime(date) >= datetime('now') ORDER BY date ASC LIMIT 1",
  ).first<NextAwayEventRow>();

const getTopRosterUser = (env: Env) =>
  env.DB.prepare(
    'SELECT ref_roster.id AS id, ref_roster.user_id AS user_id, users.name AS name, ref_roster.roster_order AS roster_order FROM ref_roster JOIN users ON users.id = ref_roster.user_id ORDER BY ref_roster.roster_order ASC LIMIT 1',
  ).first<{ id: string; user_id: string; name: string; roster_order: number }>();

const resolveRosterSlotId = async (env: Env, maybeSlotIdOrUserId: string) => {
  const byId = await env.DB.prepare('SELECT id FROM ref_roster WHERE id = ?1 LIMIT 1').bind(maybeSlotIdOrUserId).first<{ id: string }>();
  if (byId?.id) return byId.id;
  const byUser = await env.DB.prepare('SELECT id FROM ref_roster WHERE user_id = ?1 ORDER BY roster_order ASC LIMIT 1')
    .bind(maybeSlotIdOrUserId)
    .first<{ id: string }>();
  return byUser?.id ?? null;
};

const getNextEligibleRosterUser = async (env: Env, eventId: string, currentRefSlotId: string) => {
  const rosterRows = await env.DB.prepare(
    'SELECT ref_roster.id AS id, ref_roster.user_id AS user_id, users.name AS name, ref_roster.roster_order AS roster_order FROM ref_roster JOIN users ON users.id = ref_roster.user_id ORDER BY ref_roster.roster_order ASC',
  ).all<{ id: string; user_id: string; name: string; roster_order: number }>();
  if (!rosterRows.results.length) return null;

  const passRows = await env.DB.prepare('SELECT user_id FROM next_ref_passes WHERE event_id = ?1')
    .bind(eventId)
    .all<{ user_id: string }>();
  const passed = new Set(passRows.results.map((row) => row.user_id));
  const skipRows = await env.DB.prepare('SELECT ref_slot_id FROM next_ref_skips WHERE event_id = ?1')
    .bind(eventId)
    .all<{ ref_slot_id: string }>();
  const skippedSlots = new Set(skipRows.results.map((row) => row.ref_slot_id));

  const currentIndex = Math.max(0, rosterRows.results.findIndex((row) => row.id === currentRefSlotId));
  for (let offset = 1; offset <= rosterRows.results.length; offset += 1) {
    const candidate = rosterRows.results[(currentIndex + offset) % rosterRows.results.length];
    if (!passed.has(candidate.user_id) && !skippedSlots.has(candidate.id)) return candidate;
  }

  return rosterRows.results[currentIndex];
};

const ensureNextRefStateForEvent = async (env: Env, eventId: string) => {
  const hasLegacyCurrentUser = await hasLegacyNextRefCurrentUserColumn(env);
  const existing = await env.DB.prepare(
    'SELECT event_id, current_ref_slot_id, status, running_balance, accepted_at FROM next_ref_state WHERE event_id = ?1 LIMIT 1',
  ).bind(eventId).first<{ event_id: string; current_ref_slot_id: string; status: 'Pending Decision' | 'Accepted'; running_balance: number; accepted_at: string | null }>();
  if (existing) {
    const normalizedSlotId = await resolveRosterSlotId(env, existing.current_ref_slot_id);
    if (!normalizedSlotId) return null;
    if (normalizedSlotId !== existing.current_ref_slot_id) {
      const normalizedSlot = await env.DB.prepare('SELECT user_id FROM ref_roster WHERE id = ?1 LIMIT 1').bind(normalizedSlotId).first<{ user_id: string }>();
      if (hasLegacyCurrentUser) {
        await env.DB.prepare('UPDATE next_ref_state SET current_ref_slot_id = ?1, current_user_id = ?2, updated_at = ?3 WHERE event_id = ?4')
          .bind(normalizedSlotId, normalizedSlot?.user_id ?? null, nowIso(), existing.event_id)
          .run();
      } else {
        await env.DB.prepare('UPDATE next_ref_state SET current_ref_slot_id = ?1, updated_at = ?2 WHERE event_id = ?3')
          .bind(normalizedSlotId, nowIso(), existing.event_id)
          .run();
      }
    }
    return { ...existing, current_ref_slot_id: normalizedSlotId };
  }

  const top = await getTopRosterUser(env);
  if (!top) return null;
  const createdAt = nowIso();
  if (hasLegacyCurrentUser) {
    await env.DB.prepare(
      'INSERT INTO next_ref_state (event_id, current_ref_slot_id, current_user_id, status, running_balance, accepted_at, updated_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)',
    )
      .bind(eventId, top.id, top.user_id, 'Pending Decision', 0, null, createdAt, createdAt)
      .run();
  } else {
    await env.DB.prepare(
      'INSERT INTO next_ref_state (event_id, current_ref_slot_id, status, running_balance, accepted_at, updated_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
    )
      .bind(eventId, top.id, 'Pending Decision', 0, null, createdAt, createdAt)
      .run();
  }

  return {
    event_id: eventId,
    current_ref_slot_id: top.id,
    status: 'Pending Decision' as const,
    running_balance: 0,
    accepted_at: null,
  };
};

type NextRefStateRow = {
  event_id: string;
  current_ref_slot_id: string;
  status: 'Pending Decision' | 'Accepted';
  running_balance: number;
  accepted_at: string | null;
  event_date: string;
};

const getTrackedNextRefState = (env: Env) =>
  env.DB.prepare(
    "SELECT s.event_id, s.current_ref_slot_id, s.status, s.running_balance, s.accepted_at, e.date AS event_date FROM next_ref_state s JOIN events e ON e.id = s.event_id WHERE e.event_type = 'Game' AND e.home_away = 'Away' ORDER BY e.date ASC LIMIT 1",
  ).first<NextRefStateRow>();

const finalizeNextRefCycle = async (
  env: Env,
  state: { event_id: string; current_ref_slot_id: string; running_balance: number; accepted_at: string | null },
) => {
  const passRows = await env.DB.prepare(
    'SELECT next_ref_passes.user_id AS user_id, users.name AS name, next_ref_passes.passed_at AS passed_at FROM next_ref_passes JOIN users ON users.id = next_ref_passes.user_id WHERE next_ref_passes.event_id = ?1 ORDER BY next_ref_passes.passed_at ASC',
  ).bind(state.event_id).all<{ user_id: string; name: string; passed_at: string }>();
  const passed = passRows.results.map((row) => ({ userId: row.user_id, name: row.name, passedAt: row.passed_at }));

  const normalizedSlotId = await resolveRosterSlotId(env, state.current_ref_slot_id);
  if (!normalizedSlotId) {
    throw new Error('Admin repair required: next ref state points to an unknown roster slot.');
  }
  const currentRefSlot = await env.DB.prepare('SELECT user_id FROM ref_roster WHERE id = ?1 LIMIT 1').bind(normalizedSlotId).first<{ user_id: string }>();
  if (!currentRefSlot?.user_id) {
    throw new Error('Admin repair required: next ref state has no valid referee assignment.');
  }

  await env.DB.prepare(
    'INSERT INTO next_ref_history (id, event_id, referee_user_id, final_balance, passed_json, accepted_at, completed_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
  )
    .bind(createId('refhist'), state.event_id, currentRefSlot.user_id, Number(state.running_balance), JSON.stringify(passed), state.accepted_at, nowIso())
    .run();

  await env.DB.prepare('DELETE FROM next_ref_passes WHERE event_id = ?1').bind(state.event_id).run();
  await env.DB.prepare('DELETE FROM next_ref_state WHERE event_id = ?1').bind(state.event_id).run();
};

const autoAdvanceCompletedNextRefCycle = async (env: Env) => {
  while (true) {
    const tracked = await getTrackedNextRefState(env);
    if (!tracked) break;
    const hasPassed = Number(new Date(tracked.event_date).getTime()) < Date.now();
    if (!(tracked.status === 'Accepted' && hasPassed)) break;
    await finalizeNextRefCycle(env, tracked);
  }
};

const alignPendingCurrentRef = async (
  env: Env,
  state: { event_id: string; current_ref_slot_id: string; status: 'Pending Decision' | 'Accepted' },
) => {
  if (state.status !== 'Pending Decision') return state;
  const hasLegacyCurrentUser = await hasLegacyNextRefCurrentUserColumn(env);
  const hasCurrentPassed = await env.DB.prepare('SELECT id FROM next_ref_passes WHERE event_id = ?1 AND user_id = (SELECT user_id FROM ref_roster WHERE id = ?2 LIMIT 1) LIMIT 1')
    .bind(state.event_id, state.current_ref_slot_id)
    .first<{ id: string }>();
  const hasCurrentSkipped = await env.DB.prepare('SELECT id FROM next_ref_skips WHERE event_id = ?1 AND ref_slot_id = ?2 LIMIT 1')
    .bind(state.event_id, state.current_ref_slot_id)
    .first<{ id: string }>();
  if (!hasCurrentPassed && !hasCurrentSkipped) return state;
  const eligible = await getNextEligibleRosterUser(env, state.event_id, state.current_ref_slot_id);
  if (!eligible || eligible.id === state.current_ref_slot_id) return state;
  if (hasLegacyCurrentUser) {
    await env.DB.prepare('UPDATE next_ref_state SET current_ref_slot_id = ?1, current_user_id = ?2, updated_at = ?3 WHERE event_id = ?4')
      .bind(eligible.id, eligible.user_id, nowIso(), state.event_id)
      .run();
  } else {
    await env.DB.prepare('UPDATE next_ref_state SET current_ref_slot_id = ?1, updated_at = ?2 WHERE event_id = ?3')
      .bind(eligible.id, nowIso(), state.event_id)
      .run();
  }
  return { ...state, current_ref_slot_id: eligible.id };
};

const buildNextRefPayload = async (env: Env) => {
  await autoAdvanceCompletedNextRefCycle(env);
  const trackedState = await getTrackedNextRefState(env);
  const nextAway = trackedState
    ? await env.DB.prepare(
      "SELECT id, event_type, date, day_of_week, home_away, location, opponent, occasion, is_next_up FROM events WHERE id = ?1 LIMIT 1",
    ).bind(trackedState.event_id).first<NextAwayEventRow>()
    : await getNextAwayEvent(env);
  const rosterRows = await env.DB.prepare(
    'SELECT ref_roster.id AS id, ref_roster.user_id AS user_id, users.name AS name, ref_roster.roster_order AS roster_order FROM ref_roster JOIN users ON users.id = ref_roster.user_id ORDER BY ref_roster.roster_order ASC',
  ).all<{ id: string; user_id: string; name: string; roster_order: number }>();

  if (!nextAway) {
    return {
      event: null,
      currentRefUserId: null,
      currentRefSlotId: null,
      currentRefName: null,
      status: null,
      runningBalance: 0,
      passList: [],
      roster: rosterRows.results.map((row) => ({ userId: row.user_id, name: row.name, order: Number(row.roster_order), slotId: row.id, skippedAt: null })),
    };
  }

  const state = trackedState ?? (await ensureNextRefStateForEvent(env, nextAway.id));
  const passRows = await env.DB.prepare(
    'SELECT next_ref_passes.user_id AS user_id, users.name AS name, next_ref_passes.passed_at AS passed_at FROM next_ref_passes JOIN users ON users.id = next_ref_passes.user_id WHERE next_ref_passes.event_id = ?1 ORDER BY next_ref_passes.passed_at ASC',
  ).bind(nextAway.id).all<{ user_id: string; name: string; passed_at: string }>();
  const currentRefRow = state
    ? await env.DB.prepare('SELECT ref_roster.user_id AS user_id, users.name AS name FROM ref_roster JOIN users ON users.id = ref_roster.user_id WHERE ref_roster.id = ?1 LIMIT 1').bind(state.current_ref_slot_id).first<{ user_id: string; name: string }>()
    : null;
  const skipRows = await env.DB.prepare('SELECT ref_slot_id, skipped_at FROM next_ref_skips WHERE event_id = ?1')
    .bind(nextAway.id)
    .all<{ ref_slot_id: string; skipped_at: string }>();
  const skippedAtBySlotId = new Map(skipRows.results.map((row) => [row.ref_slot_id, row.skipped_at]));

  return {
    event: {
      id: nextAway.id,
      eventType: nextAway.event_type,
      date: nextAway.date,
      dayOfWeek: nextAway.day_of_week,
      homeAway: nextAway.home_away,
      location: nextAway.location,
      opponent: nextAway.opponent,
      occasion: nextAway.occasion,
      isNextUp: Boolean(nextAway.is_next_up),
    },
    currentRefUserId: currentRefRow?.user_id ?? null,
    currentRefSlotId: state?.current_ref_slot_id ?? null,
    currentRefName: currentRefRow?.name ?? null,
    status: state?.status ?? null,
    runningBalance: Number(state?.running_balance ?? 0),
    passList: passRows.results.map((row) => ({ userId: row.user_id, name: row.name, passedAt: row.passed_at })),
    roster: rosterRows.results.map((row) => ({ userId: row.user_id, name: row.name, order: Number(row.roster_order), slotId: row.id, skippedAt: skippedAtBySlotId.get(row.id) ?? null })),
  };
};


type SeasonLadderDbRow = {
  id: string;
  position: number | null;
  team_hash_id: string | null;
  team_name: string;
  club_name: string | null;
  club_code: string | null;
  club_logo: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  byes: number;
  forfeits: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  point_adjustment: number;
  points_per_game: number;
  points: number;
  recent_form_json: string | null;
  upcoming_matches_json: string | null;
  up_next_logo: string | null;
  is_our_team: number;
  raw_json: string | null;
  updated_at: string;
};

type ParsedSeasonLadderRow = {
  id: string;
  position: number | null;
  teamHashId: string | null;
  teamName: string;
  clubName: string | null;
  clubCode: string | null;
  clubLogo: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  byes: number;
  forfeits: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  pointAdjustment: number;
  pointsPerGame: number;
  points: number;
  recentForm: string[];
  upcomingMatches: unknown[];
  upNextLogo: string | null;
  upNextTeamName: string | null;
  isOurTeam: boolean;
  raw: unknown;
  updatedAt: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const extractLadderCandidates = (value: unknown, candidates: Record<string, unknown>[] = []) => {
  if (Array.isArray(value)) {
    for (const item of value) extractLadderCandidates(item, candidates);
    return candidates;
  }
  if (!isRecord(value)) return candidates;

  const hasTeamName = typeof value.team_name === 'string' || typeof value.teamName === 'string';
  const hasLadderMetric = ['played', 'won', 'drawn', 'lost', 'points', 'goals_for', 'goals_against'].some((key) => key in value);
  if (hasTeamName && hasLadderMetric) candidates.push(value);

  for (const nested of Object.values(value)) {
    if (typeof nested === 'object' && nested !== null) extractLadderCandidates(nested, candidates);
  }
  return candidates;
};

const normalizeRecentForm = (row: Record<string, unknown>) => {
  const direct = row.recent_form ?? row.recentForm ?? row.form ?? row.last_five ?? row.lastFive;
  const normalizeToken = (value: unknown): string | null => {
    const token = String(value ?? '').trim().toUpperCase();
    if (token.startsWith('W') || token === 'WIN') return 'W';
    if (token.startsWith('D') || token === 'DRAW') return 'D';
    if (token.startsWith('L') || token === 'LOSS') return 'L';
    return null;
  };

  if (Array.isArray(direct)) {
    return direct.map((item) => isRecord(item) ? normalizeToken(item.result ?? item.outcome ?? item.type ?? item.value) : normalizeToken(item)).filter((item): item is string => item !== null).slice(-5);
  }

  if (typeof direct === 'string') {
    return direct.split(/[\s,|/-]+/).map(normalizeToken).filter((item): item is string => item !== null).slice(-5);
  }

  const matches = row.recent_matches ?? row.recentMatches ?? row.matches;
  if (Array.isArray(matches)) {
    return matches.map((match) => isRecord(match) ? normalizeToken(match.result ?? match.outcome ?? match.ladder_result) : null).filter((item): item is string => item !== null).slice(-5);
  }

  return [];
};

const getUpcomingMatches = (row: Record<string, unknown>) => {
  const upcoming = row.upcoming_matches ?? row.upcomingMatches ?? row.upcoming;
  return Array.isArray(upcoming) ? upcoming : [];
};

const getUpNextDetails = (teamName: string, upcomingMatches: unknown[]) => {
  const first = upcomingMatches.find(isRecord);
  if (!first) return { logo: null, teamName: null };
  const homeTeam = isRecord(first.home_team) ? first.home_team : {};
  const awayTeam = isRecord(first.away_team) ? first.away_team : {};
  const homeClub = isRecord(first.home_club) ? first.home_club : {};
  const awayClub = isRecord(first.away_club) ? first.away_club : {};
  const homeTeamName = normalizeNullableString(first.home_team_name ?? first.homeTeamName ?? homeTeam.name);
  const awayTeamName = normalizeNullableString(first.away_team_name ?? first.awayTeamName ?? awayTeam.name);
  const homeLogo = normalizeNullableString(first.home_club_image ?? first.homeClubImage ?? first.home_club_image_url ?? homeClub.image);
  const awayLogo = normalizeNullableString(first.away_club_image ?? first.awayClubImage ?? first.away_club_image_url ?? awayClub.image);
  if (homeTeamName && homeTeamName === teamName) return { logo: awayLogo, teamName: awayTeamName };
  return { logo: homeLogo, teamName: homeTeamName };
};

const parseSeasonLadderPayload = (payload: unknown, updatedAt = nowIso()): ParsedSeasonLadderRow[] => {
  const seen = new Set<string>();
  const parsedRows = extractLadderCandidates(payload)
    .map<ParsedSeasonLadderRow | null>((row, index) => {
      const teamName = normalizeNullableString(row.team_name ?? row.teamName);
      if (!teamName) return null;
      const teamHashId = normalizeNullableString(row.team_hash_id ?? row.teamHashId ?? row.team_id ?? row.teamId);
      const id = teamHashId ?? normalizeNullableString(row.id) ?? `ladder-${index + 1}-${teamName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
      if (seen.has(id)) return null;
      seen.add(id);
      const upcomingMatches = getUpcomingMatches(row);
      const upNext = getUpNextDetails(teamName, upcomingMatches);
      const goalsFor = normalizeNumber(row.goals_for ?? row.goalsFor ?? row.for);
      const goalsAgainst = normalizeNumber(row.goals_against ?? row.goalsAgainst ?? row.against);
      const goalDifference = normalizeNumber(row.goal_difference ?? row.goalDifference ?? row.gd, goalsFor - goalsAgainst);
      const pointAdjustment = normalizeNumber(row.point_adjustment ?? row.adj ?? row.adjustment);
      const recentForm = normalizeRecentForm(row);

      return {
        id,
        position: normalizeNumber(row.position ?? row.pos ?? row.rank, index + 1),
        teamHashId,
        teamName,
        clubName: normalizeNullableString(row.club_name ?? row.clubName),
        clubCode: normalizeNullableString(row.club_code ?? row.clubCode),
        clubLogo: normalizeNullableString(row.club_logo ?? row.clubLogo),
        played: normalizeNumber(row.played),
        won: normalizeNumber(row.won),
        drawn: normalizeNumber(row.drawn),
        lost: normalizeNumber(row.lost),
        byes: normalizeNumber(row.byes),
        forfeits: normalizeNumber(row.forfeits),
        goalsFor,
        goalsAgainst,
        goalDifference,
        pointAdjustment,
        pointsPerGame: normalizeNumber(row.points_per_game ?? row.pointsPerGame ?? row.average ?? row.avg),
        points: normalizeNumber(row.points),
        recentForm,
        upcomingMatches,
        upNextLogo: upNext.logo,
        upNextTeamName: upNext.teamName,
        isOurTeam: teamName === OUR_LADDER_TEAM_NAME,
        raw: row,
        updatedAt,
      };
    })
    .filter((row): row is ParsedSeasonLadderRow => row !== null);

  return parsedRows.sort((a, b) => normalizeNumber(a.position, 999) - normalizeNumber(b.position, 999) || b.points - a.points || a.teamName.localeCompare(b.teamName));
};

const seasonLadderPayloadFromRows = (rows: SeasonLadderDbRow[]) => {
  const updatedAt = rows[0]?.updated_at ?? null;
  return {
    updatedAt,
    rows: rows.map((row) => ({
      id: row.id,
      position: row.position,
      teamHashId: row.team_hash_id,
      teamName: row.team_name,
      clubName: row.club_name,
      clubCode: row.club_code,
      clubLogo: row.club_logo,
      played: row.played,
      won: row.won,
      drawn: row.drawn,
      lost: row.lost,
      byes: row.byes,
      forfeits: row.forfeits,
      goalsFor: row.goals_for,
      goalsAgainst: row.goals_against,
      goalDifference: row.goal_difference,
      pointAdjustment: row.point_adjustment,
      pointsPerGame: row.points_per_game,
      points: row.points,
      recentForm: row.recent_form_json ? JSON.parse(row.recent_form_json) as string[] : [],
      upcomingMatches: row.upcoming_matches_json ? JSON.parse(row.upcoming_matches_json) as unknown[] : [],
      upNextLogo: row.up_next_logo,
      isOurTeam: row.is_our_team === 1,
      updatedAt: row.updated_at,
    })),
  };
};

const getSeasonLadderRows = async (env: Env) => {
  const rows = await env.DB.prepare('SELECT * FROM season_ladder_current ORDER BY position ASC, points DESC, team_name ASC').all<SeasonLadderDbRow>();
  return seasonLadderPayloadFromRows(rows.results);
};

class DriblLadderError extends Error {
  status: number;

  constructor(status: number, detail?: string) {
    super(`Dribl ladder request failed: ${status}${detail ? ` (${detail})` : ''}`);
    this.status = status;
  }
}

const fetchDriblLadderPayload = async () => {
  const response = await fetch(DRIBL_LADDER_URL, {
    headers: {
      accept: 'application/json, text/plain, */*',
      'accept-language': 'en-AU,en;q=0.9',
      origin: 'https://mwfa.dribl.com',
      referer: DRIBL_LADDER_PAGE_URL,
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-site',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      'x-requested-with': 'XMLHttpRequest',
    },
    method: 'GET',
  });
  if (!response.ok) {
    const detail = (await response.text()).replace(/\s+/g, ' ').trim().slice(0, 120);
    throw new DriblLadderError(response.status, detail);
  }
  return response.json();
};

const refreshSeasonLadder = async (env: Env) => {
  const payload = await fetchDriblLadderPayload();
  const updatedAt = nowIso();
  const rows = parseSeasonLadderPayload(payload, updatedAt);
  if (!rows.length) throw new Error('Dribl ladder response did not contain ladder rows');

  await env.DB.prepare('DELETE FROM season_ladder_current').run();
  for (const row of rows) {
    await env.DB.prepare(
      `INSERT INTO season_ladder_current (
        id, position, team_hash_id, team_name, club_name, club_code, club_logo, played, won, drawn, lost, byes, forfeits,
        goals_for, goals_against, goal_difference, point_adjustment, points_per_game, points, recent_form_json,
        upcoming_matches_json, up_next_logo, is_our_team, raw_json, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25)`,
    ).bind(
      row.id,
      row.position,
      row.teamHashId,
      row.teamName,
      row.clubName,
      row.clubCode,
      row.clubLogo,
      row.played,
      row.won,
      row.drawn,
      row.lost,
      row.byes,
      row.forfeits,
      row.goalsFor,
      row.goalsAgainst,
      row.goalDifference,
      row.pointAdjustment,
      row.pointsPerGame,
      row.points,
      JSON.stringify(row.recentForm),
      JSON.stringify(row.upcomingMatches),
      row.upNextLogo,
      row.isOurTeam ? 1 : 0,
      JSON.stringify(row.raw),
      row.updatedAt,
    ).run();
  }

  return { ...(await getSeasonLadderRows(env)), refreshed: true };
};

const refreshSeasonLadderWithCachedFallback = async (env: Env) => {
  try {
    return await refreshSeasonLadder(env);
  } catch (err) {
    const cachedPayload = await getSeasonLadderRows(env);
    if (cachedPayload.rows.length) {
      const message = err instanceof Error ? err.message : 'Dribl ladder request failed';
      return {
        ...cachedPayload,
        refreshed: false,
        warning: `${message}. Showing the last saved ladder instead.`,
      };
    }
    throw err;
  }
};

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
    if (pathname === '/api/season-ladder' && method === 'GET') {
      return jsonResponse(await getSeasonLadderRows(env), 200, { 'Cache-Control': 'no-store' });
    }

    if (pathname === '/api/admin/refresh-season-ladder' && method === 'POST') {
      const adminPasscodeError = requireAdminPasscode(request, env);
      if (adminPasscodeError) return adminPasscodeError;
      return jsonResponse(await refreshSeasonLadderWithCachedFallback(env), 200, { 'Cache-Control': 'no-store' });
    }

    if (pathname === '/api/events' && method === 'GET') {
      await maybePostAttendanceReminders(env);
      const { results } = await env.DB.prepare(
        `SELECT
          events.id,
          events.event_type,
          events.date,
          events.day_of_week,
          events.home_away,
          events.beer_duty_user_id,
          events.ref_duty_user_id,
          events.location,
          events.map_address,
          events.opponent,
          events.occasion,
          events.is_next_up,
          event_scores.grimace_score,
          event_scores.opponent_score,
          event_scores.updated_at AS score_updated_at,
          CASE WHEN next_ref_state.status = 'Pending Decision' THEN ref_roster.user_id ELSE NULL END AS pending_ref_user_id
        FROM events
        LEFT JOIN event_scores ON event_scores.event_id = events.id
        LEFT JOIN next_ref_state ON next_ref_state.event_id = events.id
        LEFT JOIN ref_roster ON ref_roster.id = next_ref_state.current_ref_slot_id
        ORDER BY events.date ASC
        LIMIT 50`,
      ).all();

      return jsonResponse(
        await Promise.all(results.map(async (row) => ({
          id: row.id,
          eventType: row.event_type,
          date: row.date,
          dayOfWeek: row.day_of_week,
          homeAway: row.home_away,
          beerDutyUserId: row.beer_duty_user_id,
          refDutyUserId: row.ref_duty_user_id,
          pendingRefUserId: row.pending_ref_user_id,
          location: row.location,
          mapAddress: row.map_address,
          opponent: row.opponent,
          occasion: row.occasion,
          isNextUp: Boolean(row.is_next_up),
          score: row.grimace_score === null || row.opponent_score === null
            ? null
            : {
                eventId: row.id,
                grimaceScore: Number(row.grimace_score),
                opponentScore: Number(row.opponent_score),
                goalDetails: await getGoalDetailsForEvent(env, String(row.id)),
                updatedAt: String(row.score_updated_at),
              },
        }))),
        200,
        cacheHeadersFor(pathname),
      );
    }

    if (pathname === '/api/next-game' && method === 'GET') {
      const row = await env.DB.prepare(
        `SELECT
          events.id,
          events.event_type,
          events.date,
          events.day_of_week,
          events.home_away,
          events.beer_duty_user_id,
          events.ref_duty_user_id,
          events.location,
          events.map_address,
          events.opponent,
          events.occasion,
          events.is_next_up,
          event_scores.grimace_score,
          event_scores.opponent_score,
          event_scores.updated_at AS score_updated_at,
          CASE WHEN next_ref_state.status = 'Pending Decision' THEN ref_roster.user_id ELSE NULL END AS pending_ref_user_id
        FROM events
        LEFT JOIN event_scores ON event_scores.event_id = events.id
        LEFT JOIN next_ref_state ON next_ref_state.event_id = events.id
        LEFT JOIN ref_roster ON ref_roster.id = next_ref_state.current_ref_slot_id
        WHERE events.event_type = 'Game'
          AND datetime(events.date) >= datetime('now', 'start of day')
        ORDER BY events.date ASC
        LIMIT 1`,
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
          pendingRefUserId: row.pending_ref_user_id,
          location: row.location,
          mapAddress: row.map_address,
          opponent: row.opponent,
          occasion: row.occasion,
          isNextUp: Boolean(row.is_next_up),
          score: row.grimace_score === null || row.opponent_score === null
            ? null
            : {
                eventId: row.id,
                grimaceScore: Number(row.grimace_score),
                opponentScore: Number(row.opponent_score),
                goalDetails: await getGoalDetailsForEvent(env, String(row.id)),
                updatedAt: String(row.score_updated_at),
              },
        },
        200,
        cacheHeadersFor(pathname),
      );
    }

    if (pathname === '/api/next-ref' && method === 'GET') {
      const payload = await buildNextRefPayload(env);
      return jsonResponse(payload, 200, cacheHeadersFor(pathname));
    }

    if (pathname === '/api/next-ref/history' && method === 'GET') {
      const historyRows = await env.DB.prepare(
        'SELECT h.id, h.event_id, h.referee_user_id, h.final_balance, h.passed_json, h.accepted_at, h.completed_at, e.date AS event_date, e.opponent, e.location, u.name AS referee_name FROM next_ref_history h JOIN events e ON e.id = h.event_id JOIN users u ON u.id = h.referee_user_id ORDER BY h.completed_at DESC LIMIT 100',
      ).all<{
        id: string;
        event_id: string;
        referee_user_id: string;
        final_balance: number;
        passed_json: string;
        accepted_at: string | null;
        completed_at: string;
        event_date: string;
        opponent: string | null;
        location: string;
        referee_name: string;
      }>();
      return jsonResponse(
        historyRows.results.map((row) => ({
          eventId: row.event_id,
          eventDate: row.event_date,
          opponent: row.opponent,
          location: row.location,
          refereeUserId: row.referee_user_id,
          refereeName: row.referee_name,
          finalBalance: Number(row.final_balance),
          passed: JSON.parse(row.passed_json),
          acceptedAt: row.accepted_at,
          completedAt: row.completed_at,
        })),
        200,
        cacheHeadersFor(pathname),
      );
    }

    if (pathname === '/api/next-ref/pass' && method === 'POST') {
      const body = (await request.json()) as { userId?: string; eventId?: string };
      if (!body.userId || !body.eventId) return errorResponse('userId and eventId are required');
      const hasLegacyCurrentUser = await hasLegacyNextRefCurrentUserColumn(env);

      const rawState = await ensureNextRefStateForEvent(env, body.eventId);
      const state = rawState ? await alignPendingCurrentRef(env, rawState) : null;
      if (!state) return errorResponse('No next ref state found', 404);
      const currentSlot = await env.DB.prepare('SELECT user_id FROM ref_roster WHERE id = ?1 LIMIT 1').bind(state.current_ref_slot_id).first<{ user_id: string }>();
      if ((currentSlot?.user_id ?? null) !== body.userId) return errorResponse('Only the current assigned referee can pass', 403);
      if (state.status !== 'Pending Decision') return errorResponse('Cannot pass after duty has been accepted', 400);
      const hasAlreadyPassed = await env.DB.prepare('SELECT id FROM next_ref_passes WHERE event_id = ?1 AND user_id = ?2 LIMIT 1')
        .bind(body.eventId, body.userId)
        .first<{ id: string }>();
      if (hasAlreadyPassed) return errorResponse('This user has already passed for this away game', 400);

      const passedAt = nowIso();
      await env.DB.prepare('INSERT INTO next_ref_passes (id, event_id, user_id, passed_at) VALUES (?1, ?2, ?3, ?4)')
        .bind(createId('refpass'), body.eventId, body.userId, passedAt)
        .run();

      const nextEligible = await getNextEligibleRosterUser(env, body.eventId, state.current_ref_slot_id);
      if (!nextEligible) return errorResponse('Ref roster is empty', 400);

      if (hasLegacyCurrentUser) {
        await env.DB.prepare(
          'UPDATE next_ref_state SET current_ref_slot_id = ?1, current_user_id = ?2, status = ?3, running_balance = running_balance + 50, accepted_at = NULL, updated_at = ?4 WHERE event_id = ?5',
        )
          .bind(nextEligible.id, nextEligible.user_id, 'Pending Decision', nowIso(), body.eventId)
          .run();
      } else {
        await env.DB.prepare(
          'UPDATE next_ref_state SET current_ref_slot_id = ?1, status = ?2, running_balance = running_balance + 50, accepted_at = NULL, updated_at = ?3 WHERE event_id = ?4',
        )
          .bind(nextEligible.id, 'Pending Decision', nowIso(), body.eventId)
          .run();
      }

      const passingUser = await env.DB.prepare('SELECT name FROM users WHERE id = ?1 LIMIT 1')
        .bind(body.userId)
        .first<{ name: string }>();
      await announceNextRefDecision(env, {
        decisionText: `@${passingUser?.name ?? 'The current referee'} has passed ref duty`,
        eventId: body.eventId,
        nextRefName: nextEligible.name,
        fallbackUserId: body.userId,
      });

      return jsonResponse(await buildNextRefPayload(env), 200, { 'Cache-Control': 'no-store' });
    }

    if (pathname === '/api/next-ref/accept' && method === 'POST') {
      const body = (await request.json()) as { userId?: string; eventId?: string };
      if (!body.userId || !body.eventId) return errorResponse('userId and eventId are required');

      const rawState = await ensureNextRefStateForEvent(env, body.eventId);
      const state = rawState ? await alignPendingCurrentRef(env, rawState) : null;
      if (!state) return errorResponse('No next ref state found', 404);
      const currentSlot = await env.DB.prepare('SELECT user_id FROM ref_roster WHERE id = ?1 LIMIT 1').bind(state.current_ref_slot_id).first<{ user_id: string }>();
      if ((currentSlot?.user_id ?? null) !== body.userId) return errorResponse('Only the current assigned referee can accept', 403);

      await env.DB.prepare('UPDATE next_ref_state SET status = ?1, accepted_at = ?2, updated_at = ?3 WHERE event_id = ?4')
        .bind('Accepted', nowIso(), nowIso(), body.eventId)
        .run();
      await env.DB.prepare('UPDATE events SET ref_duty_user_id = ?1 WHERE id = ?2')
        .bind(body.userId, body.eventId)
        .run();

      const acceptedUser = await env.DB.prepare('SELECT name FROM users WHERE id = ?1 LIMIT 1').bind(body.userId).first<{ name: string }>();
      const passers = await env.DB.prepare('SELECT users.name AS name FROM next_ref_passes JOIN users ON users.id = next_ref_passes.user_id WHERE next_ref_passes.event_id = ?1 ORDER BY next_ref_passes.passed_at ASC')
        .bind(body.eventId)
        .all<{ name: string }>();
      const gameLabel = await getRefGameLabel(env, body.eventId);
      const passerNames = passers.results.map((row) => `@${row.name}`);
      const messageText = passerNames.length
        ? `Decision made: @${acceptedUser?.name ?? 'Referee'} has accepted ref duty for ${gameLabel}. The following peeps owe them $50: ${passerNames.join(', ')}.`
        : `Decision made: @${acceptedUser?.name ?? 'Referee'} has accepted ref duty for ${gameLabel}.`;

      await insertSystemMessage(env, messageText, body.userId);

      return jsonResponse(await buildNextRefPayload(env), 200, { 'Cache-Control': 'no-store' });
    }

    if (pathname === '/api/next-ref/skip' && method === 'POST') {
      const adminError = requireAdminPasscode(request, env);
      if (adminError) return adminError;
      const body = (await request.json()) as { eventId?: string };
      if (!body.eventId) return errorResponse('eventId is required');
      const hasLegacyCurrentUser = await hasLegacyNextRefCurrentUserColumn(env);

      const rawState = await ensureNextRefStateForEvent(env, body.eventId);
      const state = rawState ? await alignPendingCurrentRef(env, rawState) : null;
      if (!state) return errorResponse('No next ref state found', 404);
      if (state.status !== 'Pending Decision') return errorResponse('Cannot skip after duty has been accepted', 400);
      const currentSlot = await env.DB.prepare('SELECT user_id FROM ref_roster WHERE id = ?1 LIMIT 1')
        .bind(state.current_ref_slot_id)
        .first<{ user_id: string }>();
      if (!currentSlot?.user_id) return errorResponse('Admin repair required: unable to resolve referee user', 409);
      const hasAlreadySkipped = await env.DB.prepare('SELECT id FROM next_ref_skips WHERE event_id = ?1 AND ref_slot_id = ?2 LIMIT 1')
        .bind(body.eventId, state.current_ref_slot_id)
        .first<{ id: string }>();
      if (hasAlreadySkipped) return errorResponse('This roster slot has already been skipped for this away game', 400);

      await env.DB.prepare('INSERT INTO next_ref_skips (id, event_id, ref_slot_id, user_id, skipped_at) VALUES (?1, ?2, ?3, ?4, ?5)')
        .bind(createId('refskip'), body.eventId, state.current_ref_slot_id, currentSlot.user_id, nowIso())
        .run();

      const nextEligible = await getNextEligibleRosterUser(env, body.eventId, state.current_ref_slot_id);
      if (!nextEligible) return errorResponse('Ref roster is empty', 400);

      if (hasLegacyCurrentUser) {
        await env.DB.prepare(
          'UPDATE next_ref_state SET current_ref_slot_id = ?1, current_user_id = ?2, status = ?3, accepted_at = NULL, updated_at = ?4 WHERE event_id = ?5',
        )
          .bind(nextEligible.id, nextEligible.user_id, 'Pending Decision', nowIso(), body.eventId)
          .run();
      } else {
        await env.DB.prepare(
          'UPDATE next_ref_state SET current_ref_slot_id = ?1, status = ?2, accepted_at = NULL, updated_at = ?3 WHERE event_id = ?4',
        )
          .bind(nextEligible.id, 'Pending Decision', nowIso(), body.eventId)
          .run();
      }

      const skippedUser = await env.DB.prepare('SELECT name FROM users WHERE id = ?1 LIMIT 1')
        .bind(currentSlot.user_id)
        .first<{ name: string }>();
      await announceNextRefDecision(env, {
        decisionText: `@${skippedUser?.name ?? 'The current referee'} was skipped for ref duty`,
        eventId: body.eventId,
        nextRefName: nextEligible.name,
        fallbackUserId: currentSlot.user_id,
      });

      return jsonResponse(await buildNextRefPayload(env), 200, { 'Cache-Control': 'no-store' });
    }

    if (pathname === '/api/next-ref/complete' && method === 'POST') {
      const adminError = requireAdminPasscode(request, env);
      if (adminError) return adminError;
      const body = (await request.json()) as { eventId?: string };
      if (!body.eventId) return errorResponse('eventId is required');
      const hasLegacyCurrentUser = await hasLegacyNextRefCurrentUserColumn(env);
      const state = await env.DB.prepare(
        'SELECT event_id, current_ref_slot_id, status, running_balance, accepted_at FROM next_ref_state WHERE event_id = ?1 LIMIT 1',
      ).bind(body.eventId).first<{ event_id: string; current_ref_slot_id: string; status: 'Pending Decision' | 'Accepted'; running_balance: number; accepted_at: string | null }>();
      if (!state) return errorResponse('No active state for this event', 404);
      if (state.status !== 'Accepted') return errorResponse('Ref duty must be accepted before completing', 400);
      const normalizedSlotId = await resolveRosterSlotId(env, state.current_ref_slot_id);
      if (!normalizedSlotId) return errorResponse('Admin repair required: unable to resolve current ref roster slot', 409);
      const currentRefSlot = await env.DB.prepare('SELECT user_id FROM ref_roster WHERE id = ?1 LIMIT 1').bind(normalizedSlotId).first<{ user_id: string }>();
      if (!currentRefSlot?.user_id) return errorResponse('Admin repair required: unable to resolve referee user', 409);
      await env.DB.prepare('UPDATE events SET ref_duty_user_id = ?1 WHERE id = ?2')
        .bind(currentRefSlot.user_id, body.eventId)
        .run();
      await finalizeNextRefCycle(env, { ...state, current_ref_slot_id: normalizedSlotId });

      const completedEvent = await env.DB.prepare("SELECT date FROM events WHERE id = ?1 LIMIT 1").bind(body.eventId).first<{ date: string }>();
      const nextAway = completedEvent
        ? await env.DB.prepare(
          "SELECT id FROM events WHERE event_type = 'Game' AND home_away = 'Away' AND ref_duty_user_id IS NULL AND datetime(date) > datetime(?1) ORDER BY date ASC LIMIT 1",
        ).bind(completedEvent.date).first<{ id: string }>()
        : null;
      let nextDecisionRefName: string | null = null;
      let nextDecisionEventId: string | null = null;
      if (nextAway?.id) {
        const nextEligible = await getNextEligibleRosterUser(env, nextAway.id, normalizedSlotId);
        if (nextEligible?.id) {
          const createdAt = nowIso();
          if (hasLegacyCurrentUser) {
            await env.DB.prepare(
              'INSERT INTO next_ref_state (event_id, current_ref_slot_id, current_user_id, status, running_balance, accepted_at, updated_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)',
            )
              .bind(nextAway.id, nextEligible.id, nextEligible.user_id, 'Pending Decision', 0, null, createdAt, createdAt)
              .run();
          } else {
            await env.DB.prepare(
              'INSERT INTO next_ref_state (event_id, current_ref_slot_id, status, running_balance, accepted_at, updated_at, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
            )
              .bind(nextAway.id, nextEligible.id, 'Pending Decision', 0, null, createdAt, createdAt)
              .run();
          }
          nextDecisionRefName = nextEligible.name;
          nextDecisionEventId = nextAway.id;
        }
      }

      if (nextDecisionEventId && nextDecisionRefName) {
        const completedLabel = await getRefGameLabel(env, body.eventId);
        const nextLabel = await getRefGameLabel(env, nextDecisionEventId);
        await insertSystemMessage(
          env,
          `Ref duty is complete for ${completedLabel}. @${nextDecisionRefName}, it's your turn to decide for ${nextLabel}.`,
          currentRefSlot.user_id,
        );
      }

      return jsonResponse(await buildNextRefPayload(env), 200, { 'Cache-Control': 'no-store' });
    }

    if (pathname === '/api/users' && method === 'GET') {
      const { results } = await env.DB.prepare(
        `SELECT
          users.id,
          users.name,
          users.nickname,
          users.notification_preference,
          COALESCE(goal_totals.goal_count, 0) AS goals,
          COALESCE(assist_totals.assist_count, 0) AS assists
        FROM users
        LEFT JOIN (
          SELECT scorer_user_id AS user_id, COUNT(1) AS goal_count
          FROM event_goal_details
          WHERE scorer_user_id IS NOT NULL AND is_own_goal = 0
          GROUP BY scorer_user_id
        ) AS goal_totals ON goal_totals.user_id = users.id
        LEFT JOIN (
          SELECT assist_user_id AS user_id, COUNT(1) AS assist_count
          FROM event_goal_details
          WHERE assist_user_id IS NOT NULL
          GROUP BY assist_user_id
        ) AS assist_totals ON assist_totals.user_id = users.id
        ORDER BY users.name ASC
        LIMIT 50`,
      ).all();
      return jsonResponse(
        results.map((row) => ({
          id: row.id,
          name: row.name,
          nickname: row.nickname,
          goals: Number(row.goals ?? 0),
          assists: Number(row.assists ?? 0),
          notificationPreference: row.notification_preference,
        })),
      );
    }

    if (pathname === '/api/push/vapid-public-key' && method === 'GET') {
      return jsonResponse({ publicKey: env.VAPID_PUBLIC_KEY ?? null }, 200, { 'Cache-Control': 'no-store' });
    }

    if (pathname === '/api/push/pending' && method === 'GET') {
      const endpoint = searchParams.get('endpoint');
      if (!endpoint) return errorResponse('endpoint is required');
      const pending = await env.DB.prepare('SELECT id, payload_json FROM push_notification_queue WHERE endpoint = ?1 LIMIT 1')
        .bind(endpoint)
        .first<{ id: string; payload_json: string }>();
      if (!pending) return jsonResponse({ notification: null }, 200, { 'Cache-Control': 'no-store' });

      await env.DB.prepare('DELETE FROM push_notification_queue WHERE id = ?1').bind(pending.id).run();
      return jsonResponse({ notification: JSON.parse(pending.payload_json) }, 200, { 'Cache-Control': 'no-store' });
    }

    if (pathname === '/api/push/debug' && method === 'GET') {
      const adminError = requireAdminPasscode(request, env);
      if (adminError) return adminError;

      const rows = await env.DB.prepare(
        `SELECT
          users.id AS user_id,
          users.name AS user_name,
          users.notification_preference AS notification_preference,
          push_subscriptions.id AS subscription_id,
          push_subscriptions.endpoint AS endpoint,
          push_subscriptions.expiration_time AS expiration_time,
          push_subscriptions.user_agent AS user_agent,
          push_subscriptions.device_label AS device_label,
          push_subscriptions.standalone AS standalone,
          push_subscriptions.notification_permission AS notification_permission,
          push_subscriptions.created_at AS created_at,
          push_subscriptions.updated_at AS updated_at,
          push_subscriptions.last_attempt_at AS last_attempt_at,
          push_subscriptions.last_success_at AS last_success_at,
          push_subscriptions.last_failure_at AS last_failure_at,
          push_subscriptions.last_failure_status AS last_failure_status,
          push_subscriptions.last_failure_reason AS last_failure_reason,
          push_subscriptions.last_attempt_message AS last_attempt_message
        FROM users
        LEFT JOIN push_subscriptions ON push_subscriptions.user_id = users.id
        WHERE users.id != ?1
        ORDER BY users.name ASC, push_subscriptions.updated_at DESC`,
      ).bind(SYSTEM_USER_ID).all<{
        user_id: string;
        user_name: string;
        notification_preference: string;
        subscription_id: string | null;
        endpoint: string | null;
        expiration_time: number | null;
        user_agent: string | null;
        device_label: string | null;
        standalone: number | null;
        notification_permission: string | null;
        created_at: string | null;
        updated_at: string | null;
        last_attempt_at: string | null;
        last_success_at: string | null;
        last_failure_at: string | null;
        last_failure_status: number | null;
        last_failure_reason: string | null;
        last_attempt_message: string | null;
      }>();

      const usersById = new Map<string, {
        userId: string;
        name: string;
        notificationPreference: string;
        notificationPreferenceEnabled: boolean;
        pushEnabled: boolean;
        hasPushSubscription: boolean;
        needsResubscribe: boolean;
        subscriptionCount: number;
        lastSubscriptionUpdateAt: string | null;
        lastPushAttemptAt: string | null;
        lastPushStatus: string | null;
        subscriptions: Array<Record<string, unknown>>;
      }>();

      for (const row of rows.results) {
        const preferenceEnabled = row.notification_preference !== 'disabled';
        const current = usersById.get(row.user_id) ?? {
          userId: row.user_id,
          name: row.user_name,
          notificationPreference: row.notification_preference,
          notificationPreferenceEnabled: preferenceEnabled,
          pushEnabled: false,
          hasPushSubscription: false,
          needsResubscribe: preferenceEnabled,
          subscriptionCount: 0,
          lastSubscriptionUpdateAt: null,
          lastPushAttemptAt: null,
          lastPushStatus: null,
          subscriptions: [],
        };

        if (row.subscription_id && row.endpoint) {
          current.subscriptionCount += 1;
          if (!current.lastSubscriptionUpdateAt || (row.updated_at && row.updated_at > current.lastSubscriptionUpdateAt)) {
            current.lastSubscriptionUpdateAt = row.updated_at;
          }
          if (row.last_attempt_at && (!current.lastPushAttemptAt || row.last_attempt_at > current.lastPushAttemptAt)) {
            current.lastPushAttemptAt = row.last_attempt_at;
            current.lastPushStatus = row.last_success_at === row.last_attempt_at ? 'accepted' : row.last_failure_reason ?? 'failed';
          }
          current.subscriptions.push({
            id: row.subscription_id,
            endpoint: safeEndpointSummary(row.endpoint),
            expirationTime: row.expiration_time,
            deviceLabel: row.device_label,
            standalone: row.standalone === null ? null : Boolean(row.standalone),
            notificationPermission: row.notification_permission,
            userAgent: row.user_agent,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            lastAttemptAt: row.last_attempt_at,
            lastSuccessAt: row.last_success_at,
            lastFailureAt: row.last_failure_at,
            lastFailureStatus: row.last_failure_status,
            lastFailureReason: row.last_failure_reason,
            lastAttemptMessage: row.last_attempt_message,
          });
        }

        usersById.set(row.user_id, current);
      }

      const users = Array.from(usersById.values()).map((user) => {
        const hasPushSubscription = user.subscriptionCount > 0;
        const needsResubscribe = user.notificationPreferenceEnabled && !hasPushSubscription;
        return {
          ...user,
          pushEnabled: user.notificationPreferenceEnabled && hasPushSubscription,
          hasPushSubscription,
          needsResubscribe,
          lastPushStatus: user.lastPushAttemptAt ? user.lastPushStatus : null,
        };
      });
      const summary = users.reduce(
        (counts, user) => {
          counts.totalUsers += 1;
          if (user.notificationPreferenceEnabled) counts.notificationPreferenceEnabled += 1;
          if (user.pushEnabled) counts.pushEnabled += 1;
          if (user.needsResubscribe) counts.needsResubscribe += 1;
          counts.totalSubscriptions += user.subscriptionCount;
          return counts;
        },
        { totalUsers: 0, notificationPreferenceEnabled: 0, pushEnabled: 0, needsResubscribe: 0, totalSubscriptions: 0 },
      );

      return jsonResponse({
        generatedAt: nowIso(),
        summary,
        notes: [
          'pushEnabled means the user has notifications enabled by preference and at least one stored push subscription.',
          'needsResubscribe means the user wants notifications but currently has no stored subscription; ask them to open Settings and save All messages or Mentions only on the device that should receive pushes.',
          'Null device metadata means the subscription was saved before diagnostic metadata was added; resaving notifications on that device will refresh it.',
        ],
        vapid: {
          hasPublicKey: Boolean(env.VAPID_PUBLIC_KEY),
          publicKeyLength: env.VAPID_PUBLIC_KEY?.length ?? 0,
          hasPrivateKey: Boolean(env.VAPID_PRIVATE_KEY),
          subject: env.VAPID_SUBJECT ?? 'mailto:admin@grimacefc.local',
        },
        users,
      }, 200, { 'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate', Pragma: 'no-cache' });
    }

    if (pathname === '/api/push/subscription' && method === 'POST') {
      const body = (await request.json()) as { userId?: string; subscription?: WebPushSubscription; metadata?: PushSubscriptionMetadata };
      if (!body.userId) return errorResponse('userId is required');
      const existingUser = await env.DB.prepare('SELECT id FROM users WHERE id = ?1 LIMIT 1').bind(body.userId).first<{ id: string }>();
      if (!existingUser?.id) return errorResponse('Unknown userId', 404);
      const subscription = sanitizePushSubscription(body.subscription);
      if (!subscription) return errorResponse('A valid push subscription is required');

      const id = createId('push');
      const timestamp = nowIso();
      await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?1 AND user_id != ?2')
        .bind(subscription.endpoint, body.userId)
        .run();
      await env.DB.prepare(
        `INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh_key, auth_key, expiration_time, user_agent, device_label, standalone, notification_permission, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
         ON CONFLICT(user_id, endpoint) DO UPDATE SET
           p256dh_key=excluded.p256dh_key,
           auth_key=excluded.auth_key,
           expiration_time=excluded.expiration_time,
           user_agent=excluded.user_agent,
           device_label=excluded.device_label,
           standalone=excluded.standalone,
           notification_permission=excluded.notification_permission,
           updated_at=excluded.updated_at`,
      )
        .bind(
          id,
          body.userId,
          subscription.endpoint,
          subscription.keys.p256dh,
          subscription.keys.auth,
          subscription.expirationTime ?? null,
          body.metadata?.userAgent?.slice(0, 500) ?? null,
          body.metadata?.deviceLabel?.slice(0, 120) ?? null,
          body.metadata?.standalone === undefined ? null : Number(Boolean(body.metadata.standalone)),
          body.metadata?.notificationPermission?.slice(0, 32) ?? null,
          timestamp,
          timestamp,
        )
        .run();

      pushLog('push_subscription_saved', {
        userId: body.userId,
        endpoint: safeEndpointSummary(subscription.endpoint),
        deviceLabel: body.metadata?.deviceLabel ?? null,
        standalone: body.metadata?.standalone ?? null,
        notificationPermission: body.metadata?.notificationPermission ?? null,
      });

      return jsonResponse({ ok: true }, 201, { 'Cache-Control': 'no-store' });
    }

    if (pathname === '/api/push/subscription' && method === 'DELETE') {
      const body = (await request.json()) as { userId?: string; endpoint?: string };
      if (!body.userId || !body.endpoint) return errorResponse('userId and endpoint are required');

      await env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ?1 AND endpoint = ?2')
        .bind(body.userId, body.endpoint)
        .run();

      pushLog('push_subscription_deleted', { userId: body.userId, endpoint: safeEndpointSummary(body.endpoint) });

      return jsonResponse({ ok: true }, 200, { 'Cache-Control': 'no-store' });
    }

    if (pathname === '/api/messages' && method === 'GET') {
      const { results } = await env.DB.prepare('SELECT id, user_id, text, created_at, edited_at FROM messages ORDER BY created_at DESC LIMIT 50').all<MessageRow>();
      const payload = await getMessagePayloads(env, results.reverse());
      return jsonResponse(payload, 200, cacheHeadersFor(pathname));
    }

    if (pathname === '/api/messages' && method === 'POST') {
      const body = (await request.json()) as { userId?: string; text?: string };
      if (!body.userId || !body.text?.trim()) return errorResponse('userId and text are required');
      const id = createId('msg');
      const createdAt = nowIso();
      const trimmedText = body.text.trim();

      await env.DB.prepare('INSERT INTO messages (id, user_id, text, created_at) VALUES (?1, ?2, ?3, ?4)')
        .bind(id, body.userId, trimmedText, createdAt)
        .run();

      try {
        await sendTagNotifications(env, { senderUserId: body.userId, messageText: trimmedText });
      } catch (err) {
        pushLog('push_notification_flow_failed', { message: err instanceof Error ? err.message : String(err) });
      }

      const payload = await getMessagePayload(env, id);
      return jsonResponse(payload, 201, { 'Cache-Control': 'no-store' });
    }

    const messageReactionMatch = pathname.match(/^\/api\/messages\/([^/]+)\/reactions$/);
    if (messageReactionMatch && method === 'POST') {
      const messageId = decodeURIComponent(messageReactionMatch[1]);
      const body = (await request.json()) as { userId?: string; emoji?: string };
      const emoji = normalizeEmoji(body.emoji);
      if (!body.userId || !emoji) return errorResponse('userId and emoji are required');

      const message = await env.DB.prepare('SELECT id FROM messages WHERE id = ?1 LIMIT 1').bind(messageId).first<{ id: string }>();
      if (!message) return errorResponse('Message not found', 404);

      const existing = await env.DB.prepare('SELECT id FROM message_reactions WHERE message_id = ?1 AND user_id = ?2 AND emoji = ?3 LIMIT 1')
        .bind(messageId, body.userId, emoji)
        .first<{ id: string }>();

      if (existing) {
        await env.DB.prepare('DELETE FROM message_reactions WHERE id = ?1').bind(existing.id).run();
      } else {
        await env.DB.prepare('INSERT INTO message_reactions (id, message_id, user_id, emoji, created_at) VALUES (?1, ?2, ?3, ?4, ?5)')
          .bind(createId('react'), messageId, body.userId, emoji, nowIso())
          .run();
      }

      return jsonResponse(await getMessagePayload(env, messageId), 200, { 'Cache-Control': 'no-store' });
    }

    const messageMatch = pathname.match(/^\/api\/messages\/([^/]+)$/);
    if (messageMatch && method === 'PATCH') {
      const messageId = decodeURIComponent(messageMatch[1]);
      const body = (await request.json()) as { userId?: string; text?: string };
      const trimmedText = body.text?.trim() ?? '';
      if (!body.userId || !trimmedText) return errorResponse('userId and text are required');

      const existing = await env.DB.prepare('SELECT id, user_id FROM messages WHERE id = ?1 LIMIT 1').bind(messageId).first<{ id: string; user_id: string }>();
      if (!existing) return errorResponse('Message not found', 404);
      if (existing.user_id !== body.userId) return errorResponse('Only the message composer can edit this message', 403);

      await env.DB.prepare('UPDATE messages SET text = ?1, edited_at = ?2 WHERE id = ?3')
        .bind(trimmedText, nowIso(), messageId)
        .run();

      return jsonResponse(await getMessagePayload(env, messageId), 200, { 'Cache-Control': 'no-store' });
    }

    if (messageMatch && method === 'DELETE') {
      const messageId = decodeURIComponent(messageMatch[1]);
      const body = (await request.json()) as { userId?: string };
      if (!body.userId) return errorResponse('userId is required');

      const existing = await env.DB.prepare('SELECT id, user_id FROM messages WHERE id = ?1 LIMIT 1').bind(messageId).first<{ id: string; user_id: string }>();
      if (!existing) return errorResponse('Message not found', 404);
      if (existing.user_id !== body.userId) return errorResponse('Only the message composer can delete this message', 403);

      await env.DB.prepare('DELETE FROM message_reactions WHERE message_id = ?1').bind(messageId).run();
      await env.DB.prepare('DELETE FROM messages WHERE id = ?1').bind(messageId).run();

      return jsonResponse({ ok: true }, 200, { 'Cache-Control': 'no-store' });
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
      const adminPasscodeError = requireAdminPasscode(request, env);
      if (adminPasscodeError) return adminPasscodeError;
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

    if (pathname === '/api/event-score' && method === 'POST') {
      const adminPasscodeError = requireAdminPasscode(request, env);
      if (adminPasscodeError) return adminPasscodeError;

      const body = (await request.json()) as {
        eventId?: string;
        grimaceScore?: number;
        opponentScore?: number;
        goalDetails?: Array<{ scorerUserId?: string | null; assistUserId?: string | null; isOwnGoal?: boolean }>;
      };
      if (!body.eventId || body.grimaceScore === undefined || body.opponentScore === undefined) {
        return errorResponse('eventId, grimaceScore, opponentScore are required');
      }

      const event = await env.DB.prepare('SELECT id, event_type FROM events WHERE id = ?1 LIMIT 1')
        .bind(body.eventId)
        .first<{ id: string; event_type: 'Game' | 'Sesh' }>();
      if (!event) return errorResponse('Event not found', 404);
      if (event.event_type !== 'Game') return errorResponse('Scores can only be recorded for Game events', 400);

      const grimaceScore = Number(body.grimaceScore);
      const opponentScore = Number(body.opponentScore);
      if (!Number.isInteger(grimaceScore) || grimaceScore < 0 || !Number.isInteger(opponentScore) || opponentScore < 0) {
        return errorResponse('Scores must be whole numbers greater than or equal to 0');
      }

      const goalDetails = (body.goalDetails ?? []).filter((entry) => entry && (entry.scorerUserId || entry.assistUserId || entry.isOwnGoal));
      for (const detail of goalDetails) {
        const isOwnGoal = Boolean(detail.isOwnGoal);
        const scorerUserId = detail.scorerUserId ?? null;
        if (!isOwnGoal && !scorerUserId) {
          return errorResponse('Scorer is required for non-own-goal rows');
        }
      }

      const updatedAt = nowIso();
      await env.DB.prepare(
        `INSERT INTO event_scores (event_id, grimace_score, opponent_score, updated_at, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT(event_id) DO UPDATE SET grimace_score=excluded.grimace_score, opponent_score=excluded.opponent_score, updated_at=excluded.updated_at`,
      )
        .bind(body.eventId, grimaceScore, opponentScore, updatedAt, updatedAt)
        .run();

      await env.DB.prepare('DELETE FROM event_goal_details WHERE event_id = ?1').bind(body.eventId).run();
      for (let idx = 0; idx < goalDetails.length; idx += 1) {
        const detail = goalDetails[idx];
        const isOwnGoal = Boolean(detail.isOwnGoal);
        const scorerUserId = isOwnGoal ? null : (detail.scorerUserId ?? null);
        const assistUserId = detail.assistUserId ?? null;
        await env.DB.prepare(
          'INSERT INTO event_goal_details (id, event_id, scorer_user_id, assist_user_id, is_own_goal, sort_order, created_at) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)',
        )
          .bind(createId('goal'), body.eventId, scorerUserId, assistUserId, isOwnGoal ? 1 : 0, idx, updatedAt)
          .run();
      }

      return jsonResponse(
        {
          eventId: body.eventId,
          grimaceScore,
          opponentScore,
          goalDetails: await getGoalDetailsForEvent(env, body.eventId),
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

    if (pathname === '/api/availability/clear' && method === 'POST') {
      const body = (await request.json()) as { eventId?: string; userId?: string };
      if (!body.eventId || !body.userId) return errorResponse('eventId and userId are required');

      await env.DB.prepare('DELETE FROM availability WHERE event_id = ?1 AND user_id = ?2')
        .bind(body.eventId, body.userId)
        .run();

      return jsonResponse({ ok: true }, 200, { 'Cache-Control': 'no-store' });
    }


    if (pathname === '/api/users/notification-preference' && method === 'POST') {
      const body = (await request.json()) as { userId?: string; preference?: 'all_chats' | 'tagged_only' | 'disabled' };
      if (!body.userId || !body.preference) return errorResponse('userId and preference are required');
      if (!['all_chats', 'tagged_only', 'disabled'].includes(body.preference)) return errorResponse('Invalid notification preference');
      const existingUser = await env.DB.prepare('SELECT id FROM users WHERE id = ?1 LIMIT 1').bind(body.userId).first<{ id: string }>();
      if (!existingUser?.id) return errorResponse('Unknown userId', 404);
      await env.DB.prepare('UPDATE users SET notification_preference = ?1 WHERE id = ?2').bind(body.preference, body.userId).run();
      if (body.preference === 'disabled') {
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE user_id = ?1').bind(body.userId).run();
      }
      return jsonResponse({ ok: true }, 200, { 'Cache-Control': 'no-store' });
    }

    if (pathname === '/api/users/upsert' && method === 'POST') {
      const body = (await request.json()) as { id?: string; name?: string; nickname?: string | null };
      if (!body.name?.trim()) return errorResponse('name is required');
      const normalized = body.name.trim();

      const userColumnsResult = await env.DB.prepare('PRAGMA table_info(users)').all<{ name: string }>();
      const userColumns = new Set(userColumnsResult.results.map((column) => String(column.name)));
      const hasGoals = userColumns.has('goals');
      const hasAssists = userColumns.has('assists');
      const hasNotificationPreference = userColumns.has('notification_preference');

      const byNameFields = ['id', 'nickname'];
      if (hasGoals) byNameFields.push('goals');
      if (hasAssists) byNameFields.push('assists');
      if (hasNotificationPreference) byNameFields.push('notification_preference');
      const byName = await env.DB.prepare(`SELECT ${byNameFields.join(', ')} FROM users WHERE lower(name) = lower(?1) LIMIT 1`)
        .bind(normalized)
        .first();
      const id = body.id || (byName?.id as string | undefined) || createId('usr');
      const nickname = body.nickname ?? (byName?.nickname as string | null) ?? null;
      const goals = Number(byName?.goals ?? 0);
      const assists = Number(byName?.assists ?? 0);
      const notificationPreference = (byName?.notification_preference as string | undefined) ?? 'all_chats';

      const insertFields = ['id', 'name', 'nickname'];
      const insertPlaceholders = ['?1', '?2', '?3'];
      const insertValues: unknown[] = [id, normalized, nickname];
      if (hasGoals) {
        insertFields.push('goals');
        insertPlaceholders.push(`?${insertPlaceholders.length + 1}`);
        insertValues.push(goals);
      }
      if (hasAssists) {
        insertFields.push('assists');
        insertPlaceholders.push(`?${insertPlaceholders.length + 1}`);
        insertValues.push(assists);
      }
      if (hasNotificationPreference) {
        insertFields.push('notification_preference');
        insertPlaceholders.push(`?${insertPlaceholders.length + 1}`);
        insertValues.push(notificationPreference);
      }

      await env.DB.prepare(
        `INSERT INTO users (${insertFields.join(', ')}) VALUES (${insertPlaceholders.join(', ')}) ON CONFLICT(id) DO UPDATE SET name=excluded.name, nickname=excluded.nickname`,
      )
        .bind(...insertValues)
        .run();

      const existingRosterEntry = await env.DB.prepare('SELECT id FROM ref_roster WHERE user_id = ?1 LIMIT 1').bind(id).first<{ id: string }>();
      if (!existingRosterEntry) {
        const maxOrder = await env.DB.prepare('SELECT COALESCE(MAX(roster_order), -1) AS max_order FROM ref_roster').first<{ max_order: number }>();
        await env.DB.prepare('INSERT INTO ref_roster (id, user_id, roster_order) VALUES (?1, ?2, ?3)')
          .bind(createId('refslot'), id, Number(maxOrder?.max_order ?? -1) + 1)
          .run();
      }

      return jsonResponse({ id, name: normalized, nickname, goals, assists, notificationPreference }, 201, { 'Cache-Control': 'no-store' });
    }

    return errorResponse('Not found', 404);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown server error';
    return errorResponse(message, 500, { 'Cache-Control': 'no-store' });
  }
}

export default {
  async scheduled(_controller: unknown, env: Env, ctx: ExecutionContext): Promise<void> {
    // Cloudflare Cron Triggers run in UTC. `0 12 * * 1` is Monday 12:00 UTC,
    // which is Monday 22:00 in Sydney during AEST and Monday 23:00 during AEDT.
    ctx.waitUntil((async () => {
      await ensureSchema(env);
      await refreshSeasonLadderWithCachedFallback(env);
    })());
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    try {
      await ensureSchema(env);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to initialize database schema';
      return errorResponse(message, 500, { 'Cache-Control': 'no-store' });
    }

    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env);
    if (env.ASSETS) return env.ASSETS.fetch(request);
    return errorResponse('Asset binding is not configured', 404, { 'Cache-Control': 'no-store' });
  },
};
