# Push notification investigation and manual test plan

## Investigation summary

The Grimace FC push flow is:

1. The React app asks for notification permission from the settings modal.
2. The app registers `/service-worker.js` and waits for `navigator.serviceWorker.ready`.
3. The app fetches `/api/push/vapid-public-key`, creates or reuses a `PushSubscription`, and posts it to `/api/push/subscription` with non-secret device metadata. If a returning user already granted browser notification permission and their preference is not disabled, the app also attempts this sync automatically on load so deleted/missing DB rows can self-heal without another permission prompt. For the `2026-05-06-force-resubscribe-v1` rollout, users who have not already handled the campaign see a one-time refresh prompt on load; browser permission is still requested only after they tap the prompt button because browsers require a user gesture.
4. The Cloudflare Worker stores the subscription in D1.
5. When a chat message is posted to `/api/messages`, the Worker resolves recipients by notification preference:
   - `all_chats`: all users except the sender.
   - `tagged_only`: only users whose `@Name` appears in the message, excluding the sender.
   - `disabled`: excluded.
6. The Worker stores a pending notification payload by endpoint and sends a lightweight Web Push ping to the browser push service.
7. The service worker receives the push event, fetches `/api/push/pending?endpoint=...` if the push event has no payload, and shows a grouped notification.

## Likely causes found

The most likely reliability issue was the client-side resubscribe flow. Before this fix, enabling notifications always deleted the currently stored subscription and unsubscribed the browser before creating and saving the new subscription. If the browser subscription call or database save failed, the user/device was left with no valid stored subscription. That failure mode matches reports where notifications work once, stop later, or vary by device.

Other risk factors found:

- Subscription rows were unique by `(user_id, endpoint)`, not by endpoint globally. If the same browser/device was used by multiple users, the same endpoint could be linked to more than one user and produce confusing targeting results.
- The server did not store device/browser metadata or last push outcome, making it hard to determine whether a user granted permission, saved a subscription, was targeted, or had the push provider reject the subscription.
- The settings UI supported the `disabled` value in the database but did not expose it in the modal, making manual testing and user control incomplete.
- VAPID key rotation can make older browser subscriptions invalid. The updated client compares the current subscription's `applicationServerKey` with the server public key and renews only when they differ.
- Provider `404`, `410`, and known VAPID `403` failures are treated as stale/invalid subscriptions and are removed so one stale endpoint does not keep failing forever.

## Schema changes

The Worker performs non-destructive startup migrations for diagnostic columns on `push_subscriptions`:

- `user_agent`
- `device_label`
- `standalone`
- `notification_permission`
- `last_attempt_at`
- `last_success_at`
- `last_failure_at`
- `last_failure_status`
- `last_failure_reason`
- `last_attempt_message`

It also deduplicates existing subscription rows and creates a global unique index on `push_subscriptions(endpoint)`. This is intentionally conservative: duplicate endpoint rows cannot represent separate physical push destinations, because an endpoint belongs to one browser push subscription.

## Diagnostic logging

Client logs are emitted to the browser console with the `[push]` prefix for:

- permission prompt start/result
- service worker registration/readiness
- VAPID public key availability
- existing subscription detection
- VAPID key mismatch renewal
- subscription creation/reuse
- subscription save success/failure
- automatic subscription self-heal on app load when permission is already granted
- one-time force-resubscribe campaign prompt results
- disable/unsubscribe flow

Worker logs are structured JSON written with event names such as:

- `push_flow_start`
- `push_flow_recipient_summary`
- `push_flow_no_recipients`
- `push_flow_no_subscriptions`
- `push_flow_dispatch_start`
- `push_send_ok`
- `push_send_failed`
- `push_subscription_saved`
- `push_subscription_deleted`

The logs intentionally avoid exposing VAPID private keys and full endpoint values. Endpoints are summarized by host, short prefix, and length.

## Admin debug endpoint

Admins can inspect push state without exposing secrets. Windows Terminal can run either Command Prompt or PowerShell; if your prompt looks like `C:\...>`, you are in Command Prompt, so use `curl.exe` instead of PowerShell-only commands such as `Invoke-RestMethod`.

Command Prompt / Windows Terminal default profile:

```cmd
curl.exe -H "x-team-passcode: adminadmin" "https://grimacefc.itsimple-brad.workers.dev/api/push/debug"
```

PowerShell profile:

