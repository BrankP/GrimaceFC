-- Seed data worksheet: see migrations/SEED_DATA_TEMPLATE.md
INSERT OR REPLACE INTO users (id, name, nickname, goals, assists, created_year, created_at) VALUES
('usr-001', 'Brad Fox', NULL, 8, 4, 2026, '2026-01-01T00:00:00Z'),
('usr-002', 'Dan Hardyman', NULL, 5, 7, 2026, '2026-01-01T00:00:00Z'),
('usr-003', 'Dylan Palmer', NULL, 6, 3, 2026, '2026-01-01T00:00:00Z'),
('usr-004', 'Alex Truszewski', NULL, 3, 5, 2026, '2026-01-01T00:00:00Z'),
('usr-005', 'Lochlan Browne', NULL, 4, 2, 2026, '2026-01-01T00:00:00Z'),
('usr-006', 'Matt Paul', NULL, 2, 6, 2026, '2026-01-01T00:00:00Z'),
('usr-007', 'Cale Whiting', NULL, 7, 1, 2026, '2026-01-01T00:00:00Z'),
('usr-008', 'James Foley', NULL, 1, 4, 2026, '2026-01-01T00:00:00Z'),
('usr-009', 'Alastair Cockerton', NULL, 0, 2, 2026, '2026-01-01T00:00:00Z'),
('usr-010', 'Brendan Todd', NULL, 2, 2, 2026, '2026-01-01T00:00:00Z'),
('usr-011', 'Hayden Enright', NULL, 3, 1, 2026, '2026-01-01T00:00:00Z'),
('usr-012', 'Jack Gibson', NULL, 5, 5, 2026, '2026-01-01T00:00:00Z'),
('usr-013', 'James West', NULL, 4, 3, 2026, '2026-01-01T00:00:00Z'),
('usr-014', 'Justin Lever', NULL, 1, 6, 2026, '2026-01-01T00:00:00Z'),
('usr-015', 'Troy Wynen', NULL, 2, 1, 2026, '2026-01-01T00:00:00Z'),
('usr-016', 'Sam Bayly', NULL, 6, 4, 2026, '2026-01-01T00:00:00Z'),
('usr-017', 'Brendan Jones', NULL, 3, 3, 2026, '2026-01-01T00:00:00Z'),
('usr-018', 'Josh Gates', NULL, 2, 0, 2026, '2026-01-01T00:00:00Z'),
('usr-019', 'Tom Jenkins', NULL, 1, 1, 2026, '2026-01-01T00:00:00Z'),
('usr-020', 'Zac Reyes', NULL, 0, 3, 2026, '2026-01-01T00:00:00Z');

INSERT OR REPLACE INTO events (id, event_type, date, day_of_week, home_away, beer_duty_user_id, ref_duty_user_id, location, map_address, opponent, occasion, team_name, is_next_up) VALUES
('evt-001', 'Game', '2026-05-02T13:00:00Z', 'Saturday', 'Home', 'usr-009', NULL, 'Brookvale', 'Millers Reserve', 'Brookvale', 'Game', 'Grimace FC', 1),
('evt-002', 'Game', '2026-05-09T15:00:00Z', 'Saturday', 'Away', 'usr-011', NULL, 'Saint Augustine''s', 'Passmore Reserve', 'Saint Augustine''s', 'Game', 'Grimace FC', 0),
('evt-003', 'Game', '2026-05-16T13:00:00Z', 'Saturday', 'Away', 'usr-013', NULL, 'Manly Vale', 'David Thomas Reserve', 'Manly Vale', 'Game', 'Grimace FC', 0),
('evt-004', 'Game', '2026-05-22T19:00:00Z', 'Friday', 'Home', 'usr-012', NULL, 'Harbord', 'Millers Reserve', 'Harbord', 'Game', 'Grimace FC', 0),
('evt-005', 'Game', '2026-05-30T15:00:00Z', 'Saturday', 'Away', 'usr-014', NULL, 'Wakehurst', 'Lionel Watts Oval', 'Wakehurst', 'Game', 'Grimace FC', 0),
('evt-006', 'Game', '2026-06-06T13:00:00Z', 'Saturday', 'Home', 'usr-016', NULL, 'Curl Curl', 'Millers Reserve', 'Curl Curl', 'Game', 'Grimace FC', 0),
('evt-007', 'Game', '2026-06-13T15:00:00Z', 'Saturday', 'Home', 'usr-008', NULL, 'Collaroy Cromer', 'Millers Reserve', 'Collaroy Cromer', 'Game', 'Grimace FC', 0),
('evt-008', 'Game', '2026-06-27T13:00:00Z', 'Saturday', 'Away', 'usr-007', NULL, 'Curl Curl', 'Adam Street', 'Curl Curl', 'Game', 'Grimace FC', 0),
('evt-009', 'Game', '2026-07-04T13:00:00Z', 'Saturday', 'Home', 'usr-017', NULL, 'Allambie', 'Beacon Hill Reserve', 'Allambie', 'Game', 'Grimace FC', 0),
('evt-010', 'Game', '2026-07-11T15:00:00Z', 'Saturday', 'Away', 'usr-003', NULL, 'Brookvale', 'Grahams Reserve', 'Brookvale', 'Game', 'Grimace FC', 0),
('evt-011', 'Game', '2026-07-18T15:00:00Z', 'Saturday', 'Home', 'usr-001', NULL, 'Saint Augustine''s', 'Beacon Hill Reserve', 'Saint Augustine''s', 'Game', 'Grimace FC', 0),
('evt-012', 'Game', '2026-07-25T13:00:00Z', 'Saturday', 'Home', 'usr-010', NULL, 'Manly Vale', 'Millers Reserve', 'Manly Vale', 'Game', 'Grimace FC', 0),
('evt-013', 'Game', '2026-08-01T15:00:00Z', 'Saturday', 'Away', 'usr-004', NULL, 'Harbord', 'Nolan Reserve', 'Harbord', 'Game', 'Grimace FC', 0),
('evt-014', 'Game', '2026-08-08T15:00:00Z', 'Saturday', 'Home', 'usr-019', NULL, 'Wakehurst', 'Millers Reserve', 'Wakehurst', 'Game', 'Grimace FC', 0),
('evt-015', 'Game', '2026-08-15T13:00:00Z', 'Saturday', 'Away', 'usr-005', NULL, 'Curl Curl', 'Adam Street', 'Curl Curl', 'Game', 'Grimace FC', 0);

