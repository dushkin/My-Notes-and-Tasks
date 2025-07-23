const CACHE_NAME = 'notes-tasks-v1.2.0';
const STATIC_CACHE_URLS = [
  '/',
  '/app',
  '/favicon-32x32.png',
  '/favicon-192x192.png',
  '/favicon-128x128.png',
  '/favicon-48x48.png',
  '/site.webmanifest'
];

const SYNC_TAGS = {
  DATA_SYNC: 'data-sync',
  REMINDER_ACTIONS: 'reminder-actions',
  DEVICE_REGISTRATION: 'device-registration'
};

// Install event - cache static resources with error handling
self.addEventListener('install', (event) => {
  console.log('Service Worker installing');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching static resources');

        // Cache resources one by one to handle failures gracefully
        return Promise.allSettled(
          STATIC_CACHE_URLS.map(url => {
            return cache.add(url).catch(error => {
              console.warn(`Failed to cache ${url}:`, error);
              // Don't let individual failures break the entire cache operation
              return null;
            });
          })
        );
      })
      .then((results) => {
        const failedCaches = results
          .filter((result, index) => result.status === 'rejected')
          .map((result, index) => STATIC_CACHE_URLS[index]);

        if (failedCaches.length > 0) {
          console.warn('Some resources failed to cache:', failedCaches);
        }

        console.log('Service Worker installation completed');
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('Service Worker installation failed:', error);
        // Don't prevent installation due to cache failures
        return self.skipWaiting();
      })
  );
});

// Activate event - clean up old caches and register device
self.addEventListener('activate', (event) => {
  console.log('Service Worker activating');
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== CACHE_NAME) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      // Register device and sync
      registerDeviceAndSync()
    ]).then(() => self.clients.claim())
  );
});

// Enhanced fetch event with offline sync support and error handling
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Skip extension requests and other non-HTTP requests
  if (event.request.url.startsWith('chrome-extension://') ||
    event.request.url.startsWith('moz-extension://') ||
    !event.request.url.startsWith('http')) {
    return;
  }

  // Handle API requests with offline support
  if (event.request.url.includes('/api/')) {
    event.respondWith(handleAPIRequest(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }

        if (event.request.mode === 'navigate') {
          return fetch(event.request)
            .then(response => {
              if (response && response.status === 200) {
                const responseClone = response.clone();
                caches.open(CACHE_NAME)
                  .then(cache => cache.put(event.request, responseClone))
                  .catch(error => console.warn('Failed to cache navigation response:', error));
              }
              return response;
            })
            .catch(() => {
              return caches.match('/app') || caches.match('/') ||
                new Response(
                  '<!DOCTYPE html><html><head><title>Offline</title></head><body><h1>You are offline</h1><p>Please check your internet connection.</p></body></html>',
                  { headers: { 'Content-Type': 'text/html' } }
                );
            });
        }

        return fetch(event.request)
          .then(response => {
            // Cache successful responses
            if (response && response.status === 200 && response.type === 'basic') {
              const responseClone = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => cache.put(event.request, responseClone))
                .catch(error => console.warn('Failed to cache response:', error));
            }
            return response;
          })
          .catch(error => {
            console.warn('Fetch failed for:', event.request.url, error);
            return caches.match(event.request) ||
              new Response('Resource not available offline', {
                status: 503,
                statusText: 'Service Unavailable'
              });
          });
      })
      .catch(error => {
        console.error('Cache match failed:', error);
        return fetch(event.request).catch(() =>
          new Response('Service temporarily unavailable', {
            status: 503,
            statusText: 'Service Unavailable'
          })
        );
      })
  );
});

// Enhanced background sync
self.addEventListener('sync', (event) => {
  console.log('Background sync triggered:', event.tag);

  switch (event.tag) {
    case SYNC_TAGS.DATA_SYNC:
      event.waitUntil(syncOfflineData());
      break;
    case SYNC_TAGS.REMINDER_ACTIONS:
      event.waitUntil(syncReminderActions());
      break;
    case SYNC_TAGS.DEVICE_REGISTRATION:
      event.waitUntil(registerDeviceAndSync());
      break;
  }
});

