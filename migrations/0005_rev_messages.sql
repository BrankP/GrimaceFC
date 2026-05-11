-- Persist whether a chat message should use the featured Rev card treatment.
ALTER TABLE messages ADD COLUMN message_type TEXT NOT NULL DEFAULT 'normal' CHECK(message_type IN ('normal','rev'));
