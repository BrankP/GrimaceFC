# Grimace FC Functional & Data Reference

This README is intended to help product owners decide **what to keep, change, or remove** in the app.

It includes:
1. Every known database table and its fields.
2. A page-by-page list of user-facing functions (including pop-ups/modals) and what each does.

---

## 1) Database Tables and Field Descriptions

Source of truth for schema: `migrations/master_seed.sql`.

### `users`
Stores player/user identity and notification preferences.

| Field | Type | Description |
|---|---|---|
| `id` | TEXT (PK) | Unique user identifier. |
| `name` | TEXT | Full display name (e.g., first + last). |
| `nickname` | TEXT (nullable) | Optional nickname shown in chat display names. |
| `created_year` | INTEGER | Year user was created/added. |
| `created_at` | TEXT | ISO timestamp when user row was created. |
| `notification_preference` | TEXT | Push preference: `all_chats`, `tagged_only`, or `disabled`. |

### `events`
Stores all matches and sessions shown in Upcoming + related screens.

| Field | Type | Description |
|---|---|---|
| `id` | TEXT (PK) | Unique event identifier. |
| `event_type` | TEXT | Event type (e.g., `Game`, `Sesh`). |
| `date` | TEXT | Event date/time (ISO string). |
| `day_of_week` | TEXT | Day name for display/grouping. |
| `home_away` | TEXT (nullable) | Home/away status where applicable. |
| `beer_duty_user_id` | TEXT (nullable) | Assigned beer duty user id. |
| `ref_duty_user_id` | TEXT (nullable) | Assigned referee user id (if already set). |
| `location` | TEXT | Venue/location label. |
| `map_address` | TEXT (nullable) | Address used for map embed if different from location label. |
| `opponent` | TEXT (nullable) | Opponent name for games. |
| `occasion` | TEXT (nullable) | Session or event descriptor (e.g., special sesh title). |
| `team_name` | TEXT | Team name associated to event (currently Grimace FC). |
| `is_next_up` | INTEGER | Flag to visually mark the “next up” event. |

### `ref_roster`
Ordered rotation list for next referee assignment flow.

| Field | Type | Description |
|---|---|---|
| `id` | TEXT (PK) | Unique roster slot id. |
| `user_id` | TEXT | User occupying this slot in the rotation. |
| `roster_order` | INTEGER (unique) | Absolute order in rotation list. |
| `created_at` | TEXT | When roster slot was created. |

### `next_ref_state`
Current active “Next Ref” workflow state for an event.

| Field | Type | Description |
|---|---|---|
| `event_id` | TEXT (PK) | Event currently tied to ref-duty decision. |
| `current_ref_slot_id` | TEXT | Current roster slot being asked to referee. |
| `status` | TEXT | `Pending Decision` or `Accepted`. |
| `running_balance` | INTEGER | Running monetary balance accrued through passes. |
| `accepted_at` | TEXT (nullable) | Timestamp when duty was accepted. |
| `updated_at` | TEXT | Last state update timestamp. |
| `created_at` | TEXT | Initial creation timestamp for this state row. |

### `next_ref_history`
Audit/history of completed referee decisions.

| Field | Type | Description |
|---|---|---|
| `id` | TEXT (PK) | Unique history row id. |
| `event_id` | TEXT | Event that was completed in the workflow. |
| `referee_user_id` | TEXT | Final assigned referee user id. |
| `final_balance` | INTEGER | Final $ balance recorded on completion. |
| `passed_json` | TEXT | JSON array of pass history entries for that event. |
| `accepted_at` | TEXT (nullable) | When final referee accepted duty. |
| `completed_at` | TEXT | When duty was marked complete. |

### `event_scores`
Score records per event.

| Field | Type | Description |
|---|---|---|
| `event_id` | TEXT (PK) | Event being scored. |
| `grimace_score` | INTEGER | Grimace FC goals. |
| `opponent_score` | INTEGER | Opponent goals. |
| `updated_at` | TEXT | Last score update timestamp. |
| `created_at` | TEXT | Score row creation timestamp. |

### `push_subscriptions`
Per-device/browser web push registration records.

