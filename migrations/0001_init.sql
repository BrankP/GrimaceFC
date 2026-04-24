CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  nickname TEXT,
  created_year INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
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
  team_name TEXT NOT NULL,
  is_next_up INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(beer_duty_user_id) REFERENCES users(id),
  FOREIGN KEY(ref_duty_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
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
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(event_id) REFERENCES events(id),
  FOREIGN KEY(beer_duty_user_id) REFERENCES users(id),
  FOREIGN KEY(ref_duty_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS availability (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('available','not_available')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(event_id, user_id),
  FOREIGN KEY(event_id) REFERENCES events(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS ref_roster (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  roster_order INTEGER NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS next_ref_state (
  event_id TEXT PRIMARY KEY,
  current_ref_slot_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('Pending Decision','Accepted')),
  running_balance INTEGER NOT NULL DEFAULT 0,
  accepted_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(event_id) REFERENCES events(id),
  FOREIGN KEY(current_ref_slot_id) REFERENCES ref_roster(id)
);

CREATE TABLE IF NOT EXISTS next_ref_passes (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  passed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(event_id) REFERENCES events(id),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS next_ref_history (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  referee_user_id TEXT NOT NULL,
  final_balance INTEGER NOT NULL,
  passed_json TEXT NOT NULL,
  accepted_at TEXT,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(event_id) REFERENCES events(id),
  FOREIGN KEY(referee_user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_availability_event_user ON availability(event_id, user_id);
CREATE INDEX IF NOT EXISTS idx_ref_roster_order ON ref_roster(roster_order);
CREATE INDEX IF NOT EXISTS idx_next_ref_passes_event ON next_ref_passes(event_id, passed_at);
CREATE INDEX IF NOT EXISTS idx_next_ref_history_completed ON next_ref_history(completed_at DESC);