// Enhanced push notification handling
self.addEventListener('push', function (event) {
  console.log('Push event received:', event);

  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.error('Failed to parse push data:', e);
      data = { title: 'Reminder', body: 'You have a notification' };
    }
  }

  // Handle different types of push notifications
  switch (data.type) {
    case 'sync':
      event.waitUntil(handleSyncNotification(data));
      return;
    case 'reminder':
      event.waitUntil(showReminderNotification(data));
      break;
    case 'device_sync':
      event.waitUntil(handleDeviceSyncNotification(data));
      break;
    default:
      event.waitUntil(showDefaultNotification(data));
  }
});

// Enhanced notification click handling
self.addEventListener('notificationclick', function (event) {
  const action = event.action;
  const notification = event.notification;
  const data = notification.data;

  console.log('Notification clicked:', { action, data });
  event.notification.close();

  event.waitUntil(
    handleNotificationAction(action, data)
      .then(() => trackNotificationEvent('clicked', data, action))
  );
});

self.addEventListener('notificationclose', function (event) {
  const data = event.notification.data;
  console.log('Notification closed:', { data });

  event.waitUntil(
    handleNotificationDismiss(data)
      .then(() => trackNotificationEvent('dismissed', data))
  );
});

// Message handling for cross-tab communication
self.addEventListener('message', (event) => {
  const { type, data } = event.data;

  switch (type) {
    case 'SYNC_REQUEST':
      event.waitUntil(triggerDataSync());
      break;
    case 'REGISTER_DEVICE':
      event.waitUntil(registerDeviceAndSync());
      break;
    case 'UPDATE_SYNC_STATUS':
      event.waitUntil(updateSyncStatus(data));
      break;
  }
});

// Helper Functions

