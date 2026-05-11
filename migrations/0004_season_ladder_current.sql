CREATE TABLE IF NOT EXISTS season_ladder_current (
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
);

CREATE INDEX IF NOT EXISTS idx_season_ladder_current_position ON season_ladder_current(position);
CREATE INDEX IF NOT EXISTS idx_season_ladder_current_updated_at ON season_ladder_current(updated_at);
