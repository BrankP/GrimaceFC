-- Adds lightweight per-player season totals used by Team Stats page.
-- Safe for production migration ordering (applied once via Wrangler migration history).
ALTER TABLE users ADD COLUMN goals INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN assists INTEGER NOT NULL DEFAULT 0;