async function handleAPIRequest(request) {
  const url = new URL(request.url);
  const isWriteOperation = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method);

  try {
    const response = await fetch(request);

    if (response && response.ok && isWriteOperation) {
      // Trigger sync to other devices after successful write
      await notifyOtherDevicesOfChange().catch(error =>
        console.warn('Failed to notify other devices:', error)
      );
    }

    return response;
  } catch (error) {
    console.warn('API request failed:', request.url, error.message);

    if (isWriteOperation) {
      // Store offline for later sync
      await storeOfflineRequest(request).catch(storeError =>
        console.error('Failed to store offline request:', storeError)
      );

      return new Response(
        JSON.stringify({
          success: true,
          offline: true,
          message: 'Stored for sync when connection returns'
        }),
        {
          status: 202,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // For read operations, try to serve from cache or return error
    try {
      const cachedResponse = await caches.match(request);
      if (cachedResponse) {
        return cachedResponse;
      }
    } catch (cacheError) {
      console.warn('Cache lookup failed:', cacheError);
    }

    return new Response(
      JSON.stringify({
        error: 'Offline and no cached data available',
        offline: true
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}

async function registerDeviceAndSync() {
  try {
    const deviceInfo = await getDeviceInfo();
    const db = await openDatabase();

    // Store device info locally
    const transaction = db.transaction(['devices'], 'readwrite');
    const store = transaction.objectStore('devices');

    let existingDevice = null;
    try {
      if (deviceInfo.id && typeof deviceInfo.id === 'string') {
        existingDevice = await store.get(deviceInfo.id);
      }
    } catch (error) {
      console.warn('Could not get existing device, creating new one:', error);
      existingDevice = null;
    }

    if (!existingDevice) {
      const deviceRecord = {
        id: deviceInfo.id,
        userAgent: deviceInfo.userAgent || '',
        platform: deviceInfo.platform || '',
        type: deviceInfo.type || '',
        name: deviceInfo.name || '',
        lastActive: deviceInfo.lastActive || Date.now(),
        capabilities: {
          pushNotifications: deviceInfo.capabilities?.pushNotifications || false,
          backgroundSync: deviceInfo.capabilities?.backgroundSync || false,
          indexedDB: deviceInfo.capabilities?.indexedDB || false
        },
        lastSync: Date.now(),
        isCurrentDevice: true
      };

      console.log('🔍 Device record to store:', deviceRecord);
      console.log('🔍 Device record type check:', typeof deviceRecord);
      console.log('🔍 Device record JSON test:', JSON.stringify(deviceRecord));

      await store.put(deviceRecord);
    }

    // Register with server if online
    try {
      await fetch('/api/devices/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(deviceInfo)
      });
    } catch (error) {
      console.log('Device registration will sync when online');
    }

    // Trigger initial data sync
    await triggerDataSync();
  } catch (error) {
    console.error('Error registering device:', error);
  }
}

async function getDeviceInfo() {
  const userAgent = self.navigator.userAgent;
  const platform = self.navigator.platform || 'Unknown';

  // Generate or retrieve device ID
  const db = await openDatabase();
  const transaction = db.transaction(['settings'], 'readonly');
  const store = transaction.objectStore('settings');

  let deviceId;
  try {
    const storedDeviceId = await store.get('deviceId');
    if (!storedDeviceId) {
      deviceId = generateDeviceId();
      const writeTransaction = db.transaction(['settings'], 'readwrite');
      const writeStore = writeTransaction.objectStore('settings');
      await writeStore.put(deviceId, 'deviceId');
    } else {
      // Extract the actual value, not the IDBRequest
      deviceId = typeof storedDeviceId === 'string' ? storedDeviceId : (storedDeviceId.value || generateDeviceId());
    }
  } catch (error) {
    console.warn('Error getting device ID, generating new one:', error);
    deviceId = generateDeviceId();
  }

  // Ensure deviceId is always a string
  deviceId = String(deviceId);

  return {
    id: deviceId,
    userAgent,
    platform,
    type: detectDeviceType(userAgent),
    name: generateDeviceName(userAgent, platform),
    lastActive: Date.now(),
    capabilities: {
      pushNotifications: 'PushManager' in self,
      backgroundSync: 'serviceWorker' in self && 'sync' in self.ServiceWorkerRegistration.prototype,
      indexedDB: 'indexedDB' in self
    }
  };
}

function detectDeviceType(userAgent) {
  if (/iPhone|iPad|iPod/.test(userAgent)) return 'iOS';
  if (/Android/.test(userAgent)) return 'Android';
  if (/Mac/.test(userAgent)) return 'macOS';
  if (/Win/.test(userAgent)) return 'Windows';
  if (/Linux/.test(userAgent)) return 'Linux';
  return 'Unknown';
}

function generateDeviceName(userAgent, platform) {
  const type = detectDeviceType(userAgent);
  const timestamp = new Date().toLocaleDateString();

  if (type === 'iOS') {
    if (userAgent.includes('iPhone')) return `iPhone (${timestamp})`;
    if (userAgent.includes('iPad')) return `iPad (${timestamp})`;
  }

  return `${type} Device (${timestamp})`;
}

function generateDeviceId() {
  return 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

async function triggerDataSync() {
  try {
    if ('serviceWorker' in self && 'sync' in self.ServiceWorkerRegistration.prototype) {
      await self.registration.sync.register(SYNC_TAGS.DATA_SYNC);
    } else {
      await syncOfflineData();
    }
  } catch (error) {
    console.error('Error triggering data sync:', error);
  }
}

async function syncOfflineData() {
  try {
    const db = await openDatabase();

    // Sync offline requests
    await syncOfflineRequests(db);

    // Sync data changes
    await syncDataChanges(db);

    // Update last sync time
    await updateLastSyncTime(db);

    // Notify clients of successful sync
    await notifyClientsOfSync();

    console.log('Data sync completed successfully');
  } catch (error) {
    console.error('Error syncing offline data:', error);
  }
}

async function syncOfflineRequests(db) {
  try {
    const transaction = db.transaction(['offlineRequests'], 'readwrite');
    const store = transaction.objectStore('offlineRequests');
    const requests = await store.getAll();

    // Ensure requests is an array
    if (!Array.isArray(requests)) {
      console.log('No offline requests to sync');
      return;
    }

    console.log(`Syncing ${requests.length} offline requests`);

    for (const requestData of requests) {
      try {
        const response = await fetch(requestData.url, {
          method: requestData.method,
          headers: requestData.headers,
          body: requestData.body
        });

        if (response.ok) {
          await store.delete(requestData.id);
          console.log('Synced offline request:', requestData.method, requestData.url);
        }
      } catch (error) {
        console.log('Failed to sync request, will retry later:', requestData.url);
      }
    }
  } catch (error) {
    console.error('Error in syncOfflineRequests:', error);
  }
}

async function syncDataChanges(db) {
  try {
    // Fetch latest data from server
    const response = await fetch('/api/sync/data', {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      const serverData = await response.json();

      // Store updated data locally
      const transaction = db.transaction(['syncData'], 'readwrite');
      const store = transaction.objectStore('syncData');

      await store.put({
        id: 'latest',
        data: serverData,
        timestamp: Date.now()
      });

      console.log('Updated local data from server');
    }
  } catch (error) {
    console.log('Could not fetch server data, using cached version');
  }
}

async function updateLastSyncTime(db) {
  const transaction = db.transaction(['settings'], 'readwrite');
  const store = transaction.objectStore('settings');
  await store.put(Date.now(), 'lastSyncTime');
}

async function notifyClientsOfSync() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({
      type: 'SYNC_COMPLETED',
      timestamp: Date.now()
    });
  });
}

async function notifyOtherDevicesOfChange() {
  try {
    await fetch('/api/sync/notify-devices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        timestamp: Date.now(),
        deviceId: await getDeviceId()
      })
    });
  } catch (error) {
    console.log('Could not notify other devices');
  }
}

async function getDeviceId() {
  const db = await openDatabase();
  const transaction = db.transaction(['settings'], 'readonly');
  const store = transaction.objectStore('settings');
  const deviceId = await store.get('deviceId');
  return deviceId?.value || deviceId || 'unknown';
}

async function storeOfflineRequest(request) {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(['offlineRequests'], 'readwrite');
    const store = transaction.objectStore('offlineRequests');

    // Clone the request to read the body
    const clonedRequest = request.clone();
    let body = '';

    try {
      body = await clonedRequest.text();
    } catch (bodyError) {
      console.warn('Could not read request body:', bodyError);
      body = '';
    }

    const requestData = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      url: request.url,
      method: request.method,
      headers: {},
      body: body,
      timestamp: Date.now()
    };

    // Safely extract headers
    try {
      for (const [key, value] of request.headers.entries()) {
        requestData.headers[key] = value;
      }
    } catch (headerError) {
      console.warn('Could not extract headers:', headerError);
    }

    await store.add(requestData);
    console.log('Stored offline request:', request.method, request.url);

    // Register for background sync
    if ('serviceWorker' in self && 'sync' in self.ServiceWorkerRegistration.prototype) {
      try {
        await self.registration.sync.register(SYNC_TAGS.DATA_SYNC);
      } catch (syncError) {
        console.warn('Could not register background sync:', syncError);
      }
    }
  } catch (error) {
    console.error('Error storing offline request:', error);
    throw error; // Re-throw so caller knows it failed
  }
}