INSERT OR REPLACE INTO lineups (id, event_id, formation, positions_json, subs_json, not_available_json, beer_duty_user_id, ref_duty_user_id, updated_at) VALUES
('lineup-evt-001', 'evt-001', '4-3-3', '{}', '[]', '[]', NULL, NULL, '2026-01-01T00:00:00Z');

INSERT OR REPLACE INTO ref_roster (id, user_id, roster_order, created_at) VALUES
('refslot-001', 'usr-012', 0, '2026-01-01T00:00:00Z'),
('refslot-002', 'usr-011', 1, '2026-01-01T00:00:00Z'),
('refslot-003', 'usr-004', 2, '2026-01-01T00:00:00Z'),
('refslot-004', 'usr-015', 3, '2026-01-01T00:00:00Z'),
('refslot-005', 'usr-018', 4, '2026-01-01T00:00:00Z'),
('refslot-006', 'usr-006', 5, '2026-01-01T00:00:00Z'),
('refslot-007', 'usr-016', 6, '2026-01-01T00:00:00Z'),
('refslot-008', 'usr-013', 7, '2026-01-01T00:00:00Z'),
('refslot-009', 'usr-002', 8, '2026-01-01T00:00:00Z'),
('refslot-010', 'usr-007', 9, '2026-01-01T00:00:00Z'),
('refslot-011', 'usr-014', 10, '2026-01-01T00:00:00Z'),
('refslot-012', 'usr-003', 11, '2026-01-01T00:00:00Z'),
('refslot-013', 'usr-001', 12, '2026-01-01T00:00:00Z'),
('refslot-014', 'usr-005', 13, '2026-01-01T00:00:00Z'),
('refslot-015', 'usr-019', 14, '2026-01-01T00:00:00Z'),
('refslot-016', 'usr-017', 15, '2026-01-01T00:00:00Z'),
('refslot-017', 'usr-009', 16, '2026-01-01T00:00:00Z'),
('refslot-018', 'usr-020', 17, '2026-01-01T00:00:00Z'),
('refslot-019', 'usr-010', 18, '2026-01-01T00:00:00Z'),
('refslot-020', 'usr-008', 19, '2026-01-01T00:00:00Z'),
('refslot-021', 'usr-016', 20, '2026-01-01T00:00:00Z'),
('refslot-022', 'usr-001', 21, '2026-01-01T00:00:00Z'),
('refslot-023', 'usr-014', 22, '2026-01-01T00:00:00Z'),
('refslot-024', 'usr-005', 23, '2026-01-01T00:00:00Z'),
('refslot-025', 'usr-012', 24, '2026-01-01T00:00:00Z'),
('refslot-026', 'usr-015', 25, '2026-01-01T00:00:00Z'),
('refslot-027', 'usr-003', 26, '2026-01-01T00:00:00Z'),
('refslot-028', 'usr-002', 27, '2026-01-01T00:00:00Z'),
('refslot-029', 'usr-004', 28, '2026-01-01T00:00:00Z'),
('refslot-030', 'usr-006', 29, '2026-01-01T00:00:00Z'),
('refslot-031', 'usr-018', 30, '2026-01-01T00:00:00Z'),
('refslot-032', 'usr-011', 31, '2026-01-01T00:00:00Z'),
('refslot-033', 'usr-007', 32, '2026-01-01T00:00:00Z'),
('refslot-034', 'usr-013', 33, '2026-01-01T00:00:00Z'),
('refslot-035', 'usr-008', 34, '2026-01-01T00:00:00Z'),
('refslot-036', 'usr-017', 35, '2026-01-01T00:00:00Z'),
('refslot-037', 'usr-020', 36, '2026-01-01T00:00:00Z'),
('refslot-038', 'usr-010', 37, '2026-01-01T00:00:00Z'),
('refslot-039', 'usr-009', 38, '2026-01-01T00:00:00Z'),
('refslot-040', 'usr-019', 39, '2026-01-01T00:00:00Z');

DELETE FROM next_ref_passes;
DELETE FROM next_ref_history;
DELETE FROM next_ref_state;
-- NOTE:
-- Do not seed a fixed next_ref_state row here.
-- Some long-lived databases still retain a legacy NOT NULL current_user_id column
-- alongside current_ref_slot_id, and writing only the newer shape can fail.
-- The worker initializes next_ref_state lazily from roster + events when needed.
