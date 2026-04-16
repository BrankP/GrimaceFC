INSERT OR REPLACE INTO users (id, name, nickname, created_year, created_at) VALUES
('usr-001', 'Alex Carter', 'Aces', 2025, '2025-03-02T10:10:00Z'),
('usr-002', 'Ben Singh', 'Benny', 2025, '2025-03-04T17:20:00Z'),
('usr-003', 'Cory Miles', 'C-Mile', 2025, '2025-04-10T09:30:00Z'),
('usr-004', 'Devon Price', 'D-Train', 2025, '2025-04-19T15:42:00Z'),
('usr-005', 'Eli Moreno', 'Mo', 2025, '2025-05-23T13:09:00Z');

INSERT OR REPLACE INTO events (id, event_type, date, day_of_week, home_away, duties, location, opponent, occasion, team_name, is_next_up) VALUES
('evt-001', 'Game', '2026-04-20T19:00:00Z', 'Monday', 'Home', 'Set up cones', 'Riverside Turf', 'Purple Comets', NULL, 'Grimace FC', 1),
('evt-002', 'Sesh', '2026-04-27T18:30:00Z', 'Monday', NULL, NULL, 'Riverside Turf', NULL, 'Passing circuits', 'Grimace FC', 0),
('evt-003', 'Game', '2026-05-04T19:15:00Z', 'Monday', 'Away', 'Bring bibs', 'Harbor Park', 'City Rovers', NULL, 'Grimace FC', 0),
('evt-004', 'Sesh', '2026-05-11T18:45:00Z', 'Monday', NULL, NULL, 'Central Dome', NULL, 'Set-piece practice', 'Grimace FC', 0),
('evt-005', 'Game', '2026-05-18T20:00:00Z', 'Monday', 'Home', 'Scoreboard', 'Riverside Turf', 'Late Kickers', NULL, 'Grimace FC', 0);

INSERT OR REPLACE INTO messages (id, user_id, text, created_at) VALUES
('msg-001', 'usr-001', 'Who''s bringing the new balls on Monday?', '2026-04-10T16:00:00Z'),
('msg-002', 'usr-002', 'I got it. Also cones are in my boot.', '2026-04-10T16:05:00Z'),
('msg-003', 'usr-004', 'Can we start 15 mins earlier?', '2026-04-10T16:20:00Z'),
('msg-004', 'usr-003', 'I''m in. Need to test my new studs.', '2026-04-10T16:32:00Z'),
('msg-005', 'usr-005', 'I''ll bring tape and bibs.', '2026-04-10T16:41:00Z');

INSERT OR REPLACE INTO fines (id, who_user_id, amount, reason, submitted_by_user_id, submitted_at) VALUES
('fine-001', 'usr-001', 5, 'Late to warmup', 'usr-002', '2026-04-01T18:20:00Z'),
('fine-002', 'usr-004', 2, 'Forgot shin pads', 'usr-003', '2026-04-03T18:40:00Z'),
('fine-003', 'usr-003', 4, 'Nutmegged in rondo', 'usr-001', '2026-04-05T19:05:00Z'),
('fine-004', 'usr-005', 6, 'Missed sitter', 'usr-004', '2026-04-08T20:00:00Z'),
('fine-005', 'usr-002', 3, 'Own goal', 'usr-005', '2026-04-10T20:15:00Z');

INSERT OR REPLACE INTO lineups (id, event_id, formation, positions_json, subs_json, not_available_json, updated_at) VALUES
('lineup-evt-001', 'evt-001', '4-3-3', '{"GK":"usr-001","LB":"usr-002","LCB":"usr-003","RCB":"usr-004","RB":null,"LCM":"usr-005","CM":null,"RCM":null,"LW":null,"ST":null,"RW":null}', '["usr-002","usr-003","usr-004","usr-005"]', '[]', '2026-04-11T12:00:00Z'),
('lineup-evt-003', 'evt-003', '4-3-3', '{"GK":null,"LB":null,"LCB":null,"RCB":null,"RB":null,"LCM":null,"CM":null,"RCM":null,"LW":null,"ST":null,"RW":null}', '["usr-001","usr-002","usr-003","usr-004","usr-005"]', '[]', '2026-04-11T12:00:00Z'),
('lineup-evt-005', 'evt-005', '4-3-3', '{"GK":null,"LB":null,"LCB":null,"RCB":null,"RB":null,"LCM":null,"CM":null,"RCM":null,"LW":null,"ST":null,"RW":null}', '["usr-001","usr-003","usr-005"]', '["usr-002"]', '2026-04-12T12:00:00Z'),
('lineup-evt-archive-01', 'evt-001', '4-3-3', '{"GK":"usr-005","LB":null,"LCB":null,"RCB":null,"RB":null,"LCM":null,"CM":null,"RCM":null,"LW":null,"ST":null,"RW":null}', '["usr-001","usr-002"]', '["usr-004"]', '2026-03-01T12:00:00Z'),
('lineup-evt-archive-02', 'evt-003', '4-3-3', '{"GK":null,"LB":null,"LCB":null,"RCB":null,"RB":null,"LCM":null,"CM":null,"RCM":null,"LW":"usr-003","ST":null,"RW":null}', '["usr-001","usr-005"]', '[]', '2026-03-15T12:00:00Z');

INSERT OR REPLACE INTO availability (id, event_id, user_id, status, updated_at) VALUES
('avail-101', 'evt-001', 'usr-001', 'not_available', '2026-04-10T10:00:00Z'),
('avail-102', 'evt-001', 'usr-002', 'not_available', '2026-04-10T10:00:00Z'),
('avail-103', 'evt-001', 'usr-003', 'not_available', '2026-04-10T10:00:00Z'),
('avail-104', 'evt-001', 'usr-004', 'not_available', '2026-04-10T10:00:00Z'),
('avail-105', 'evt-001', 'usr-005', 'not_available', '2026-04-10T10:00:00Z');
