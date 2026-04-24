PRAGMA foreign_keys=OFF;

CREATE TABLE IF NOT EXISTS ref_roster_new (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  roster_order INTEGER NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id)
);

INSERT INTO ref_roster_new (id, user_id, roster_order, created_at)
SELECT 'refslot-migrated-' || printf('%03d', roster_order + 1), user_id, roster_order, created_at
FROM ref_roster
ORDER BY roster_order ASC, created_at ASC;

DROP TABLE ref_roster;
ALTER TABLE ref_roster_new RENAME TO ref_roster;

CREATE INDEX IF NOT EXISTS idx_ref_roster_order ON ref_roster(roster_order);

PRAGMA foreign_keys=ON;