async function handleSyncNotification(data) {
  // Silent sync notification - just trigger sync
  await triggerDataSync();
}

async function showReminderNotification(data) {
  const title = data.title || "⏰ Reminder";
  const options = {
    body: data.body || "You have a task reminder.",
    icon: "/favicon-192x192.png",
    badge: "/favicon-48x48.png",
    tag: data.tag || `reminder-${data.itemId || Date.now()}`,
    data: data.data || data,
    requireInteraction: true,
    silent: false,
    vibrate: [200, 100, 200],
    actions: [
      { action: "done", title: "✅ Done", icon: "/favicon-32x32.png" },
      { action: "snooze", title: "⏰ Snooze", icon: "/favicon-32x32.png" },
      { action: "open", title: "📱 Open App", icon: "/favicon-32x32.png" }
    ],
    timestamp: Date.now(),
    renotify: true
  };

  await self.registration.showNotification(title, options);
  console.log('Reminder notification displayed successfully');
}

async function showDefaultNotification(data) {
  const title = data.title || "Notification";
  const options = {
    body: data.body || "You have a new notification.",
    icon: "/favicon-192x192.png",
    badge: "/favicon-48x48.png",
    tag: data.tag || `notification-${Date.now()}`,
    data: data.data || data,
    timestamp: Date.now()
  };

  await self.registration.showNotification(title, options);
}

