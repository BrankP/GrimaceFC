PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS next_ref_state;
DROP TABLE IF EXISTS next_ref_history;
DROP TABLE IF EXISTS next_ref_passes;
DROP TABLE IF EXISTS ref_roster;
DROP TABLE IF EXISTS availability;
DROP TABLE IF EXISTS lineups;
DROP TABLE IF EXISTS message_reactions;
DROP TABLE IF EXISTS messages;
DROP TABLE IF EXISTS event_scores;
DROP TABLE IF EXISTS push_notification_queue;
DROP TABLE IF EXISTS push_subscriptions;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS users;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  nickname TEXT,
  notification_preference TEXT NOT NULL DEFAULT 'all_chats' CHECK(notification_preference IN ('all_chats','tagged_only','disabled'))
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  date TEXT NOT NULL,
  day_of_week TEXT NOT NULL,
  home_away TEXT,
  beer_duty_user_id TEXT,
  ref_duty_user_id TEXT,
  location TEXT NOT NULL,
  map_address TEXT,
  opponent TEXT,
  occasion TEXT,
  is_next_up INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ref_roster (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  roster_order INTEGER NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS next_ref_state (
  event_id TEXT PRIMARY KEY,
  current_ref_slot_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('Pending Decision','Accepted')),
  running_balance INTEGER NOT NULL DEFAULT 0,
  accepted_at TEXT,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS next_ref_history (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  referee_user_id TEXT NOT NULL,
  final_balance INTEGER NOT NULL,
  passed_json TEXT NOT NULL,
  accepted_at TEXT,
  completed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS event_scores (
  event_id TEXT PRIMARY KEY,
  grimace_score INTEGER NOT NULL,
  opponent_score INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  p256dh_key TEXT NOT NULL,
  auth_key TEXT NOT NULL,
  expiration_time INTEGER,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS push_notification_queue (
  id TEXT PRIMARY KEY,
  endpoint TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL,
  edited_at TEXT
);

CREATE TABLE IF NOT EXISTS message_reactions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(message_id, user_id, emoji),
  FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS lineups (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  formation TEXT NOT NULL,
  positions_json TEXT NOT NULL,
  subs_json TEXT NOT NULL,
  not_available_json TEXT NOT NULL,
  beer_duty_user_id TEXT,
  ref_duty_user_id TEXT,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS availability (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('available','not_available')),
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

PRAGMA foreign_keys = ON;

INSERT OR REPLACE INTO users (id, name, nickname, notification_preference) VALUES
('usr-001', 'Brad Fox', NULL, 'all_chats'),
('usr-002', 'Dan Hardyman', NULL, 'all_chats'),
('usr-003', 'Dylan Palmer', NULL, 'all_chats'),
('usr-004', 'Alex Truszewski', NULL, 'all_chats'),
('usr-005', 'Lochlan Browne', NULL, 'all_chats'),
('usr-006', 'Matt Paul', NULL, 'all_chats'),
('usr-007', 'Cale Whiting', NULL, 'all_chats'),
('usr-008', 'James Foley', NULL, 'all_chats'),
('usr-009', 'Alastair Cockerton', NULL, 'all_chats'),
('usr-010', 'Brendan Todd', NULL, 'all_chats'),
('usr-011', 'Hayden Enright', NULL, 'all_chats'),
('usr-012', 'Jack Gibson', NULL, 'all_chats'),
('usr-013', 'James West', NULL, 'all_chats'),
('usr-014', 'Justin Lever', NULL, 'all_chats'),
('usr-015', 'Troy Wynen', NULL, 'all_chats'),
('usr-016', 'Sam Bayly', NULL, 'all_chats'),
('usr-017', 'Brendan Jones', NULL, 'all_chats'),
('usr-018', 'Josh Gates', NULL, 'all_chats'),
('usr-019', 'Tom Jenkins', NULL, 'all_chats'),
('usr-020', 'Zac Reyes', NULL, 'all_chats');

INSERT OR REPLACE INTO events (id, event_type, date, day_of_week, home_away, beer_duty_user_id, ref_duty_user_id, location, map_address, opponent, occasion, is_next_up) VALUES
('evt-001', 'Game', '2026-03-14T05:00:00Z', 'Saturday', 'Home', NULL, NULL, 'ABH United 2026', 'Tristram Road Reserve', 'ABH United AL6A''s', 'Trial Match', 0),
('evt-002', 'Game', '2026-03-28T05:00:00Z', 'Saturday', 'Home', NULL, NULL, 'ABH United 2026', 'Tristram Road Reserve', 'ABH United AL6A''s', 'Trial Match', 0),
('evt-003', 'Game', '2026-04-11T05:00:00Z', 'Saturday', 'Away', 'usr-020', 'usr-012', 'CC Strikers', NULL, 'CC Strikers', 'Game', 0),
('evt-004', 'Game', '2026-04-18T05:00:00Z', 'Saturday', 'Home', 'usr-006', NULL, 'ABH United 2026', NULL, 'Curl Curl A', 'Game', 0),
('evt-005', 'Game', '2026-04-22T05:00:00Z', 'Wednesday', 'Away', 'usr-015', NULL, 'ABH United A', NULL, 'ABH United A', 'Game', 0),
('evt-006', 'Sesh', '2026-04-25T00:00:00Z', 'Saturday', NULL, NULL, NULL, '', NULL, NULL, 'Grimaces 2-up Spectacular', 0),
('evt-007', 'Game', '2026-05-02T13:00:00Z', 'Saturday', 'Home', 'usr-009', NULL, 'Brookvale', 'Millers Reserve', 'Brookvale', 'Game', 1),
('evt-008', 'Game', '2026-05-09T15:00:00Z', 'Saturday', 'Away', 'usr-011', NULL, 'Saint Augustine’s', 'Passmore Reserve', 'Saint Augustine’s', 'Game', 0),
('evt-009', 'Game', '2026-05-16T13:00:00Z', 'Saturday', 'Away', 'usr-013', NULL, 'Manly Vale', 'David Thomas Reserve', 'Manly Vale', 'Game', 0),
('evt-010', 'Game', '2026-05-22T19:00:00Z', 'Friday', 'Home', 'usr-012', NULL, 'Harbord', 'Millers Reserve', 'Harbord', 'Game', 0),
('evt-011', 'Game', '2026-05-30T15:00:00Z', 'Saturday', 'Away', 'usr-014', NULL, 'Wakehurst', 'Lionel Watts Oval', 'Wakehurst', 'Game', 0),
('evt-012', 'Game', '2026-06-06T13:00:00Z', 'Saturday', 'Home', 'usr-016', NULL, 'Curl Curl', 'Millers Reserve', 'Curl Curl', 'Game', 0),
('evt-013', 'Game', '2026-06-13T15:00:00Z', 'Saturday', 'Home', 'usr-008', NULL, 'Collaroy Cromer', 'Millers Reserve', 'Collaroy Cromer', 'Game', 0),
('evt-014', 'Game', '2026-06-27T13:00:00Z', 'Saturday', 'Away', 'usr-007', NULL, 'Curl Curl', 'Adam Street Reserve', 'Curl Curl', 'Game', 0),
('evt-015', 'Game', '2026-07-04T13:00:00Z', 'Saturday', 'Home', 'usr-017', NULL, 'Allambie', 'Beacon Hill Reserve', 'Allambie', 'Game', 0),
('evt-016', 'Game', '2026-07-11T15:00:00Z', 'Saturday', 'Away', 'usr-003', NULL, 'Brookvale', 'Grahams Reserve', 'Brookvale', 'Game', 0),
('evt-017', 'Game', '2026-07-18T15:00:00Z', 'Saturday', 'Home', 'usr-001', NULL, 'Saint Augustine’s', 'Beacon Hill Reserve', 'Saint Augustine’s', 'Game', 0),
('evt-018', 'Game', '2026-07-25T13:00:00Z', 'Saturday', 'Home', 'usr-010', NULL, 'Manly Vale', 'Millers Reserve', 'Manly Vale', 'Game', 0),
('evt-019', 'Game', '2026-08-01T15:00:00Z', 'Saturday', 'Away', 'usr-004', NULL, 'Harbord', 'Nolan Reserve', 'Harbord', 'Game', 0),
('evt-020', 'Game', '2026-08-08T15:00:00Z', 'Saturday', 'Home', 'usr-019', NULL, 'Wakehurst', 'Millers Reserve', 'Wakehurst', 'Game', 0),
('evt-021', 'Game', '2026-08-15T13:00:00Z', 'Saturday', 'Away', 'usr-005', NULL, 'Curl Curl', 'Adam Street Reserve', 'Curl Curl', 'Game', 0);

INSERT OR REPLACE INTO ref_roster (id, user_id, roster_order) VALUES
('refslot-001', 'usr-012', 0),
('refslot-002', 'usr-011', 1),
('refslot-003', 'usr-004', 2),
('refslot-004', 'usr-015', 3),
('refslot-005', 'usr-018', 4),
('refslot-006', 'usr-006', 5),
('refslot-007', 'usr-016', 6),
('refslot-008', 'usr-013', 7),
('refslot-009', 'usr-002', 8),
('refslot-010', 'usr-007', 9),
('refslot-011', 'usr-014', 10),
('refslot-012', 'usr-003', 11),
('refslot-013', 'usr-001', 12),
('refslot-014', 'usr-005', 13),
('refslot-015', 'usr-019', 14),
('refslot-016', 'usr-017', 15),
('refslot-017', 'usr-009', 16),
('refslot-018', 'usr-020', 17),
('refslot-019', 'usr-010', 18),
('refslot-020', 'usr-008', 19),
('refslot-021', 'usr-016', 20),
('refslot-022', 'usr-001', 21),
('refslot-023', 'usr-014', 22),
('refslot-024', 'usr-005', 23),
('refslot-025', 'usr-012', 24),
('refslot-026', 'usr-015', 25),
('refslot-027', 'usr-003', 26),
('refslot-028', 'usr-002', 27),
('refslot-029', 'usr-004', 28),
('refslot-030', 'usr-006', 29),
('refslot-031', 'usr-018', 30),
('refslot-032', 'usr-011', 31),
('refslot-033', 'usr-007', 32),
('refslot-034', 'usr-013', 33),
('refslot-035', 'usr-008', 34),
('refslot-036', 'usr-017', 35),
('refslot-037', 'usr-020', 36),
('refslot-038', 'usr-010', 37),
('refslot-039', 'usr-009', 38),
('refslot-040', 'usr-019', 39);

INSERT OR REPLACE INTO next_ref_state (event_id, current_ref_slot_id, status, running_balance, accepted_at, updated_at, created_at) VALUES
('evt-007', 'refslot-002', 'Pending Decision', 0, NULL, '2026-04-11T06:00:00Z', '2026-04-11T06:00:00Z');

INSERT OR REPLACE INTO next_ref_history (id, event_id, referee_user_id, final_balance, passed_json, accepted_at, completed_at) VALUES
('nrh-001', 'evt-003', 'usr-012', 0, '[]', '2026-04-11T05:00:00Z', '2026-04-11T05:00:00Z');

INSERT OR REPLACE INTO event_scores (event_id, grimace_score, opponent_score, updated_at, created_at) VALUES
('evt-001', 2, 2, '2026-03-14T07:00:00Z', '2026-03-14T07:00:00Z'),
('evt-002', 2, 6, '2026-03-28T07:00:00Z', '2026-03-28T07:00:00Z'),
('evt-003', 2, 2, '2026-04-11T07:00:00Z', '2026-04-11T07:00:00Z'),
('evt-004', 3, 2, '2026-04-18T07:00:00Z', '2026-04-18T07:00:00Z'),
('evt-005', 2, 2, '2026-04-22T07:00:00Z', '2026-04-22T07:00:00Z');
