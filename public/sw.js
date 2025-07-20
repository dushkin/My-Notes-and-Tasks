self.addEventListener('push', function (event) {
  const data = event.data ? event.data.json() : {};
  console.log('Push event received:', data);

  const title = data.title || "Reminder";
  const options = {
    body: data.body || "You have a task reminder.",
    data: data.data || {},
    icon: "/icons/icon-192.png",
    badge: "/icons/badge-72.png",
    actions: [
      { action: "done", title: "✅ Done" },
      { action: "snooze", title: "Snooze" }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', function (event) {
  const action = event.action;
  const notification = event.notification;
  const data = notification.data;

  console.log('Notification clicked:', { action, data });

  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      if (clientList.length > 0) {
        const client = clientList[0];
        if (action === 'done') {
          client.postMessage({
            type: 'REMINDER_DONE',
            itemId: data.itemId,
            reminderId: data.reminderId
          });
        } else if (action === 'snooze') {
          client.postMessage({
            type: 'REMINDER_SNOOZE',
            itemId: data.itemId,
            reminderId: data.reminderId,
            originalData: data
          });
          if ('focus' in client) return client.focus(); // ADDED: force focus on snooze
        } else {
          client.postMessage({
            type: 'FOCUS_ITEM',
            itemId: data.itemId
          });
          if ('focus' in client) return client.focus();
        }
      } else {
        // No window is open: store action
        if (action === 'done') {
          return storeAction('done', data);
        } else if (action === 'snooze') {
          return createDefaultSnooze(data);
        }
      }
    })
  );
});

self.addEventListener('notificationclose', function (event) {
  const data = event.notification.data;
  console.log('Notification closed:', { data });

  event.waitUntil(
    handleNotificationDismiss(data).then(() => {
      console.log('Notification dismiss handled for item:', data.itemId);
    }).catch(error => {
      console.error('Error handling notification dismiss:', error);
    })
  );
});

// Helpers

async function handleNotificationDismiss(data) {
  try {
    const clients = await self.clients.matchAll({ type: 'window' });
    clients.forEach(client => {
      client.postMessage({
        type: 'REMINDER_DISMISSED',
        itemId: data.itemId,
        reminderId: data.reminderId
      });
    });
  } catch (error) {
    console.error('Error handling notification dismiss:', error);
  }
}

async function storeAction(actionType, data) {
  try {
    const request = indexedDB.open('NotificationActions', 1);

    request.onupgradeneeded = function (event) {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('actions')) {
        db.createObjectStore('actions', { keyPath: 'id', autoIncrement: true });
      }
    };

    request.onsuccess = function (event) {
      const db = event.target.result;
      const transaction = db.transaction(['actions'], 'readwrite');
      const store = transaction.objectStore('actions');

      store.add({
        type: actionType,
        itemId: data.itemId,
        reminderId: data.reminderId,
        timestamp: Date.now(),
        data: data
      });
      console.log('Stored action:', actionType, 'for item:', data.itemId);
    };
  } catch (error) {
    console.error('Error storing action:', error);
  }
}

async function createDefaultSnooze(data) {
  try {
    const snoozeTime = Date.now() + (10 * 60 * 1000); // 10 minutes
    await storeAction('snooze', {
      ...data,
      snoozeUntil: snoozeTime,
      snoozeDuration: 10,
      snoozeUnit: 'minutes'
    });
    console.log('Default snooze created for 10 minutes for item:', data.itemId);
  } catch (error) {
    console.error('Error creating default snooze:', error);
  }
}
