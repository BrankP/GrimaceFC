self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let payload = { title: 'Grimace FC: You were tagged in chat', body: 'Open chat to view the message.', url: '/chat' };

      if (event.data) {
        try {
          payload = { ...payload, ...event.data.json() };
        } catch {
          payload.body = event.data.text();
        }
      } else {
        const subscription = await self.registration.pushManager.getSubscription();
        if (subscription?.endpoint) {
          const response = await fetch(`/api/push/pending?endpoint=${encodeURIComponent(subscription.endpoint)}`, { method: 'GET' });
          if (response.ok) {
            const data = await response.json();
            if (data?.notification) payload = { ...payload, ...data.notification };
          }
        }
      }

      await self.registration.showNotification(payload.title, {
        body: payload.body,
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        data: { url: payload.url || '/chat' },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/chat';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ('focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
