INSERT OR REPLACE INTO users (id, name, nickname, created_year, created_at) VALUES
('usr-001', 'Alastair Cockerton', NULL, 2026, '2026-03-02T10:10:00Z'),
('usr-002', 'Cale Whiting', NULL, 2026, '2026-03-04T17:20:00Z'),
('usr-003', 'Brendan Jones', NULL, 2026, '2026-03-10T09:30:00Z'),
('usr-004', 'Brendan Todd', NULL, 2026, '2026-03-19T15:42:00Z'),
('usr-005', 'Brad Fox', NULL, 2026, '2026-03-23T13:09:00Z'),
('usr-006', 'Jack Gibson', NULL, 2026, '2026-03-25T13:09:00Z'),
('usr-007', 'James Foley', NULL, 2026, '2026-03-27T13:09:00Z'),
('usr-008', 'James West', NULL, 2026, '2026-03-29T13:09:00Z'),
('usr-009', 'Josh Gates', NULL, 2026, '2026-03-31T13:09:00Z'),
('usr-010', 'Justin Lever', NULL, 2026, '2026-04-02T13:09:00Z'),
('usr-011', 'Matt Paul', NULL, 2026, '2026-04-04T13:09:00Z'),
('usr-012', 'Sam Bayly', NULL, 2026, '2026-04-06T13:09:00Z'),
('usr-013', 'Tom Jenkins', NULL, 2026, '2026-04-08T13:09:00Z');

INSERT OR REPLACE INTO events (id, event_type, date, day_of_week, home_away, beer_duty_user_id, ref_duty_user_id, location, opponent, occasion, team_name, is_next_up) VALUES
('evt-001', 'Game', '2026-04-18T15:00:00Z', 'Saturday', 'Home', 'usr-001', 'usr-003', 'Riverside Turf', 'Curl Curl A', NULL, 'Grimace FC', 1),
('evt-002', 'Game', '2026-04-22T19:00:00Z', 'Wednesday', 'Home', 'usr-002', 'usr-004', 'Riverside Turf', 'ABH United A', NULL, 'Grimace FC', 0),
('evt-003', 'Sesh', '2026-04-25T10:00:00Z', 'Saturday', NULL, NULL, NULL, 'Clubhouse', NULL, 'Anzac Day Pissup', 'Grimace FC', 0),
('evt-004', 'Game', '2026-05-02T13:00:00Z', 'Saturday', 'Away', 'usr-005', 'usr-001', 'Brookvale Oval', 'Brookvale', NULL, 'Grimace FC', 0),
('evt-005', 'Game', '2026-05-09T15:00:00Z', 'Saturday', 'Home', 'usr-003', 'usr-002', 'Riverside Turf', 'St Augustines', NULL, 'Grimace FC', 0),
('evt-006', 'Game', '2026-05-16T13:00:00Z', 'Saturday', 'Away', 'usr-004', 'usr-005', 'Manly Vale Park', 'Manly Vale', NULL, 'Grimace FC', 0),
('evt-007', 'Game', '2026-05-22T19:00:00Z', 'Friday', 'Home', 'usr-001', 'usr-002', 'Riverside Turf', 'Harbord FC', NULL, 'Grimace FC', 0);

INSERT OR REPLACE INTO messages (id, user_id, text, created_at) VALUES
('msg-001', 'usr-001', 'Who can bring the cones for Curl Curl this Saturday?', '2026-04-14T16:00:00Z'),
('msg-002', 'usr-002', 'I can bring cones and bibs.', '2026-04-14T16:05:00Z'),
('msg-003', 'usr-004', 'I''ll be late on Wednesday, save me a spot.', '2026-04-15T16:20:00Z'),
('msg-004', 'usr-003', 'Anzac Day Pissup attendance check?', '2026-04-16T16:32:00Z'),
('msg-005', 'usr-005', 'I''ve got tape and ice packs covered.', '2026-04-16T16:41:00Z');

INSERT OR REPLACE INTO fines (id, who_user_id, amount, reason, submitted_by_user_id, submitted_at) VALUES
('fine-001', 'usr-001', 5, 'Late to warm-up', 'usr-002', '2026-04-01T18:20:00Z'),
('fine-002', 'usr-004', 2, 'Forgot shin pads', 'usr-003', '2026-04-03T18:40:00Z'),
('fine-003', 'usr-003', 4, 'Nutmegged in rondo', 'usr-001', '2026-04-05T19:05:00Z'),
('fine-004', 'usr-005', 6, 'Missed sitter', 'usr-004', '2026-04-08T20:00:00Z'),
('fine-005', 'usr-002', 3, 'Own goal', 'usr-005', '2026-04-10T20:15:00Z');

INSERT OR REPLACE INTO lineups (id, event_id, formation, positions_json, subs_json, not_available_json, beer_duty_user_id, ref_duty_user_id, updated_at) VALUES
('lineup-evt-001', 'evt-001', '4-3-3', '{"GK":"usr-001","LB":"usr-002","LCB":"usr-003","RCB":"usr-004","RB":null,"LCM":"usr-005","CM":null,"RCM":null,"LW":null,"ST":null,"RW":null}', '["usr-002","usr-003","usr-004","usr-005"]', '[]', 'usr-001', 'usr-003', '2026-04-17T12:00:00Z'),
('lineup-evt-002', 'evt-002', '4-3-3', '{"GK":"usr-001","LB":null,"LCB":"usr-003","RCB":null,"RB":"usr-004","LCM":null,"CM":"usr-002","RCM":null,"LW":"usr-005","ST":null,"RW":null}', '["usr-004","usr-005"]', '["usr-003"]', 'usr-002', 'usr-004', '2026-04-17T12:00:00Z'),
('lineup-evt-004', 'evt-004', '4-3-3', '{"GK":"usr-001","LB":"usr-002","LCB":null,"RCB":"usr-004","RB":null,"LCM":"usr-003","CM":"usr-005","RCM":null,"LW":null,"ST":null,"RW":null}', '["usr-002","usr-003","usr-005"]', '[]', 'usr-005', 'usr-001', '2026-04-17T12:00:00Z'),
('lineup-evt-005', 'evt-005', '4-3-3', '{"GK":null,"LB":null,"LCB":null,"RCB":null,"RB":null,"LCM":null,"CM":null,"RCM":null,"LW":null,"ST":null,"RW":null}', '["usr-001","usr-003","usr-005"]', '["usr-002"]', 'usr-003', 'usr-002', '2026-04-17T12:00:00Z'),
('lineup-evt-006', 'evt-006', '4-3-3', '{"GK":"usr-005","LB":null,"LCB":"usr-003","RCB":null,"RB":"usr-002","LCM":null,"CM":"usr-001","RCM":null,"LW":null,"ST":"usr-004","RW":null}', '["usr-001","usr-002"]', '["usr-004"]', 'usr-004', 'usr-005', '2026-04-17T12:00:00Z');

INSERT OR REPLACE INTO availability (id, event_id, user_id, status, updated_at) VALUES
('avail-101', 'evt-001', 'usr-001', 'available', '2026-04-16T10:00:00Z'),
('avail-102', 'evt-001', 'usr-002', 'available', '2026-04-16T10:00:00Z'),
('avail-103', 'evt-001', 'usr-003', 'not_available', '2026-04-16T10:00:00Z'),
('avail-104', 'evt-002', 'usr-004', 'available', '2026-04-16T10:00:00Z'),
('avail-105', 'evt-003', 'usr-005', 'available', '2026-04-16T10:00:00Z');
