CREATE TABLE IF NOT EXISTS event_scores (
  event_id TEXT PRIMARY KEY,
  grimace_score INTEGER NOT NULL CHECK(grimace_score >= 0),
  opponent_score INTEGER NOT NULL CHECK(opponent_score >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(event_id) REFERENCES events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS event_goal_details (
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
);

CREATE INDEX IF NOT EXISTS idx_event_goal_details_event_sort
  ON event_goal_details(event_id, sort_order, created_at);
