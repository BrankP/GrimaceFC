import { deletePushSubscription, getVapidPublicKey, savePushSubscription } from './dataService';

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
};

export const canUsePushNotifications = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

export const syncPushSubscription = async (userId: string) => {
  if (!canUsePushNotifications()) return { ok: false as const, reason: 'unsupported' as const };

  const registration = await navigator.serviceWorker.register('/service-worker.js');
  const permission = Notification.permission;
  if (permission !== 'granted') return { ok: false as const, reason: permission };

  const vapid = await getVapidPublicKey();
  if (!vapid.publicKey) return { ok: false as const, reason: 'missing_vapid_key' as const };

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
    });
  }

  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.auth || !json.keys?.p256dh) {
    return { ok: false as const, reason: 'invalid_subscription' as const };
  }

  await savePushSubscription({ userId, subscription: json });
  return { ok: true as const };
};

export const disablePushNotifications = async (userId: string) => {
  if (!canUsePushNotifications()) return;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  await deletePushSubscription({ userId, endpoint: subscription.endpoint });
  await subscription.unsubscribe();
};
