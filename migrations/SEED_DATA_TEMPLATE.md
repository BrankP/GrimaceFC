# Seed Data Worksheet

Use this worksheet to provide fresh seed data. Fill in rows in each table section, then I can convert this directly back into `migrations/0002_seed.sql`.

## 1) `users`
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

## 2) `events`
| id | event_type (`Game`/`Sesh`) | date (ISO) | day_of_week | home_away (`Home`/`Away`/null) | beer_duty_user_id | ref_duty_user_id | location | map_address | opponent | occasion | team_name | is_next_up (0/1) |
|---|---|---|---|---|---|---|---|---|---|---|---|---:|
| evt-001 | Game | 2026-05-02T13:00:00Z | Saturday | Home |  |  | Brookvale | Millers Reserve | Brookvale | Game | Grimace FC | 1 |
| evt-002 | Game | 2026-05-09T15:00:00Z | Saturday | Away |  |  | Saint Augustine’s | Passmore Reserve | Saint Augustine’s | Game | Grimace FC | 0 |
| evt-003 | Game | 2026-05-16T13:00:00Z | Saturday | Away |  |  | Manly Vale | David Thomas Reserve | Manly Vale | Game | Grimace FC | 0 |
| evt-004 | Game | 2026-05-22T19:00:00Z | Friday | Home |  |  | Harbord | Millers Reserve | Harbord | Game | Grimace FC | 0 |
| evt-005 | Game | 2026-05-30T15:00:00Z | Saturday | Away |  |  | Wakehurst | Lionel Watts Oval | Wakehurst | Game | Grimace FC | 0 |
| evt-006 | Game | 2026-06-06T13:00:00Z | Saturday | Home |  |  | Curl Curl | Millers Reserve | Curl Curl | Game | Grimace FC | 0 |
| evt-007 | Game | 2026-06-13T15:00:00Z | Saturday | Home |  |  | Collaroy Cromer | Millers Reserve | Collaroy Cromer | Game | Grimace FC | 0 |
| evt-008 | Game | 2026-06-27T13:00:00Z | Saturday | Away |  |  | Curl Curl | Adam Street | Curl Curl | Game | Grimace FC | 0 |
| evt-009 | Game | 2026-07-04T13:00:00Z | Saturday | Home |  |  | Allambie | Beacon Hill Reserve | Allambie | Game | Grimace FC | 0 |
| evt-010 | Game | 2026-07-11T15:00:00Z | Saturday | Away |  |  | Brookvale | Grahams Reserve | Brookvale | Game | Grimace FC | 0 |
| evt-011 | Game | 2026-07-18T15:00:00Z | Saturday | Home |  |  | Saint Augustine’s | Beacon Hill Reserve | Saint Augustine’s | Game | Grimace FC | 0 |
| evt-012 | Game | 2026-07-25T13:00:00Z | Saturday | Home |  |  | Manly Vale | Millers Reserve | Manly Vale | Game | Grimace FC | 0 |
| evt-013 | Game | 2026-08-01T15:00:00Z | Saturday | Away |  |  | Harbord | Nolan Reserve | Harbord | Game | Grimace FC | 0 |
| evt-014 | Game | 2026-08-08T15:00:00Z | Saturday | Home |  |  | Wakehurst | Millers Reserve | Wakehurst | Game | Grimace FC | 0 |
| evt-015 | Game | 2026-08-15T13:00:00Z | Saturday | Away |  |  | Curl Curl | Adam Street | Curl Curl | Game | Grimace FC | 0 |

## 3) `messages`
| id | user_id | text | created_at (ISO) |
|---|---|---|---|

## 4) `fines`
| id | who_user_id | amount | reason | submitted_by_user_id | submitted_at (ISO) |
|---|---|---:|---|---|---|

## 5) `lineups`
| id | event_id | formation | positions_json | subs_json | not_available_json | beer_duty_user_id | ref_duty_user_id | updated_at (ISO) |
|---|---|---|---|---|---|---|---|---|
| lineup-evt-001 | evt-001 | 4-3-3 | `{}` | `[]` | `[]` |  |  | 2026-01-01T00:00:00Z |

## 6) `availability`
| id | event_id | user_id | status (`available`/`not_available`) | updated_at (ISO) |
|---|---|---|---|---|

## 7) `ref_roster`
| user_id | roster_order | created_at (ISO) |
|---|---:|---|

## 8) `next_ref_state`
| event_id | current_user_id | status (`Pending Decision`/`Accepted`) | running_balance | accepted_at (ISO or null) | updated_at (ISO) | created_at (ISO) |
|---|---|---|---:|---|---|---|

## 9) `next_ref_passes`
| id | event_id | user_id | passed_at (ISO) |
|---|---|---|---|

## 10) `next_ref_history`
| id | event_id | referee_user_id | final_balance | passed_json | accepted_at (ISO or null) | completed_at (ISO) |
|---|---|---|---:|---|---|---|

---

## Notes
- Keep all IDs unique.
- `*_json` columns should be valid JSON strings.
- Use UTC ISO timestamps (`YYYY-MM-DDTHH:mm:ssZ`).
- Use blank cells for `NULL`.
