const VERSION = (new URL(self.location.href)).searchParams.get('v') || '1';
const CACHE_NAME = `notes-tasks-v${VERSION}`;
const STATIC_CACHE_URLS = [
  '/',
  '/app',
  '/favicon-32x32.png',
  '/favicon-192x192.png',
  '/favicon-128x128.png',
  '/favicon-48x48.png',
  '/site.webmanifest'
];

const NAV_SKIP_CACHE = ['/login', '/register', '/logout'];

const SYNC_TAGS = {
  DATA_SYNC: 'data-sync',
  REMINDER_ACTIONS: 'reminder-actions',
  DEVICE_REGISTRATION: 'device-registration'
};

// Define which API endpoints should NOT be intercepted by SW
const SKIP_SW_PATHS = [
  '/api/auth/beta-status',
  '/api/push/vapid-public-key',
  '/api/meta/user-count',
  '/api/meta/beta-status',
  '/api/health'
];

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
  console.log('🔄 SW: Activate event - current worker state:', {
    isActive: self.registration.active === self,
    scope: self.registration.scope
  });
  
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
    ]).then(() => {
      // Always claim clients and notify them of the activation
      return self.clients.claim().then(() => {
        console.log('🔄 SW: Clients claimed successfully');
        
        // Notify all clients that the new service worker is active
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ 
              type: 'SW_ACTIVATED',
              timestamp: Date.now() 
            });
          });
          console.log('🔄 SW: Notified', clients.length, 'clients of activation');
        });
      }).catch(error => {
        console.error('🔄 SW: Error claiming clients:', error);
        // Force reload on all clients as fallback
        return self.clients.matchAll().then(clients => {
          clients.forEach(client => {
            client.postMessage({ type: 'FORCE_RELOAD' });
          });
        });
      })
    })
  );
});

// Enhanced fetch event with better API handling
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Skip extension requests and other non-HTTP requests
  if (event.request.url.startsWith('chrome-extension://') ||
    event.request.url.startsWith('moz-extension://') ||
    !event.request.url.startsWith('http')) {
    return;
  }

  // Handle Google Tag Manager requests gracefully
  if (event.request.url.includes('googletagmanager.com') || event.request.url.includes('google-analytics.com')) {
    event.respondWith(
      fetch(event.request).catch(error => {
        console.warn('SW: Analytics request failed, providing fallback', error);
        return new Response('/* Analytics unavailable */', { 
          status: 200,
          headers: { 
            'Content-Type': 'application/javascript',
            'Cache-Control': 'no-cache'
          }
        });
      })
    );
    return;
  }

  // Handle API requests with better logic
  if (event.request.url.includes('/api/')) {
    // Check if this is a path we should skip SW handling for
    const shouldSkip = SKIP_SW_PATHS.some(path => event.request.url.includes(path));

    if (shouldSkip) {
      // Let these requests go directly to the network without SW interference
      console.log('SW: Skipping intercept for:', event.request.url);
      return;
    }

    // Only handle write operations or authenticated API requests
    if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(event.request.method)) {
      event.respondWith(handleAPIRequest(event.request));
    }
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }

        if (event.request.mode === 'navigate') {
          const url = new URL(event.request.url);
          if (NAV_SKIP_CACHE.some(p => url.pathname.startsWith(p))) {
            // Always network-fetch auth routes; do not cache
            return fetch(event.request).catch(() => caches.match('/') );
          }
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
                  '<!DOCTYPE html><html><head><title>Offline</title></head><body><h1>Offline</h1><p>Please check your internet connection.</p></body></html>',
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
            return caches.match(event.request).then(cachedResponse => {
              if (cachedResponse) {
                return cachedResponse;
              }
              return new Response('Resource not available offline', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/plain' }
              });
            }).catch(() => {
              return new Response('Service temporarily unavailable', {
                status: 503,
                statusText: 'Service Unavailable',
                headers: { 'Content-Type': 'text/plain' }
              });
            });
          });
      })
      .catch(error => {
        console.error('Cache match failed:', error);
        return fetch(event.request).catch(() =>
          new Response('Service temporarily unavailable', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'Content-Type': 'text/plain' }
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

  console.log('🔔 Notification clicked:', { action, data });
  event.notification.close();

  event.waitUntil(
    handleNotificationAction(action, data)
      .then(() => trackNotificationEvent('clicked', data, action))
      .catch(error => {
        console.error('❌ Error handling notification action:', error);
        // Fallback: just open the app
        self.clients.openWindow('/app');
      })
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
  const { type, data } = event.data || {};

  switch (type) {
    case 'SKIP_WAITING':
      console.log('🔄 SW: Received SKIP_WAITING message, taking control...');
      
      // Notify the client that we're starting the update process
      event.ports[0]?.postMessage?.({ type: 'SKIP_WAITING_STARTED' });
      
      // Skip waiting immediately
      self.skipWaiting()
        .then(() => {
          console.log('🔄 SW: skipWaiting() completed successfully');
          // The 'activate' event should trigger after this
        })
        .catch((error) => {
          console.error('🔄 SW: skipWaiting() failed:', error);
          // Try to reload anyway
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({ type: 'FORCE_RELOAD' });
            });
          });
        });
      break;
    case 'SYNC_REQUEST':
      event.waitUntil(triggerDataSync());
      break;
    case 'REGISTER_DEVICE':
      event.waitUntil(registerDeviceAndSync());
      break;
    case 'UPDATE_SYNC_STATUS':
      event.waitUntil(updateSyncStatus(data));
      break;
    case 'SCHEDULE_REMINDER':
      event.waitUntil(handleScheduleReminder(data));
      break;
    case 'CANCEL_REMINDER':
      event.waitUntil(handleCancelReminder(data));
      break;
    default:
      console.log('🔄 SW: Unknown message type:', type);
  }
});