async function handleDeviceSyncNotification(data) {
  // Show brief notification about sync
  const options = {
    body: "Syncing data across your devices...",
    icon: "/favicon-128x128.png",
    badge: "/favicon-48x48.png",
    tag: "device-sync",
    silent: true,
    data: data
  };

  await self.registration.showNotification("🔄 Syncing", options);
  await triggerDataSync();

  // Auto-close after 3 seconds
  setTimeout(async () => {
    const notifications = await self.registration.getNotifications({ tag: "device-sync" });
    notifications.forEach(notification => notification.close());
  }, 3000);
}

async function handleNotificationAction(action, data) {
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  if (clients.length > 0) {
    const client = clients[0];

    switch (action) {
      case 'done':
        client.postMessage({
          type: 'REMINDER_DONE',
          itemId: data.itemId,
          reminderId: data.reminderId
        });
        break;
      case 'snooze':
        client.postMessage({
          type: 'REMINDER_SNOOZE',
          itemId: data.itemId,
          reminderId: data.reminderId,
          originalData: data
        });
        if ('focus' in client) await client.focus();
        break;
      case 'open':
      default:
        client.postMessage({
          type: 'FOCUS_ITEM',
          itemId: data.itemId
        });
        if ('focus' in client) await client.focus();
        break;
    }
  } else {
    if (action === 'done') {
      await storeAction('done', data);
    } else if (action === 'snooze') {
      await createDefaultSnooze(data);
    }

    const urlToOpen = data.itemId ? `/app?focus=${data.itemId}` : '/app';
    await self.clients.openWindow(urlToOpen);
  }
}

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
    const db = await openDatabase();
    const transaction = db.transaction(['actions'], 'readwrite');
    const store = transaction.objectStore('actions');

    await store.add({
      type: actionType,
      itemId: data.itemId,
      reminderId: data.reminderId,
      timestamp: Date.now(),
      data: data,
      synced: false
    });

    console.log('Stored action:', actionType, 'for item:', data.itemId);

    if ('serviceWorker' in self && 'sync' in self.ServiceWorkerRegistration.prototype) {
      await self.registration.sync.register(SYNC_TAGS.REMINDER_ACTIONS);
    }
  } catch (error) {
    console.error('Error storing action:', error);
  }
}

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

