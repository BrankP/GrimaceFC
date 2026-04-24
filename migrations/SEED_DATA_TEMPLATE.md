# Seed Data Worksheet

This worksheet now mirrors the current requested seed set.

## 1) `users` (20)
| id | name | nickname | created_year | created_at (ISO) |
|---|---|---|---:|---|
| usr-001 | Brad Fox |  | 2026 | 2026-01-01T00:00:00Z |
| usr-002 | Dan Hardyman |  | 2026 | 2026-01-01T00:00:00Z |
| usr-003 | Dylan Palmer |  | 2026 | 2026-01-01T00:00:00Z |
| usr-004 | Alex Truszewski |  | 2026 | 2026-01-01T00:00:00Z |
| usr-005 | Lochlan Browne |  | 2026 | 2026-01-01T00:00:00Z |
| usr-006 | Matt Paul |  | 2026 | 2026-01-01T00:00:00Z |
| usr-007 | Cale Whiting |  | 2026 | 2026-01-01T00:00:00Z |
| usr-008 | James Foley |  | 2026 | 2026-01-01T00:00:00Z |
| usr-009 | Alastair Cockerton |  | 2026 | 2026-01-01T00:00:00Z |
| usr-010 | Brendan Todd |  | 2026 | 2026-01-01T00:00:00Z |
| usr-011 | Hayden Enright |  | 2026 | 2026-01-01T00:00:00Z |
| usr-012 | Jack Gibson |  | 2026 | 2026-01-01T00:00:00Z |
| usr-013 | James West |  | 2026 | 2026-01-01T00:00:00Z |
| usr-014 | Justin Lever |  | 2026 | 2026-01-01T00:00:00Z |
| usr-015 | Troy Wynen |  | 2026 | 2026-01-01T00:00:00Z |
| usr-016 | Sam Bayly |  | 2026 | 2026-01-01T00:00:00Z |
| usr-017 | Brendan Jones |  | 2026 | 2026-01-01T00:00:00Z |
| usr-018 | Josh Gates |  | 2026 | 2026-01-01T00:00:00Z |
| usr-019 | Tom Jenkins |  | 2026 | 2026-01-01T00:00:00Z |
| usr-020 | Zac Reyes |  | 2026 | 2026-01-01T00:00:00Z |

## 2) `events` (15)
| id | event_type | date (ISO) | day_of_week | home_away | beer_duty_user_id | ref_duty_user_id | location | map_address | opponent | occasion | team_name | is_next_up |
|---|---|---|---|---|---|---|---|---|---|---|---|---:|
| evt-001 | Game | 2026-05-02T13:00:00Z | Saturday | Home | usr-009 |  | Brookvale | Millers Reserve | Brookvale | Game | Grimace FC | 1 |
| evt-002 | Game | 2026-05-09T15:00:00Z | Saturday | Away | usr-011 |  | Saint Augustine’s | Passmore Reserve | Saint Augustine’s | Game | Grimace FC | 0 |
| evt-003 | Game | 2026-05-16T13:00:00Z | Saturday | Away | usr-013 |  | Manly Vale | David Thomas Reserve | Manly Vale | Game | Grimace FC | 0 |
| evt-004 | Game | 2026-05-22T19:00:00Z | Friday | Home | usr-012 |  | Harbord | Millers Reserve | Harbord | Game | Grimace FC | 0 |
| evt-005 | Game | 2026-05-30T15:00:00Z | Saturday | Away | usr-014 |  | Wakehurst | Lionel Watts Oval | Wakehurst | Game | Grimace FC | 0 |
| evt-006 | Game | 2026-06-06T13:00:00Z | Saturday | Home | usr-016 |  | Curl Curl | Millers Reserve | Curl Curl | Game | Grimace FC | 0 |
| evt-007 | Game | 2026-06-13T15:00:00Z | Saturday | Home | usr-008 |  | Collaroy Cromer | Millers Reserve | Collaroy Cromer | Game | Grimace FC | 0 |
| evt-008 | Game | 2026-06-27T13:00:00Z | Saturday | Away | usr-007 |  | Curl Curl | Adam Street | Curl Curl | Game | Grimace FC | 0 |
| evt-009 | Game | 2026-07-04T13:00:00Z | Saturday | Home | usr-017 |  | Allambie | Beacon Hill Reserve | Allambie | Game | Grimace FC | 0 |
| evt-010 | Game | 2026-07-11T15:00:00Z | Saturday | Away | usr-003 |  | Brookvale | Grahams Reserve | Brookvale | Game | Grimace FC | 0 |
| evt-011 | Game | 2026-07-18T15:00:00Z | Saturday | Home | usr-001 |  | Saint Augustine’s | Beacon Hill Reserve | Saint Augustine’s | Game | Grimace FC | 0 |
| evt-012 | Game | 2026-07-25T13:00:00Z | Saturday | Home | usr-010 |  | Manly Vale | Millers Reserve | Manly Vale | Game | Grimace FC | 0 |
| evt-013 | Game | 2026-08-01T15:00:00Z | Saturday | Away | usr-004 |  | Harbord | Nolan Reserve | Harbord | Game | Grimace FC | 0 |
| evt-014 | Game | 2026-08-08T15:00:00Z | Saturday | Home | usr-019 |  | Wakehurst | Millers Reserve | Wakehurst | Game | Grimace FC | 0 |
| evt-015 | Game | 2026-08-15T13:00:00Z | Saturday | Away | usr-005 |  | Curl Curl | Adam Street | Curl Curl | Game | Grimace FC | 0 |

## 7) `ref_roster` (DB table stores 1 row per user)
| user_id | roster_order | created_at (ISO) |
|---|---:|---|
| usr-012 | 0 | 2026-01-01T00:00:00Z |
| usr-011 | 1 | 2026-01-01T00:00:00Z |
| usr-004 | 2 | 2026-01-01T00:00:00Z |
| usr-015 | 3 | 2026-01-01T00:00:00Z |
| usr-018 | 4 | 2026-01-01T00:00:00Z |
| usr-006 | 5 | 2026-01-01T00:00:00Z |
| usr-016 | 6 | 2026-01-01T00:00:00Z |
| usr-013 | 7 | 2026-01-01T00:00:00Z |
| usr-002 | 8 | 2026-01-01T00:00:00Z |
| usr-007 | 9 | 2026-01-01T00:00:00Z |
| usr-014 | 10 | 2026-01-01T00:00:00Z |
| usr-003 | 11 | 2026-01-01T00:00:00Z |
| usr-001 | 12 | 2026-01-01T00:00:00Z |
| usr-005 | 13 | 2026-01-01T00:00:00Z |
| usr-019 | 14 | 2026-01-01T00:00:00Z |
| usr-017 | 15 | 2026-01-01T00:00:00Z |
| usr-009 | 16 | 2026-01-01T00:00:00Z |
| usr-020 | 17 | 2026-01-01T00:00:00Z |
| usr-010 | 18 | 2026-01-01T00:00:00Z |
| usr-008 | 19 | 2026-01-01T00:00:00Z |

## Remaining tables
Messages, fines, availability, next_ref_state, next_ref_passes, and next_ref_history are currently blank/seed-minimal and can be expanded as needed.