// Helper Functions

async function handleScheduleReminder(data) {
  console.log('🔔 SW: Scheduling reminder:', data);
  
  const { itemId, timestamp, itemTitle, reminderData } = data;
  
  // Convert timestamp to number if it's a string
  const timestampMs = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
  
  if (!timestampMs || timestampMs <= Date.now()) {
    // Show immediately if time has passed or is invalid
    await showReminderNotification({
      title: '⏰ Reminder',
      body: `Don't forget: ${itemTitle || 'Untitled'}`,
      itemId,
      ...reminderData
    });
    return;
  }
  
  // Calculate delay
  const delay = timestampMs - Date.now();
  
  // Store reminder for later triggering
  try {
    const db = await openDatabase();
    const transaction = db.transaction(['scheduledReminders'], 'readwrite');
    const store = transaction.objectStore('scheduledReminders');
    
    await store.put({
      id: itemId,
      timestamp: timestampMs,
      itemTitle: itemTitle || 'Untitled',
      reminderData,
      scheduled: Date.now()
    });
    
    console.log(`🔔 SW: Reminder scheduled for ${new Date(timestampMs)}, delay: ${delay}ms`);
    
    // Set timeout to trigger the reminder
    setTimeout(async () => {
      await showReminderNotification({
        title: '⏰ Reminder',
        body: `Don't forget: ${itemTitle || 'Untitled'}`,
        itemId,
        ...reminderData
      });
      
      // Remove from scheduled reminders
      try {
        const db = await openDatabase();
        const transaction = db.transaction(['scheduledReminders'], 'readwrite');
        const store = transaction.objectStore('scheduledReminders');
        await store.delete(itemId);
      } catch (error) {
        console.error('Error removing triggered reminder:', error);
      }
    }, delay);
    
  } catch (error) {
    console.error('Error storing scheduled reminder:', error);
    // Fallback to immediate notification
    await showReminderNotification({
      title: '⏰ Reminder',
      body: `Don't forget: ${itemTitle || 'Untitled'}`,
      itemId,
      ...reminderData
    });
  }
}

