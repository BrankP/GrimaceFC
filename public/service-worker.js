self.addEventListener('push', (event) => {
  console.info('[push-sw] push_event_received', { hasData: Boolean(event.data), at: new Date().toISOString() });
  event.waitUntil(
    (async () => {
      let payload = { title: 'New message in chat', body: 'Open chat to view the message.', url: '/chat', tag: 'Grimace FC' };

      if (event.data) {
        try {
          payload = { ...payload, ...event.data.json() };
        } catch {
          payload.body = event.data.text();
        }
      } else {
        const subscription = await self.registration.pushManager.getSubscription();
        if (subscription?.endpoint) {
          console.info('[push-sw] pending_fetch_start', { endpointHost: new URL(subscription.endpoint).host, at: new Date().toISOString() });
          const response = await fetch(`/api/push/pending?endpoint=${encodeURIComponent(subscription.endpoint)}`, { method: 'GET' });
          console.info('[push-sw] pending_fetch_complete', { ok: response.ok, status: response.status, at: new Date().toISOString() });
          if (response.ok) {
            const data = await response.json();
            if (data?.notification) payload = { ...payload, ...data.notification };
          }
        }
      }

      const existing = await self.registration.getNotifications({ tag: payload.tag || 'Grimace FC' });
      const currentTitle = existing[0]?.title || '';
      const match = currentTitle.match(/^(\d+)\s+new messages in chat$/i);
      const previousCount = match ? Number(match[1]) : existing.length ? 1 : 0;
      const nextCount = previousCount + 1;
      const computedTitle = nextCount > 1 ? `${nextCount} new messages in chat` : 'New message in chat';

      console.info('[push-sw] show_notification', { title: computedTitle, tag: payload.tag || 'Grimace FC', at: new Date().toISOString() });
      await self.registration.showNotification(computedTitle, {
        body: payload.body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: payload.tag || 'Grimace FC',
        renotify: false,
        data: { url: payload.url || '/chat' },
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  console.info('[push-sw] notification_click', { at: new Date().toISOString(), url: event.notification.data?.url || '/chat' });
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
