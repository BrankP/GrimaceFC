# Seed Data Worksheet

This worksheet now mirrors the current requested seed set.

## 1) `users` (20)
| id | name | nickname |
|---|---|---|
| usr-001 | Brad Fox |  |
| ... | ... | ... |
| usr-020 | Zac Reyes |  |

## 2) `events` (21)
| id      | event_type | date (ISO)           | day_of_week | home_away | beer_duty_user_id | ref_duty_user_id | location          | map_address          | opponent          | occasion                  | is_next_up |
| ------- | ---------- | -------------------- | ----------- | --------- | ----------------- | ---------------- | ----------------- | -------------------- | ----------------- | ------------------------- | ---------- |
| evt-001 | Game       | 2026-03-14T05:00:00Z | Saturday    | Home      |                   |                  | ABH United 2026   | Tristram Road Reserve | ABH United AL6A's | Trial Match               | 0 |
| ...     | ...        | ...                  | ...         | ...       | ...               | ...              | ...               | ...                  | ...               | ...                       | ... |
| evt-021 | Game       | 2026-08-15T13:00:00Z | Saturday    | Away      | usr-005           |                  | Curl Curl         | Adam Street Reserve  | Curl Curl         | Game                      | 0 |

## 3) `messages`
| id | user_id | text | created_at (ISO) |
|---|---|---|---|
<!-- Dummy example row: | msg-001 | usr-001 | Example team message | 2026-01-01T00:00:00Z | -->

## 4) `lineups`
| id | event_id | formation | positions_json | subs_json | not_available_json | beer_duty_user_id | ref_duty_user_id | updated_at (ISO) | created_at (ISO) |
|---|---|---|---|---|---|---|---|---|---|
<!-- Dummy example row: | lin-001 | evt-007 | 4-3-3 | {"GK":"usr-001"} | ["usr-010"] | ["usr-011"] | usr-009 | usr-012 | 2026-05-01T00:00:00Z | 2026-05-01T00:00:00Z | -->

## 5) `availability`
| id | event_id | user_id | status | updated_at (ISO) | created_at (ISO) |
|---|---|---|---|---|---|
<!-- Dummy example row: | avl-001 | evt-007 | usr-001 | available | 2026-05-01T00:00:00Z | 2026-05-01T00:00:00Z | -->

## 6) `ref_roster` (supports repeated users / slot-based ordering)
| id | user_id | roster_order |
| ------- | ------- | -----------: |
| refslot-001 | usr-012 |            0 |
| refslot-002 | usr-011 |            1 |
| refslot-003 | usr-004 |            2 | 2026-01-01T00:00:00Z |
| refslot-004 | usr-015 |            3 | 2026-01-01T00:00:00Z |
| refslot-005 | usr-018 |            4 | 2026-01-01T00:00:00Z |
| refslot-006 | usr-006 |            5 | 2026-01-01T00:00:00Z |
| refslot-007 | usr-016 |            6 | 2026-01-01T00:00:00Z |
| refslot-008 | usr-013 |            7 | 2026-01-01T00:00:00Z |
| refslot-009 | usr-002 |            8 | 2026-01-01T00:00:00Z |
| refslot-010 | usr-007 |            9 | 2026-01-01T00:00:00Z |
| refslot-011 | usr-014 |           10 | 2026-01-01T00:00:00Z |
| refslot-012 | usr-003 |           11 | 2026-01-01T00:00:00Z |
| refslot-013 | usr-001 |           12 | 2026-01-01T00:00:00Z |
| refslot-014 | usr-005 |           13 | 2026-01-01T00:00:00Z |
| refslot-015 | usr-019 |           14 | 2026-01-01T00:00:00Z |
| refslot-016 | usr-017 |           15 | 2026-01-01T00:00:00Z |
| refslot-017 | usr-009 |           16 | 2026-01-01T00:00:00Z |
| refslot-018 | usr-020 |           17 | 2026-01-01T00:00:00Z |
| refslot-019 | usr-010 |           18 | 2026-01-01T00:00:00Z |
| refslot-020 | usr-008 |           19 | 2026-01-01T00:00:00Z |
| refslot-021 | usr-016 |           20 | 2026-01-01T00:00:00Z |
| refslot-022 | usr-001 |           21 | 2026-01-01T00:00:00Z |
| refslot-023 | usr-014 |           22 | 2026-01-01T00:00:00Z |
| refslot-024 | usr-005 |           23 | 2026-01-01T00:00:00Z |
| refslot-025 | usr-012 |           24 | 2026-01-01T00:00:00Z |
| refslot-026 | usr-015 |           25 | 2026-01-01T00:00:00Z |
| refslot-027 | usr-003 |           26 | 2026-01-01T00:00:00Z |
| refslot-028 | usr-002 |           27 | 2026-01-01T00:00:00Z |
| refslot-029 | usr-004 |           28 | 2026-01-01T00:00:00Z |
| refslot-030 | usr-006 |           29 | 2026-01-01T00:00:00Z |
| refslot-031 | usr-018 |           30 | 2026-01-01T00:00:00Z |
| refslot-032 | usr-011 |           31 | 2026-01-01T00:00:00Z |
| refslot-033 | usr-007 |           32 | 2026-01-01T00:00:00Z |
| refslot-034 | usr-013 |           33 | 2026-01-01T00:00:00Z |
| refslot-035 | usr-008 |           34 | 2026-01-01T00:00:00Z |
| refslot-036 | usr-017 |           35 | 2026-01-01T00:00:00Z |
| refslot-037 | usr-020 |           36 | 2026-01-01T00:00:00Z |
| refslot-038 | usr-010 |           37 | 2026-01-01T00:00:00Z |
| refslot-039 | usr-009 |           38 | 2026-01-01T00:00:00Z |
| refslot-040 | usr-019 |           39 | 2026-01-01T00:00:00Z |
<!-- Dummy example row: | refslot-041 | usr-001 | 40 | 2026-01-01T00:00:00Z | -->

