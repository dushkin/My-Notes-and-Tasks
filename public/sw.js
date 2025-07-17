// sw.js
self.addEventListener('push', function (event) {
  console.log('Push event received:', event.data?.json());
  // Not currently used, as showNotification calls registration.showNotification directly
  event.waitUntil(Promise.resolve());
});

self.addEventListener('notificationclick', function (event) {
  const action = event.action;
  const notification = event.notification;
  const data = notification.data;

  console.log('Notification clicked:', { action, data });

  if (action === 'done') {
    event.waitUntil(
      handleDoneAction(data).then(() => notification.close())
    );
  } else if (action === 'snooze') {
    event.waitUntil(
      handleSnoozeAction(data).then(() => notification.close())
    );
  } else {
    notification.close();
    event.waitUntil(openAppAndFocusItem(data));
  }
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

// Handle "Done" action
async function handleDoneAction(data) {
  try {
    const clients = await self.clients.matchAll({ type: 'window' });
    console.log('Handling done action for item:', data.itemId, 'clients found:', clients.length);

    if (clients.length > 0) {
      clients.forEach(client => {
        client.postMessage({
          type: 'REMINDER_DONE',
          itemId: data.itemId,
          reminderId: data.reminderId
        });
      });
    } else {
      await storeAction('done', data);
      console.log('Stored done action for later processing:', data.itemId);
    }
  } catch (error) {
    console.error('Error handling done action:', error);
  }
}

// Handle "Snooze" action
async function handleSnoozeAction(data) {
  try {
    const clients = await self.clients.matchAll({ type: 'window' });
    console.log('Handling snooze action for item:', data.itemId, 'clients found:', clients.length);

    if (clients.length > 0) {
      clients.forEach(client => {
        client.postMessage({
          type: 'REMINDER_SNOOZE',
          itemId: data.itemId,
          reminderId: data.reminderId,
          originalData: data
        });
      });
      const visibleClient = clients.find(client => client.visibilityState === 'visible');
      if (!visibleClient && clients[0] && 'focus' in clients[0]) {
        clients[0].focus();
      }
    } else {
      await createDefaultSnooze(data);
      console.log('Created default snooze for item:', data.itemId);
    }
  } catch (error) {
    console.error('Error handling snooze action:', error);
  }
}

// Handle notification dismiss
async function handleNotificationDismiss(data) {
  try {
    const clients = await self.clients.matchAll({ type: 'window' });
    console.log('Sending REMINDER_DISMISSED for item:', data.itemId, 'to', clients.length, 'clients');
    if (clients.length > 0) {
      clients.forEach(client => {
        client.postMessage({
          type: 'REMINDER_DISMISSED',
          itemId: data.itemId,
          reminderId: data.reminderId
        });
      });
    }
  } catch (error) {
    console.error('Error handling notification dismiss:', error);
  }
}

// Open app and focus on specific item
async function openAppAndFocusItem(data) {
  try {
    const clients = await self.clients.matchAll({ type: 'window' });
    console.log('Opening app for item:', data.itemId, 'clients found:', clients.length);

    const appClient = clients.find(client =>
      client.url.includes(self.location.origin) &&
      (client.url.includes('/app') || client.url === self.location.origin + '/')
    );

    if (appClient) {
      appClient.postMessage({
        type: 'FOCUS_ITEM',
        itemId: data.itemId
      });
      if (appClient.visibilityState !== 'visible' && 'focus' in appClient) {
        return appClient.focus();
      }
      return;
    }

    if (self.clients.openWindow) {
      const url = '/app' + (data.itemId ? `?focus=${data.itemId}` : '');
      console.log('Opening new window:', url);
      return self.clients.openWindow(url);
    }
  } catch (error) {
    console.error('Error opening app:', error);
  }
}

// Store action for later processing
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

// Create default snooze when app is not open
async function createDefaultSnooze(data) {
  try {
    const snoozeTime = Date.now() + (10 * 60 * 1000);
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

self.addEventListener('notificationclick', function(event) {
  const action = event.action;
  const notification = event.notification;
  const data = notification.data;

  console.log('Notification click:', action, data);

  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function(clientList) {
      if (clientList.length > 0) {
        const client = clientList[0];
        if (action === 'snooze') {
          client.postMessage({ type: 'SNOOZE_REMINDER', itemId: data.itemId });
        } else if (action === 'done') {
          client.postMessage({ type: 'MARK_DONE', itemId: data.itemId });
        } else {
          client.focus();
        }
      }
    })
  );
});