```powershell
$Passcode = "adminadmin"
Invoke-RestMethod -Uri "https://grimacefc.itsimple-brad.workers.dev/api/push/debug" -Headers @{ "x-team-passcode" = $Passcode }
```

Make sure the URL starts with `https://` only once. For example, use `https://grimacefc.itsimple-brad.workers.dev/api/push/debug`, not `https://https://grimacefc.itsimple-brad.workers.dev/api/push/debug`.

The endpoint returns:

- a `summary` with total users, users who want notifications, users who can currently receive pushes, users who need to resubscribe, and total stored subscriptions
- whether VAPID public/private keys are present, public key length, and subject
- users and notification preferences
- `pushEnabled`, which means the user's preference allows notifications and at least one push subscription is stored
- `needsResubscribe`, which means the user wants notifications but has no stored subscription; ask that user to open Settings and save **All messages** or **Mentions only** on the device that should receive pushes
- subscription counts per user
- device/browser metadata
- last subscription update time
- last push attempt time
- last success/failure details

If old subscriptions show `null` for device metadata, that only means they were saved before diagnostic metadata existed. Ask the user to resave notification settings on that device to refresh the metadata, or have them simply open the app if browser notification permission is already granted; the app will now auto-sync the stored subscription on load. Users who have not already handled the `2026-05-06-force-resubscribe-v1` campaign will see a one-time **Refresh notifications** prompt on load. Clicking **Not now**, denying permission, or completing the sync records that campaign locally so the same device is not nagged repeatedly.

The pasted production debug output from May 6, 2026 showed `pushEnabled: 3`, `needsResubscribe: 20`, and `totalSubscriptions: 3`. That means VAPID configuration is present, but only three browser/device installs currently have saved push subscriptions. Users listed with `needsResubscribe: true` need to open the app on the device that should receive notifications and save **All messages** or **Mentions only**. If they had already granted notification permission before, opening the app after this fix should also attempt to restore the saved DB subscription automatically. If permission has not been granted yet, the one-time prompt asks them to refresh notifications with a user gesture so the browser permission prompt can appear.

## Manual test cases

### Test Case 1: Desktop sender to mobile target

1. User A logs in on desktop.
2. User B logs in on mobile.
3. User B opens Settings and chooses **All messages**.
4. User B grants notification permission if prompted.
5. User A sends a normal chat message.
6. Expected: User B receives one push notification on mobile.
7. Expected: User A does not receive a notification for their own message.
8. Check Worker logs for `push_flow_recipient_summary` showing User B as a recipient and sender excluded.

### Test Case 2: Mobile target with @mention only

1. User B opens Settings and chooses **Mentions only**.
2. User A sends a message without mentioning User B.
3. Expected: User B receives no push notification.
4. User A sends a message using the app mention format, for example `@User B Name`.
5. Expected: User B receives one push notification.
6. Check Worker logs for `push_flow_tag_parse` and `taggedOnlyRecipientIds`.

### Test Case 3: Disabled notifications

1. User B opens Settings and chooses **Disabled**.
2. User A sends a message and/or an @mention.
3. Expected: User B receives no push notification.
4. Check Worker logs for `disabledRecipientIds` in `push_flow_recipient_summary`.

### Test Case 4: Re-subscribe scenario

1. User B chooses **Disabled** and saves.
2. User B chooses **All messages** or **Mentions only** and saves again.
3. Run the admin debug endpoint.
4. Expected: User B has one subscription for that device/browser endpoint, not duplicates.
5. User A sends a message.
6. Expected: User B receives only one push notification.

### Test Case 5: Expired/stale subscription handling

1. Use the admin debug endpoint to identify a test subscription.
2. In a non-production D1 database, create or keep an invalid endpoint/subscription for a test user, or use a browser profile whose site data has been cleared after subscribing.
3. Send a chat message that targets that user.
4. Expected: `push_send_failed` logs the provider status clearly.
5. Expected: `404`, `410`, and known VAPID mismatch `403` failures remove the stale subscription.
6. Expected: other valid subscriptions still receive notifications.

## Production safety

The fix is safe for production because it does not require destructive manual database migrations, does not expose secrets, and makes subscription handling less destructive on the client. Existing stale/duplicate rows are cleaned up automatically using endpoint uniqueness, and provider-rejected stale subscriptions are removed only for recognized expired/invalid responses.
