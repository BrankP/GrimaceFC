ALTER TABLE users ADD COLUMN notification_preference TEXT NOT NULL DEFAULT 'all_chats' CHECK(notification_preference IN ('all_chats','tagged_only','disabled'));
