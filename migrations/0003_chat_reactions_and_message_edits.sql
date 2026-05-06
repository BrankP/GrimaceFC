CREATE TABLE IF NOT EXISTS message_reactions (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(message_id, user_id, emoji),
  FOREIGN KEY(message_id) REFERENCES messages(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_message_reactions_message ON message_reactions(message_id, emoji);
CREATE INDEX IF NOT EXISTS idx_message_reactions_user ON message_reactions(user_id);

-- D1/SQLite does not support IF NOT EXISTS for ADD COLUMN on all deployed versions.
-- The Worker bootstrap also performs this idempotently for already-migrated databases.
ALTER TABLE messages ADD COLUMN edited_at TEXT;