| Field | Type | Description |
|---|---|---|
| `id` | TEXT (PK) | Subscription record id. |
| `user_id` | TEXT | User tied to this endpoint. |
| `endpoint` | TEXT | Web Push endpoint URL from browser. |
| `p256dh_key` | TEXT | Public encryption key for subscription payload encryption. |
| `auth_key` | TEXT | Auth secret key for push protocol. |
| `expiration_time` | INTEGER (nullable) | Browser-provided subscription expiration epoch (if set). |
| `created_at` | TEXT | Subscription creation timestamp. |
| `updated_at` | TEXT | Last refresh/update timestamp. |

### `push_notification_queue`
Outbound push payload queue table.

| Field | Type | Description |
|---|---|---|
| `id` | TEXT (PK) | Queue item id. |
| `endpoint` | TEXT | Target push endpoint URL. |
| `payload_json` | TEXT | JSON payload to send. |
| `created_at` | TEXT | Queue insertion timestamp. |

### `messages`
Team chat messages.

| Field | Type | Description |
|---|---|---|
| `id` | TEXT (PK) | Message id. |
| `user_id` | TEXT | Authoring user id. |
| `text` | TEXT | Raw message content. |
| `created_at` | TEXT | Timestamp when message was posted. |

### `lineups`
Saved lineup for an event, including formation placement and bench lists.

| Field | Type | Description |
|---|---|---|
| `id` | TEXT (PK) | Lineup row id. |
| `event_id` | TEXT | Event this lineup belongs to. |
| `formation` | TEXT | Formation value (currently `4-3-3`). |
| `positions_json` | TEXT | JSON map of formation position -> user id/null. |
| `subs_json` | TEXT | JSON array of user ids on subs bench. |
| `not_available_json` | TEXT | JSON array of user ids marked unavailable. |
| `beer_duty_user_id` | TEXT (nullable) | Beer duty assignment persisted with lineup. |
| `ref_duty_user_id` | TEXT (nullable) | Referee duty assignment persisted with lineup. |
| `updated_at` | TEXT | Last lineup update timestamp. |
| `created_at` | TEXT | Lineup creation timestamp. |

### `availability`
Per-user attendance response per event.

| Field | Type | Description |
|---|---|---|
| `id` | TEXT (PK) | Availability row id. |
| `event_id` | TEXT | Related event id. |
| `user_id` | TEXT | User giving response. |
| `status` | TEXT | `available` or `not_available`. |
| `updated_at` | TEXT | Last response change time. |
| `created_at` | TEXT | Initial response creation time. |

---

## 2) User Functions by Page + Pop-Ups

This section is written so you can decide what product behavior to keep/retire.

## Global / Entry Flow

### Name Gate (login/entry screen)
- **First Name + Last Name inputs**: user identity inputs required for entry.
- **Visitor checkbox**: enables read-only mode (no writing to chat, attendance, ref actions, lineup edits).
- **Team Passcode input** (hidden in visitor mode): required for player/admin write access.
- **Continue / Enter as Visitor button**:
  - Visitor mode: stores local visitor session and enters app in view-only mode.
  - Team mode: validates passcode, upserts/creates user by full name, persists active user id and passcode locally.

### Bottom Navigation
- **Upcoming**: opens Upcoming Games & Sessions page.
- **Chat**: opens chat page.
- **Next Game**: opens drag/drop lineup page.
- **Next Ref**: opens referee rotation workflow page.
- **Team Stats**: opens stats/rankings page.

### Global Settings Modal (⚙️ in header, non-visitor users)
- **Open Settings button**: launches settings modal.
- **Chat notification preference options**:
  - All messages
  - Mentions only
- **Save button**:
  - Persists selected notification preference.
  - Handles browser push permission flow and subscription sync when needed.
- **Close button**: closes settings modal without additional changes.
- **Wipe Cache button**:
  - Shows confirmation prompt.
  - Calls logout endpoint (best effort).
  - Clears localStorage/sessionStorage/cookies/indexedDB/caches (best effort).
  - Resets local app session and returns to entry route.

### Passcode Prompt Modal (write failure recovery)
- Triggered when write call fails due to auth/passcode issues.
- **Passcode input + Save**: updates locally stored team passcode used for future write requests.
- **Close**: dismisses modal.

---

## Upcoming Games & Sessions Page

### Event list and cards
- **Month grouping**: events grouped by month.
- **Event row tap/click**: expands/collapses detailed event panel.
- **Long press on game row (admin)**: opens score entry/edit modal for that event.
- **Visual indicators**:
  - Home/Away/Sesh indicator icon.
  - “Next up” styling for flagged event.
  - Duty warning icon if logged-in user has beer/ref duty.