async function handleCancelReminder(data) {
  console.log('🔔 SW: Cancelling reminder:', data);
  
  const { itemId } = data;
  
  try {
    const db = await openDatabase();
    const transaction = db.transaction(['scheduledReminders'], 'readwrite');
    const store = transaction.objectStore('scheduledReminders');
    
    await store.delete(itemId);
    console.log(`🔔 SW: Reminder cancelled for item: ${itemId}`);
  } catch (error) {
    console.error('Error cancelling reminder:', error);
  }
}

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
      try {
        await storeOfflineRequest(request);

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
      } catch (storeError) {
        console.error('Failed to store offline request:', storeError);

        return new Response(
          JSON.stringify({
            error: 'Failed to handle offline request',
            offline: true
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }

    // For read operations, return a proper error response
    return new Response(
      JSON.stringify({
        error: 'Service temporarily unavailable',
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

  console.log('🔍 Service Worker registerDeviceAndSync called');
  console.trace('🔍 Service Worker call stack')

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
      await store.put(deviceRecord);
    }

    // Only try to register with server if we have auth token
    try {
      const token = await getAuthToken();
      if (token) {
        await fetch('/api/sync/devices/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(deviceInfo)
        });
        console.log('Device registered with server');
      } else {
        console.log('No auth token, skipping server registration');
      }
    } catch (error) {
      console.log('Device registration will sync when online and authenticated');
    }

    // Trigger initial data sync only if authenticated
    const token = await getAuthToken();
    if (token) {
      await triggerDataSync();
    }
  } catch (error) {
    console.error('Error registering device:', error);
  }
}

async function getAuthToken() {
  try {
    // Try to get token from localStorage (this is a simplified approach)
    const clients = await self.clients.matchAll();
    for (const client of clients) {
      try {
        // Ask the client for the auth token
        const response = await new Promise((resolve) => {
          const messageChannel = new MessageChannel();
          messageChannel.port1.onmessage = (event) => {
            resolve(event.data);
          };
          client.postMessage({ type: 'GET_AUTH_TOKEN' }, [messageChannel.port2]);
        });

        if (response && response.token) {
          return response.token;
        }
      } catch (e) {
        console.warn('Could not get auth token from client:', e);
      }
    }
    return null;
  } catch (error) {
    console.warn('Failed to get auth token:', error);
    return null;
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
      deviceId = typeof storedDeviceId === 'string' ? storedDeviceId : (storedDeviceId.value || generateDeviceId());
    }
  } catch (error) {
    console.warn('Error getting device ID, generating new one:', error);
    deviceId = generateDeviceId();
  }

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
    const token = await getAuthToken();
    if (!token) {
      console.log('No auth token available for sync');
      return;
    }

    const db = await openDatabase();

    // Sync offline requests
    await syncOfflineRequests(db, token);

    // Trigger sync on server (using the actual endpoint)
    try {
      await fetch('/api/sync/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          dataType: 'all'
        })
      });
      console.log('Server sync triggered successfully');
    } catch (syncError) {
      console.warn('Failed to trigger server sync:', syncError);
    }

    // Update device activity
    try {
      const deviceId = await getDeviceId();
      if (deviceId) {
        await fetch('/api/sync/devices/activity', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            deviceId: deviceId
          })
        });
        console.log('Device activity updated successfully');
      }
    } catch (activityError) {
      console.warn('Failed to update device activity:', activityError);
    }

    // Update last sync time
    await updateLastSyncTime(db);

    // Notify clients of successful sync
    await notifyClientsOfSync();

    console.log('Data sync completed successfully');
  } catch (error) {
    console.error('Error syncing offline data:', error);
  }
}

