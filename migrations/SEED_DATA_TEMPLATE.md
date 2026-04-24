# Seed Data Worksheet

Use this worksheet to provide fresh seed data. Fill in rows in each table section, then I can convert this directly back into `migrations/0002_seed.sql`.

## 1) `users`
| id | name | nickname | created_year | created_at (ISO) |
|---|---|---|---:|---|
| usr-001 |  |  | 2026 | 2026-01-01T00:00:00Z |

## 2) `events`
| id | event_type (`Game`/`Sesh`) | date (ISO) | day_of_week | home_away (`Home`/`Away`/null) | beer_duty_user_id | ref_duty_user_id | location | map_address | opponent | occasion | team_name | is_next_up (0/1) |
|---|---|---|---|---|---|---|---|---|---|---|---|---:|
| evt-001 | Game | 2026-01-01T00:00:00Z | Saturday | Home |  |  |  |  |  |  | Grimace FC | 0 |

## 3) `messages`
| id | user_id | text | created_at (ISO) |
|---|---|---|---|
| msg-001 | usr-001 |  | 2026-01-01T00:00:00Z |

## 4) `fines`
| id | who_user_id | amount | reason | submitted_by_user_id | submitted_at (ISO) |
|---|---|---:|---|---|---|
| fine-001 | usr-001 | 5 |  | usr-002 | 2026-01-01T00:00:00Z |

## 5) `lineups`
| id | event_id | formation | positions_json | subs_json | not_available_json | beer_duty_user_id | ref_duty_user_id | updated_at (ISO) |
|---|---|---|---|---|---|---|---|---|
| lineup-evt-001 | evt-001 | 4-3-3 | `{}` | `[]` | `[]` |  |  | 2026-01-01T00:00:00Z |

## 6) `availability`
| id | event_id | user_id | status (`available`/`not_available`) | updated_at (ISO) |
|---|---|---|---|---|
| avail-001 | evt-001 | usr-001 | available | 2026-01-01T00:00:00Z |

## 7) `ref_roster`
| user_id | roster_order | created_at (ISO) |
|---|---:|---|
| usr-001 | 0 | 2026-01-01T00:00:00Z |

## 8) `next_ref_state`
| event_id | current_user_id | status (`Pending Decision`/`Accepted`) | running_balance | accepted_at (ISO or null) | updated_at (ISO) | created_at (ISO) |
|---|---|---|---:|---|---|---|
| evt-001 | usr-001 | Pending Decision | 0 |  | 2026-01-01T00:00:00Z | 2026-01-01T00:00:00Z |

## 9) `next_ref_passes`
| id | event_id | user_id | passed_at (ISO) |
|---|---|---|---|
| refpass-001 | evt-001 | usr-002 | 2026-01-01T00:00:00Z |

## 10) `next_ref_history`
| id | event_id | referee_user_id | final_balance | passed_json | accepted_at (ISO or null) | completed_at (ISO) |
|---|---|---|---:|---|---|---|
| refhist-001 | evt-001 | usr-001 | 0 | `[]` |  | 2026-01-01T00:00:00Z |

---

## Notes
- Keep all IDs unique.
- `*_json` columns should be valid JSON strings.
- Use UTC ISO timestamps (`YYYY-MM-DDTHH:mm:ssZ`).
- Use blank cells for `NULL`.
