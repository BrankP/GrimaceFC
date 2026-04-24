import { deletePushSubscription, getVapidPublicKey, savePushSubscription } from './dataService';

const urlBase64ToArrayBuffer = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index += 1) {
    bytes[index] = rawData.charCodeAt(index);
  }
  return bytes.buffer;
};

export const canUsePushNotifications = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export type PushSyncFailureReason =
  | 'unsupported'
  | NotificationPermission
  | 'missing_vapid_key'
  | 'invalid_vapid_key'
  | 'registration_failed'
  | 'subscribe_failed'
  | 'invalid_subscription'
  | 'save_failed';

export type PushSyncResult =
  | { ok: true }
  | { ok: false; reason: PushSyncFailureReason; detail?: string };

export const syncPushSubscription = async (userId: string) => {
  if (!canUsePushNotifications()) return { ok: false as const, reason: 'unsupported' as const } satisfies PushSyncResult;

  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.register('/service-worker.js');
  } catch (err) {
    return {
      ok: false,
      reason: 'registration_failed',
      detail: err instanceof Error ? err.message : String(err),
    } satisfies PushSyncResult;
  }

  const permission = Notification.permission;
  if (permission !== 'granted') return { ok: false as const, reason: permission } satisfies PushSyncResult;

  const vapid = await getVapidPublicKey();
  if (!vapid.publicKey) return { ok: false as const, reason: 'missing_vapid_key' as const } satisfies PushSyncResult;

  let applicationServerKey: ArrayBuffer;
  try {
    applicationServerKey = urlBase64ToArrayBuffer(vapid.publicKey);
  } catch {
    return { ok: false as const, reason: 'invalid_vapid_key' as const } satisfies PushSyncResult;
  }

  let subscription: PushSubscription | null = null;
  try {
    subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
    }
  } catch (err) {
    return {
      ok: false,
      reason: 'subscribe_failed',
      detail: err instanceof Error ? err.message : String(err),
    } satisfies PushSyncResult;
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.auth || !json.keys?.p256dh) {
    return { ok: false as const, reason: 'invalid_subscription' as const } satisfies PushSyncResult;
  }

  try {
    await savePushSubscription({ userId, subscription: json });
  } catch (err) {
    return {
      ok: false,
      reason: 'save_failed',
      detail: err instanceof Error ? err.message : String(err),
    } satisfies PushSyncResult;
  }

  return { ok: true as const } satisfies PushSyncResult;
};

export const disablePushNotifications = async (userId: string) => {
  if (!canUsePushNotifications()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await deletePushSubscription({ userId, endpoint: subscription.endpoint });
  await subscription.unsubscribe();
};