async function syncOfflineRequests(db, token) {
  try {
    const transaction = db.transaction(['offlineRequests'], 'readwrite');
    const store = transaction.objectStore('offlineRequests');
    const requests = await store.getAll();

    if (!Array.isArray(requests)) {
      console.log('No offline requests to sync');
      return;
    }

    console.log(`Syncing ${requests.length} offline requests`);

    for (const requestData of requests) {
      try {
        const headers = { ...requestData.headers };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(requestData.url, {
          method: requestData.method,
          headers: headers,
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
    const token = await getAuthToken();
    if (!token) return;

    const deviceId = await getDeviceId();

    // Use the correct sync trigger endpoint
    await fetch('/api/sync/trigger', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        deviceId: deviceId,
        dataType: 'all',
        timestamp: Date.now()
      })
    });

    console.log('Notified other devices of changes');
  } catch (error) {
    console.log('Could not notify other devices:', error);
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

    try {
      for (const [key, value] of request.headers.entries()) {
        requestData.headers[key] = value;
      }
    } catch (headerError) {
      console.warn('Could not extract headers:', headerError);
    }

    await store.add(requestData);
    console.log('Stored offline request:', request.method, request.url);

    if ('serviceWorker' in self && 'sync' in self.ServiceWorkerRegistration.prototype) {
      try {
        await self.registration.sync.register(SYNC_TAGS.DATA_SYNC);
      } catch (syncError) {
        console.warn('Could not register background sync:', syncError);
      }
    }
  } catch (error) {
    console.error('Error storing offline request:', error);
    throw error;
  }
}

async function handleSyncNotification(data) {
  await triggerDataSync();
}

// Update the showReminderNotification function in sw.js
// Replace the existing function with this updated version:

async function showReminderNotification(data) {
  const title = data.title || "⏰ Reminder";
  // Get the shouldDisplayDoneButton setting from multiple possible locations
  const shouldDisplayDoneButton = data.shouldDisplayDoneButton ?? 
                                  data.data?.shouldDisplayDoneButton ?? 
                                  data.reminderDisplayDoneButton ?? 
                                  true;

  console.log('🔔 SW: showReminderNotification - shouldDisplayDoneButton:', shouldDisplayDoneButton);
  console.log('🔔 SW: Full data received:', data);

  // Configure actions based on setting
  const actions = shouldDisplayDoneButton ? [
    { action: "done", title: "✅ Done", icon: "/favicon-32x32.png" },
    { action: "snooze", title: "⏰ Snooze", icon: "/favicon-32x32.png" },
    { action: "open", title: "📱 Open App", icon: "/favicon-32x32.png" }
  ] : [
    { action: "snooze", title: "⏰ Snooze", icon: "/favicon-32x32.png" },
    { action: "open", title: "📱 Open App", icon: "/favicon-32x32.png" }
  ];

  // 🚨 ENHANCED MOBILE VISIBILITY OPTIONS
  const options = {
    body: data.body || "You have a task reminder.",
    icon: "/favicon-192x192.png",
    badge: "/favicon-48x48.png",
    image: "/favicon-192x192.png", // Large image for Android expanded view
    tag: data.tag || `reminder-${data.itemId || Date.now()}`,
    data: data.data || data,
    
    // 🎯 HIGH VISIBILITY SETTINGS
    requireInteraction: true, // ALWAYS require interaction for maximum visibility
    persistent: true, // Don't auto-dismiss
    renotify: true, // Allow re-notification of same tag
    
    // 🔊 ATTENTION-GRABBING SETTINGS
    silent: false, // Always allow sound
    vibrate: [500, 200, 500, 200, 500], // Longer, more noticeable vibration pattern
    
    // 📱 MOBILE-SPECIFIC URGENCY
    urgency: 'high', // Chrome/Edge priority
    priority: 'high', // General priority hint
    
    // 🌟 VISUAL ENHANCEMENTS
    dir: 'ltr',
    lang: 'en',
    timestamp: Date.now(),
    
    // 📋 ACTION BUTTONS
    actions: actions,
    
    // 🔴 ANDROID-SPECIFIC HIGH VISIBILITY
    android: {
      channelId: 'reminders-urgent', // Create high-priority channel
      priority: 2, // PRIORITY_HIGH (Android)
      visibility: 1, // VISIBILITY_PUBLIC (show on lock screen)
      category: 'alarm', // Android alarm category for urgent reminders
      color: '#FF4444', // Red accent color
      ongoing: false, // Can be dismissed
      autoCancel: true,
      largeIcon: '/favicon-192x192.png',
      bigPicture: '/favicon-192x192.png',
      bigText: data.body || "You have a task reminder.",
      subText: '🔔 Task Reminder',
      showWhen: true,
      when: Date.now(),
      usesChronometer: false,
      chronometerCountDown: false,
      number: 1,
      ticker: `⏰ ${data.body || "Task reminder"}`,
      // 🚨 FULL SCREEN INTENT (highest priority - shows over other apps)
      fullScreenIntent: true,
      // 🔊 SOUND AND VIBRATION OVERRIDE
      sound: 'default',
      vibrationPattern: [500, 200, 500, 200, 500],
      lights: {
        argb: 0xFFFF4444, // Red light
        onMs: 1000,
        offMs: 1000
      }
    },

    // 🍎 iOS-SPECIFIC SETTINGS
    ios: {
      // iOS doesn't support many customizations, but these help
      sound: 'default',
      badge: 1,
      alert: {
        title: title,
        body: data.body || "You have a task reminder.",
        'launch-image': '/favicon-192x192.png'
      },
      category: 'REMINDER_CATEGORY', // Must be registered in app
      'thread-id': 'reminders', // Group related notifications
      'target-content-id': data.itemId,
      'interruption-level': 'active' // iOS 15+ interruption level
    }
  };

  console.log('🔔 SW: Enhanced notification options:', {
    requireInteraction: options.requireInteraction,
    persistent: options.persistent,
    urgency: options.urgency,
    vibrationPattern: options.vibrate,
    androidPriority: options.android?.priority,
    fullScreenIntent: options.android?.fullScreenIntent
  });

  await self.registration.showNotification(title, options);
  console.log('🔔 SW: Enhanced reminder notification displayed successfully');

  // 🔄 NO AUTO-DISMISS - Let requireInteraction handle it
  // The notification will stay until user interacts
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

    const request = indexedDB.open('PWASync', 4);

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
        if (!db.objectStoreNames.contains('actions')) {
          const actionStore = db.createObjectStore('actions', { keyPath: 'id', autoIncrement: true });
          actionStore.createIndex('synced', 'synced', { unique: false });
          actionStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('notifications')) {
          const notificationStore = db.createObjectStore('notifications', { keyPath: 'id', autoIncrement: true });
          notificationStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('offlineRequests')) {
          const offlineStore = db.createObjectStore('offlineRequests', { keyPath: 'id' });
          offlineStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('devices')) {
          const deviceStore = db.createObjectStore('devices', { keyPath: 'id' });
          deviceStore.createIndex('lastActive', 'lastActive', { unique: false });
        }

        if (!db.objectStoreNames.contains('syncData')) {
          const syncStore = db.createObjectStore('syncData', { keyPath: 'id' });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings');
        }

        if (!db.objectStoreNames.contains('scheduledReminders')) {
          const reminderStore = db.createObjectStore('scheduledReminders', { keyPath: 'id' });
          reminderStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        console.log('IndexedDB upgraded successfully to version 4');
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
    const token = await getAuthToken();
    if (!token) {
      console.log('No auth token available for reminder sync');
      return;
    }

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
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
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

console.log('Service Worker script loaded successfully with enhanced error handling and auth support');