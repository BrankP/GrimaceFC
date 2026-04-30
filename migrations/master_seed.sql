PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  nickname TEXT,
  created_year INTEGER NOT NULL,
  created_at TEXT NOT NULL
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
  team_name TEXT NOT NULL,
  is_next_up INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ref_roster (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  roster_order INTEGER NOT NULL UNIQUE,
  created_at TEXT NOT NULL
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
  created_at TEXT NOT NULL
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

DELETE FROM next_ref_state;
DELETE FROM next_ref_history;
DELETE FROM ref_roster;
DELETE FROM availability;
DELETE FROM lineups;
DELETE FROM messages;
DELETE FROM event_scores;
DELETE FROM push_notification_queue;
DELETE FROM push_subscriptions;
DELETE FROM events;
DELETE FROM users;

INSERT OR REPLACE INTO users (id, name, nickname, created_year, created_at, notification_preference) VALUES
('usr-001', 'Brad Fox', NULL, 2026, '2026-01-01T00:00:00Z', 'all_chats'),
('usr-002', 'Dan Hardyman', NULL, 2026, '2026-01-01T00:00:00Z', 'all_chats'),
('usr-003', 'Dylan Palmer', NULL, 2026, '2026-01-01T00:00:00Z', 'all_chats'),
('usr-004', 'Alex Truszewski', NULL, 2026, '2026-01-01T00:00:00Z', 'all_chats'),
('usr-005', 'Lochlan Browne', NULL, 2026, '2026-01-01T00:00:00Z', 'all_chats'),
('usr-006', 'Matt Paul', NULL, 2026, '2026-01-01T00:00:00Z', 'all_chats'),
('usr-007', 'Cale Whiting', NULL, 2026, '2026-01-01T00:00:00Z', 'all_chats'),
('usr-008', 'James Foley', NULL, 2026, '2026-01-01T00:00:00Z', 'all_chats'),
('usr-009', 'Alastair Cockerton', NULL, 2026, '2026-01-01T00:00:00Z', 'all_chats'),
('usr-010', 'Brendan Todd', NULL, 2026, '2026-01-01T00:00:00Z', 'all_chats'),
('usr-011', 'Hayden Enright', NULL, 2026, '2026-01-01T00:00:00Z', 'all_chats'),
('usr-012', 'Jack Gibson', NULL, 2026, '2026-01-01T00:00:00Z', 'all_chats'),
('usr-013', 'James West', NULL, 2026, '2026-01-01T00:00:00Z', 'all_chats'),
('usr-014', 'Justin Lever', NULL, 2026, '2026-01-01T00:00:00Z', 'all_chats'),
('usr-015', 'Troy Wynen', NULL, 2026, '2026-01-01T00:00:00Z', 'all_chats'),
('usr-016', 'Sam Bayly', NULL, 2026, '2026-01-01T00:00:00Z', 'all_chats'),
('usr-017', 'Brendan Jones', NULL, 2026, '2026-01-01T00:00:00Z', 'all_chats'),
('usr-018', 'Josh Gates', NULL, 2026, '2026-01-01T00:00:00Z', 'all_chats'),
('usr-019', 'Tom Jenkins', NULL, 2026, '2026-01-01T00:00:00Z', 'all_chats'),
('usr-020', 'Zac Reyes', NULL, 2026, '2026-01-01T00:00:00Z', 'all_chats');

INSERT OR REPLACE INTO events (id, event_type, date, day_of_week, home_away, beer_duty_user_id, ref_duty_user_id, location, map_address, opponent, occasion, team_name, is_next_up) VALUES
('evt-001', 'Game', '2026-03-14T05:00:00Z', 'Saturday', 'Home', NULL, NULL, 'ABH United 2026', 'Tristram Road Reserve', 'ABH United AL6A''s', 'Trial Match', 'Grimace FC', 0),
('evt-002', 'Game', '2026-03-28T05:00:00Z', 'Saturday', 'Home', NULL, NULL, 'ABH United 2026', 'Tristram Road Reserve', 'ABH United AL6A''s', 'Trial Match', 'Grimace FC', 0),
('evt-003', 'Game', '2026-04-11T05:00:00Z', 'Saturday', 'Away', 'usr-020', 'usr-012', 'CC Strikers', NULL, 'CC Strikers', 'Game', 'Grimace FC', 0),
('evt-004', 'Game', '2026-04-18T05:00:00Z', 'Saturday', 'Home', 'usr-006', NULL, 'ABH United 2026', NULL, 'Curl Curl A', 'Game', 'Grimace FC', 0),
('evt-005', 'Game', '2026-04-22T05:00:00Z', 'Wednesday', 'Away', 'usr-015', NULL, 'ABH United A', NULL, 'ABH United A', 'Game', 'Grimace FC', 0),
('evt-006', 'Sesh', '2026-04-25T00:00:00Z', 'Saturday', NULL, NULL, NULL, '', NULL, NULL, 'Grimaces 2-up Spectacular', 'Grimace FC', 0),
('evt-007', 'Game', '2026-05-02T13:00:00Z', 'Saturday', 'Home', 'usr-009', NULL, 'Brookvale', 'Millers Reserve', 'Brookvale', 'Game', 'Grimace FC', 1),
('evt-008', 'Game', '2026-05-09T15:00:00Z', 'Saturday', 'Away', 'usr-011', NULL, 'Saint Augustine’s', 'Passmore Reserve', 'Saint Augustine’s', 'Game', 'Grimace FC', 0),
('evt-009', 'Game', '2026-05-16T13:00:00Z', 'Saturday', 'Away', 'usr-013', NULL, 'Manly Vale', 'David Thomas Reserve', 'Manly Vale', 'Game', 'Grimace FC', 0),
('evt-010', 'Game', '2026-05-22T19:00:00Z', 'Friday', 'Home', 'usr-012', NULL, 'Harbord', 'Millers Reserve', 'Harbord', 'Game', 'Grimace FC', 0),
('evt-011', 'Game', '2026-05-30T15:00:00Z', 'Saturday', 'Away', 'usr-014', NULL, 'Wakehurst', 'Lionel Watts Oval', 'Wakehurst', 'Game', 'Grimace FC', 0),
('evt-012', 'Game', '2026-06-06T13:00:00Z', 'Saturday', 'Home', 'usr-016', NULL, 'Curl Curl', 'Millers Reserve', 'Curl Curl', 'Game', 'Grimace FC', 0),
('evt-013', 'Game', '2026-06-13T15:00:00Z', 'Saturday', 'Home', 'usr-008', NULL, 'Collaroy Cromer', 'Millers Reserve', 'Collaroy Cromer', 'Game', 'Grimace FC', 0),
('evt-014', 'Game', '2026-06-27T13:00:00Z', 'Saturday', 'Away', 'usr-007', NULL, 'Curl Curl', 'Adam Street Reserve', 'Curl Curl', 'Game', 'Grimace FC', 0),
('evt-015', 'Game', '2026-07-04T13:00:00Z', 'Saturday', 'Home', 'usr-017', NULL, 'Allambie', 'Beacon Hill Reserve', 'Allambie', 'Game', 'Grimace FC', 0),
('evt-016', 'Game', '2026-07-11T15:00:00Z', 'Saturday', 'Away', 'usr-003', NULL, 'Brookvale', 'Grahams Reserve', 'Brookvale', 'Game', 'Grimace FC', 0),
('evt-017', 'Game', '2026-07-18T15:00:00Z', 'Saturday', 'Home', 'usr-001', NULL, 'Saint Augustine’s', 'Beacon Hill Reserve', 'Saint Augustine’s', 'Game', 'Grimace FC', 0),
('evt-018', 'Game', '2026-07-25T13:00:00Z', 'Saturday', 'Home', 'usr-010', NULL, 'Manly Vale', 'Millers Reserve', 'Manly Vale', 'Game', 'Grimace FC', 0),
('evt-019', 'Game', '2026-08-01T15:00:00Z', 'Saturday', 'Away', 'usr-004', NULL, 'Harbord', 'Nolan Reserve', 'Harbord', 'Game', 'Grimace FC', 0),
('evt-020', 'Game', '2026-08-08T15:00:00Z', 'Saturday', 'Home', 'usr-019', NULL, 'Wakehurst', 'Millers Reserve', 'Wakehurst', 'Game', 'Grimace FC', 0),
('evt-021', 'Game', '2026-08-15T13:00:00Z', 'Saturday', 'Away', 'usr-005', NULL, 'Curl Curl', 'Adam Street Reserve', 'Curl Curl', 'Game', 'Grimace FC', 0);

INSERT OR REPLACE INTO ref_roster (id, user_id, roster_order, created_at) VALUES
('refslot-001', 'usr-012', 0, '2026-01-01T00:00:00Z'),
('refslot-002', 'usr-011', 1, '2026-01-01T00:00:00Z'),
('refslot-003', 'usr-004', 2, '2026-01-01T00:00:00Z'),
('refslot-004', 'usr-015', 3, '2026-01-01T00:00:00Z'),
('refslot-005', 'usr-018', 4, '2026-01-01T00:00:00Z'),
('refslot-006', 'usr-006', 5, '2026-01-01T00:00:00Z'),
('refslot-007', 'usr-016', 6, '2026-01-01T00:00:00Z'),
('refslot-008', 'usr-013', 7, '2026-01-01T00:00:00Z'),
('refslot-009', 'usr-002', 8, '2026-01-01T00:00:00Z'),
('refslot-010', 'usr-007', 9, '2026-01-01T00:00:00Z'),
('refslot-011', 'usr-014', 10, '2026-01-01T00:00:00Z'),
('refslot-012', 'usr-003', 11, '2026-01-01T00:00:00Z'),
('refslot-013', 'usr-001', 12, '2026-01-01T00:00:00Z'),
('refslot-014', 'usr-005', 13, '2026-01-01T00:00:00Z'),
('refslot-015', 'usr-019', 14, '2026-01-01T00:00:00Z'),
('refslot-016', 'usr-017', 15, '2026-01-01T00:00:00Z'),
('refslot-017', 'usr-009', 16, '2026-01-01T00:00:00Z'),
('refslot-018', 'usr-020', 17, '2026-01-01T00:00:00Z'),
('refslot-019', 'usr-010', 18, '2026-01-01T00:00:00Z'),
('refslot-020', 'usr-008', 19, '2026-01-01T00:00:00Z'),
('refslot-021', 'usr-016', 20, '2026-01-01T00:00:00Z'),
('refslot-022', 'usr-001', 21, '2026-01-01T00:00:00Z'),
('refslot-023', 'usr-014', 22, '2026-01-01T00:00:00Z'),
('refslot-024', 'usr-005', 23, '2026-01-01T00:00:00Z'),
('refslot-025', 'usr-012', 24, '2026-01-01T00:00:00Z'),
('refslot-026', 'usr-015', 25, '2026-01-01T00:00:00Z'),
('refslot-027', 'usr-003', 26, '2026-01-01T00:00:00Z'),
('refslot-028', 'usr-002', 27, '2026-01-01T00:00:00Z'),
('refslot-029', 'usr-004', 28, '2026-01-01T00:00:00Z'),
('refslot-030', 'usr-006', 29, '2026-01-01T00:00:00Z'),
('refslot-031', 'usr-018', 30, '2026-01-01T00:00:00Z'),
('refslot-032', 'usr-011', 31, '2026-01-01T00:00:00Z'),
('refslot-033', 'usr-007', 32, '2026-01-01T00:00:00Z'),
('refslot-034', 'usr-013', 33, '2026-01-01T00:00:00Z'),
('refslot-035', 'usr-008', 34, '2026-01-01T00:00:00Z'),
('refslot-036', 'usr-017', 35, '2026-01-01T00:00:00Z'),
('refslot-037', 'usr-020', 36, '2026-01-01T00:00:00Z'),
('refslot-038', 'usr-010', 37, '2026-01-01T00:00:00Z'),
('refslot-039', 'usr-009', 38, '2026-01-01T00:00:00Z'),
('refslot-040', 'usr-019', 39, '2026-01-01T00:00:00Z');

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