## 7) `next_ref_state`
| event_id | current_ref_slot_id | status | running_balance | accepted_at (ISO) | updated_at (ISO) | created_at (ISO) |
|---|---|---|---:|---|---|---|
| evt-007 | refslot-002 | Pending Decision | 0 |  | 2026-04-11T06:00:00Z | 2026-04-11T06:00:00Z |
<!-- Dummy example row: | evt-008 | refslot-003 | Pending Decision | 0 |  | 2026-05-01T00:00:00Z | 2026-05-01T00:00:00Z | -->

## 8) `next_ref_passes`
| id | event_id | user_id | passed_at (ISO) |
|---|---|---|---|
<!-- Dummy example row: | nrp-001 | evt-007 | usr-003 | 2026-05-01T01:00:00Z | -->

## 9) `next_ref_skips`
| id | event_id | ref_slot_id | user_id | skipped_at (ISO) |
|----|----------|-------------|---------|------------------|
<!-- Dummy example row: | refskip-001 | evt-008 | refslot-003 | usr-004 | 2026-05-01T00:00:00Z | -->

## 10) `next_ref_history`
| id | event_id | referee_user_id | final_balance | passed_json | accepted_at (ISO) | completed_at (ISO) |
|---|---|---|---:|---|---|---|
| nrh-001 | evt-003 | usr-012 | 0 | [] | 2026-04-11T05:00:00Z | 2026-04-11T05:00:00Z |
<!-- Dummy example row: | nrh-002 | evt-007 | usr-011 | 1 | ["usr-003"] | 2026-05-01T02:00:00Z | 2026-05-01T03:00:00Z | -->

## 10) `push_subscriptions`
| id | user_id | endpoint | p256dh_key | auth_key | expiration_time | created_at (ISO) | updated_at (ISO) |
|---|---|---|---|---|---:|---|---|
<!-- Dummy example row: | psub-001 | usr-001 | https://push.example.com/sub/abc | key_p256dh | key_auth | 0 | 2026-01-01T00:00:00Z | 2026-01-01T00:00:00Z | -->

## 11) `push_notification_queue`
| id | endpoint | payload_json | created_at (ISO) |
|---|---|---|---|
<!-- Dummy example row: | pnq-001 | https://push.example.com/sub/abc | {"title":"Match reminder"} | 2026-01-01T00:00:00Z | -->

## 12) `event_scores`
| event_id | grimace_score | opponent_score | updated_at (ISO) | created_at (ISO) |
|---|---:|---:|---|---|
| evt-001 | 2 | 2 | 2026-03-14T07:00:00Z | 2026-03-14T07:00:00Z |
| evt-002 | 2 | 6 | 2026-03-28T07:00:00Z | 2026-03-28T07:00:00Z |
| evt-003 | 2 | 2 | 2026-04-11T07:00:00Z | 2026-04-11T07:00:00Z |
| evt-004 | 3 | 2 | 2026-04-18T07:00:00Z | 2026-04-18T07:00:00Z |
| evt-005 | 2 | 2 | 2026-04-22T07:00:00Z | 2026-04-22T07:00:00Z |
<!-- Dummy example row: | evt-007 | 3 | 1 | 2026-05-02T15:00:00Z | 2026-05-02T15:00:00Z | -->

## 13) `event_goal_details`
| id | event_id | scorer_user_id | assist_user_id | is_own_goal | sort_order | created_at (ISO) |
|---|---|---|---|---:|---:|---|
<!-- Dummy example row: | egd-001 | evt-007 | usr-001 | usr-002 | 0 | 0 | 2026-05-02T15:00:00Z | -->

## 14) `users.notification_preference` (additional seed column)
| user_id | notification_preference |
|---|---|
<!-- Dummy example row: | usr-001 | all_chats | -->