async function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!('indexedDB' in self)) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = indexedDB.open('PWASync', 3);

    request.onerror = () => {
      console.error('IndexedDB error:', request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      try {
        // Actions store
        if (!db.objectStoreNames.contains('actions')) {
          const actionStore = db.createObjectStore('actions', { keyPath: 'id', autoIncrement: true });
          actionStore.createIndex('synced', 'synced', { unique: false });
          actionStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Notifications tracking
        if (!db.objectStoreNames.contains('notifications')) {
          const notificationStore = db.createObjectStore('notifications', { keyPath: 'id', autoIncrement: true });
          notificationStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Offline requests
        if (!db.objectStoreNames.contains('offlineRequests')) {
          const offlineStore = db.createObjectStore('offlineRequests', { keyPath: 'id' });
          offlineStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Device information
        if (!db.objectStoreNames.contains('devices')) {
          const deviceStore = db.createObjectStore('devices', { keyPath: 'id' });
          deviceStore.createIndex('lastActive', 'lastActive', { unique: false });
        }

        // Sync data
        if (!db.objectStoreNames.contains('syncData')) {
          const syncStore = db.createObjectStore('syncData', { keyPath: 'id' });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // Settings
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }

        console.log('IndexedDB upgraded successfully to version 3');
      } catch (upgradeError) {
        console.error('Error during database upgrade:', upgradeError);
        reject(upgradeError);
      }
    };

    request.onblocked = () => {
      console.warn('IndexedDB upgrade blocked by other connections');
    };
  });
}

async function syncReminderActions() {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(['actions'], 'readonly');
    const store = transaction.objectStore('actions');
    const index = store.index('synced');

    const unsyncedActions = await index.getAll(false);

    console.log('Syncing', unsyncedActions.length, 'unsynced actions');

    for (const action of unsyncedActions) {
      try {
        await fetch('/api/reminder-actions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(action)
        });

        const updateTransaction = db.transaction(['actions'], 'readwrite');
        const updateStore = updateTransaction.objectStore('actions');
        action.synced = true;
        await updateStore.put(action);

        console.log('Synced action:', action.type, 'for item:', action.itemId);
      } catch (error) {
        console.error('Failed to sync action:', error);
      }
    }
  } catch (error) {
    console.error('Error syncing reminder actions:', error);
  }
}

async function trackNotificationEvent(eventType, data, action = null) {
  try {
    const db = await openDatabase();
    const transaction = db.transaction(['notifications'], 'readwrite');
    const store = transaction.objectStore('notifications');

    await store.add({
      eventType,
      action,
      itemId: data.itemId,
      timestamp: Date.now(),
      userAgent: self.navigator.userAgent
    });
  } catch (error) {
    console.error('Error tracking notification event:', error);
  }
}

async function updateSyncStatus(data) {
  try {
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_STATUS_UPDATE',
        status: data.status,
        timestamp: Date.now()
      });
    });
  } catch (error) {
    console.error('Error updating sync status:', error);
  }
}

// Network status tracking with enhanced error handling
self.addEventListener('online', () => {
  console.log('Service Worker: Back online');

  // Attempt to register sync events when back online
  Promise.allSettled([
    self.registration.sync.register(SYNC_TAGS.DATA_SYNC),
    self.registration.sync.register(SYNC_TAGS.REMINDER_ACTIONS)
  ]).then(results => {
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        console.warn(`Failed to register sync ${index}:`, result.reason);
      }
    });
  });

  // Notify clients of online status
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'NETWORK_STATUS_CHANGE',
        online: true,
        timestamp: Date.now()
      });
    });
  }).catch(error => console.warn('Failed to notify clients of online status:', error));
});

self.addEventListener('offline', () => {
  console.log('Service Worker: Gone offline');

  // Notify clients of offline status
  self.clients.matchAll().then(clients => {
    clients.forEach(client => {
      client.postMessage({
        type: 'NETWORK_STATUS_CHANGE',
        online: false,
        timestamp: Date.now()
      });
    });
  }).catch(error => console.warn('Failed to notify clients of offline status:', error));
});

// Global error handling
self.addEventListener('error', (event) => {
  console.error('Service Worker global error:', event.error || event);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Service Worker unhandled rejection:', event.reason);
  event.preventDefault(); // Prevent the default behavior
});

console.log('Service Worker script loaded successfully with error handling patches');