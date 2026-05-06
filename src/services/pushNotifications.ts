import { deletePushSubscription, getVapidPublicKey, savePushSubscription } from './dataService';


const pushLog = (event: string, details: Record<string, unknown> = {}) => {
  console.info(`[push] ${event}`, {
    event,
    at: new Date().toISOString(),
    permission: canUsePushNotifications() ? Notification.permission : 'unsupported',
    standalone: isPwaStandalone(),
    userAgent: navigator.userAgent,
    ...details,
  });
};

const isPwaStandalone = () => {
  const nav = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia?.('(display-mode: standalone)').matches || nav.standalone === true;
};

const getDeviceLabel = () => {
  const platform = navigator.platform || 'unknown-platform';
  const displayMode = isPwaStandalone() ? 'standalone' : 'browser-tab';
  return `${platform} ${displayMode}`.slice(0, 120);
};

const arrayBuffersEqual = (left: ArrayBuffer | null | undefined, right: ArrayBuffer) => {
  if (!left || left.byteLength !== right.byteLength) return false;
  const leftBytes = new Uint8Array(left);
  const rightBytes = new Uint8Array(right);
  for (let index = 0; index < leftBytes.length; index += 1) {
    if (leftBytes[index] !== rightBytes[index]) return false;
  }
  return true;
};

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
  pushLog('sync_start', { userId });
  if (!canUsePushNotifications()) {
    pushLog('sync_unsupported', { userId });
    return { ok: false as const, reason: 'unsupported' as const } satisfies PushSyncResult;
  }

  let registration: ServiceWorkerRegistration;
  try {
    registration = await navigator.serviceWorker.register('/service-worker.js');
    pushLog('service_worker_registered', { userId, scope: registration.scope, active: Boolean(registration.active), installing: Boolean(registration.installing), waiting: Boolean(registration.waiting) });
    registration = await navigator.serviceWorker.ready;
    pushLog('service_worker_ready', { userId, scope: registration.scope, active: Boolean(registration.active) });
  } catch (err) {
    pushLog('service_worker_registration_failed', { userId, error: err instanceof Error ? err.message : String(err) });
    return {
      ok: false,
      reason: 'registration_failed',
      detail: err instanceof Error ? err.message : String(err),
    } satisfies PushSyncResult;
  }

  const permission = Notification.permission;
  pushLog('permission_checked', { userId, permission });
  if (permission !== 'granted') return { ok: false as const, reason: permission } satisfies PushSyncResult;

  const vapid = await getVapidPublicKey();
  pushLog('vapid_public_key_loaded', { userId, hasPublicKey: Boolean(vapid.publicKey), publicKeyLength: vapid.publicKey?.length ?? 0 });
  if (!vapid.publicKey) return { ok: false as const, reason: 'missing_vapid_key' as const } satisfies PushSyncResult;

  let applicationServerKey: ArrayBuffer;
  try {
    applicationServerKey = urlBase64ToArrayBuffer(vapid.publicKey);
  } catch {
    pushLog('vapid_public_key_invalid', { userId });
    return { ok: false as const, reason: 'invalid_vapid_key' as const } satisfies PushSyncResult;
  }

  let subscription: PushSubscription | null = null;
  try {
    subscription = await registration.pushManager.getSubscription();
    pushLog('existing_subscription_checked', {
      userId,
      hasSubscription: Boolean(subscription),
      endpointHost: subscription ? new URL(subscription.endpoint).host : null,
      expirationTime: subscription?.expirationTime ?? null,
    });

    if (subscription && !arrayBuffersEqual(subscription.options.applicationServerKey, applicationServerKey)) {
      pushLog('existing_subscription_vapid_mismatch_unsubscribing', { userId, endpointHost: new URL(subscription.endpoint).host });
      await subscription.unsubscribe();
      subscription = null;
    }

    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });
      pushLog('subscription_created', { userId, endpointHost: new URL(subscription.endpoint).host, expirationTime: subscription.expirationTime ?? null });
    } else {
      pushLog('subscription_reused', { userId, endpointHost: new URL(subscription.endpoint).host, expirationTime: subscription.expirationTime ?? null });
    }
  } catch (err) {
    pushLog('subscription_failed', { userId, error: err instanceof Error ? err.message : String(err) });
    return {
      ok: false,
      reason: 'subscribe_failed',
      detail: err instanceof Error ? err.message : String(err),
    } satisfies PushSyncResult;
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.auth || !json.keys?.p256dh) {
    pushLog('subscription_invalid_json', { userId, hasEndpoint: Boolean(json.endpoint), hasAuth: Boolean(json.keys?.auth), hasP256dh: Boolean(json.keys?.p256dh) });
    return { ok: false as const, reason: 'invalid_subscription' as const } satisfies PushSyncResult;
  }

  try {
    await savePushSubscription({
      userId,
      subscription: json,
      metadata: {
        userAgent: navigator.userAgent,
        deviceLabel: getDeviceLabel(),
        standalone: isPwaStandalone(),
        notificationPermission: Notification.permission,
      },
    });
    pushLog('subscription_saved', { userId, endpointHost: new URL(json.endpoint).host, deviceLabel: getDeviceLabel() });
  } catch (err) {
    pushLog('subscription_save_failed', { userId, error: err instanceof Error ? err.message : String(err) });
    return {
      ok: false,
      reason: 'save_failed',
      detail: err instanceof Error ? err.message : String(err),
    } satisfies PushSyncResult;
  }

  return { ok: true as const } satisfies PushSyncResult;
};

export const disablePushNotifications = async (userId: string) => {
  pushLog('disable_start', { userId });
  if (!canUsePushNotifications()) {
    pushLog('disable_unsupported', { userId });
    return;
  }
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    pushLog('disable_no_subscription', { userId });
    return;
  }

  await deletePushSubscription({ userId, endpoint: subscription.endpoint });
  const unsubscribed = await subscription.unsubscribe();
  pushLog('disable_complete', { userId, unsubscribed, endpointHost: new URL(subscription.endpoint).host });
};