### Attendance actions
- **✅ button**: marks current user as available for that event.
- **❌ button**: marks current user as not available.
- Buttons are disabled in visitor mode/no write access.

### Expanded card details
- Shows Beer Duty + Ref Duty assignment.
- Shows attendance groups:
  - Attending
  - Not Attending
  - No Response
- Shows embedded Google map for venue/address.

### Score Modal (admin-only via long press)
- **Grimace FC score / Opponent score inputs**: whole numbers only.
- **Goal scorer rows**:
  - Scorer dropdown (includes “Own Goal”).
  - Assist dropdown (optional).
  - Remove row button.
  - Add goal row button.
- **Validation**:
  - Scores must be integer >= 0.
  - Non-own-goal rows require a scorer.
- **Save score**: saves event score + structured goal details.
- **Cancel**: closes modal without saving.

---

## Chat Page

### Message thread
- Groups messages by day with date divider.
- Shows message author display name (nickname if set) + timestamp.
- Tagged names in message text are visually highlighted.

### Message composer (write-enabled users)
- **Message input**: enter chat text.
- **@ mention support**:
  - Typing `@` starts mention suggestions.
  - Arrow keys cycle suggestions.
  - Tab selects active suggestion.
  - Click suggestion to insert mention.
- **Send button**: submits message to team chat.

### Nickname Modal
- Trigger: clicking a user name in chat bubble (write-enabled users).
- **Nickname input**: edit display nickname for selected user.
- **Save**: persists nickname.
- **Cancel**: close without saving.

### Visitor behavior
- Chat input is replaced by a view-only message.

---

## Next Game Page (Lineup Drag & Drop)

### Core lineup management
- Displays next upcoming game + local timezone.
- Formation rendered as a draggable `4-3-3` board.
- Player chips can be moved between:
  - Field positions
  - Subs
  - Not available
  - Unknowns

### Drag/drop behavior
- **Position ↔ Position swap**: swapping occupied field slots swaps player placement.
- **Move to Subs**: player becomes a substitute.
- **Move to Not available**: player marked unavailable.
- **Move to Unknowns**: clears attendance state for that player.
- **Auto-displacement rule**: dropping onto occupied field slot displaces previous player to subs.
- Each successful move saves updated lineup and writes corresponding availability updates.

### Permissions
- Non-admin users see lineup in read-only mode (dragging disabled).

---

## Next Ref Page

### Current state summary
- Shows next away game details.
- Shows current assigned referee and status (`Pending Decision` / `Accepted`).
- Shows running balance and who has passed.

### Action buttons
- **Pass Duty**:
  - Available to current assigned ref or admin override.
  - Requires confirmation dialog.
  - Advances to next roster candidate and updates running balance/pass list.
- **Accept Duty**:
  - Available to current assigned ref or admin override.
  - Requires confirmation dialog.
  - Locks state as accepted.
- **Complete Duty** (admin only):
  - Requires confirmation dialog.
  - Finalizes current event and archives record into completed history.

### Ref roster views
- Inline preview list around current roster position.
- **Expand Roster** button opens full roster modal.
- **Full Roster modal** shows all roster entries and highlights current assignee.
- **Close** button dismisses roster modal.

### History
- Completed history entries show:
  - Match/opponent/date
  - Final referee
  - Final balance
  - Who passed

---

## Team Stats Page

### Summary cards
- Total Goal Count.
- Total Assist Count.
- “My Contributions” (current user goals + assists).

### Ranked lists
- **Top Scorers** list.
- **Top Assisters** list.
- **View All / Show Less** toggle for long lists.

### Top Contributor card
- Highlights player with highest goal contributions.
- Shows combined total + goals/assists breakdown.

---

## 3) Keep / Remove Decision Helper

If you want, you can now evaluate each function in three passes:
1. **Must keep** (core team operations: attendance, chat, lineup, ref flow).
2. **Nice to keep** (maps, mention highlighting, expanded roster modal).
3. **Candidates to remove/simplify** (long-press score edit UX, some status/detail views, aggressive cache wipe behavior).

If you share your priorities (e.g., “optimize for casual players” vs “admin-heavy ops”), I can turn this into a direct recommended cut list.
