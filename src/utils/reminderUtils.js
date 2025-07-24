import { getSocket } from '../services/socketClient';

const REMINDERS_STORAGE_KEY = 'notes_app_reminders';

/**
 * Stores a reminder and broadcasts to other devices via socket
 * @param {string} itemId - The ID of the item the reminder is for.
 * @param {number} timestamp - The Unix timestamp (in milliseconds) when the reminder should trigger.
 * @param {Object|null} repeatOptions - The repeat options for the reminder.
 */
export const setReminder = (itemId, timestamp, repeatOptions = null) => {
  const reminders = getReminders();
  const reminderData = {
    timestamp,
    itemId,
    repeatOptions
  };

  reminders[itemId] = reminderData;
  localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(reminders));

  // Notify local UI immediately
  window.dispatchEvent(new CustomEvent('remindersUpdated', {
    detail: reminders
  }));

  // Broadcast to other devices via socket
  const socket = getSocket();
  if (socket && socket.connected) {
    socket.emit('reminder:set', reminderData);
  }

  console.log(`Reminder set for item ${itemId} at ${new Date(timestamp)}`);
};

/**
 * Retrieves all stored reminders.
 * @returns {Object} An object where keys are item IDs and values are reminder objects.
 */
export const getReminders = () => {
  const remindersJson = localStorage.getItem(REMINDERS_STORAGE_KEY);
  return remindersJson ? JSON.parse(remindersJson) : {};
};

/**
 * Retrieves a specific reminder by item ID.
 * @param {string} itemId - The ID of the item.
 * @returns {Object|undefined} The reminder object, or undefined if not found.
 */
export const getReminder = (itemId) => {
  const reminders = getReminders();
  return reminders[itemId];
};

/**
 * Clears a specific reminder and broadcasts to other devices.
 * @param {string} itemId - The ID of the item whose reminder should be cleared.
 */
export const clearReminder = (itemId) => {
  const reminders = getReminders();
  delete reminders[itemId];
  localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(reminders));

  // Notify local UI immediately
  window.dispatchEvent(new CustomEvent('remindersUpdated', {
    detail: reminders
  }));

  // Broadcast to other devices via socket
  const socket = getSocket();
  if (socket && socket.connected) {
    socket.emit('reminder:clear', { itemId });
  }

  console.log(`Reminder cleared for item ${itemId}`);
};

/**
 * Updates a reminder (for snoozing) and broadcasts to other devices.
 * @param {string} itemId - The ID of the item.
 * @param {number} timestamp - The new timestamp.
 * @param {Object|null} repeatOptions - The repeat options.
 */
export const updateReminder = (itemId, timestamp, repeatOptions = null) => {
  const reminders = getReminders();
  const reminderData = {
    timestamp,
    itemId,
    repeatOptions
  };

  reminders[itemId] = reminderData;
  localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(reminders));

  // Notify local UI immediately
  window.dispatchEvent(new CustomEvent('remindersUpdated', {
    detail: reminders
  }));

  // Broadcast to other devices via socket
  const socket = getSocket();
  if (socket && socket.connected) {
    socket.emit('reminder:update', reminderData);
  }

  console.log(`Reminder updated for item ${itemId} at ${new Date(timestamp)}`);
};

/**
 * Clears all reminders from local storage and broadcasts to other devices.
 */
export const clearAllReminders = () => {
  const reminders = getReminders();

  localStorage.removeItem(REMINDERS_STORAGE_KEY);
  // Notify local UI immediately
  window.dispatchEvent(new CustomEvent('remindersUpdated', {
    detail: {}
  }));

  // Broadcast each clear to other devices
  const socket = getSocket();
  if (socket && socket.connected) {
    Object.keys(reminders).forEach(itemId => {
      socket.emit('reminder:clear', { itemId });
    });
  }

  console.log("All reminders cleared.");
};

/**
 * Formats a timestamp into a human-readable remaining time string.
 * @param {number} timestamp - The future Unix timestamp (in milliseconds).
 * @returns {string} A string like "in 5m", "in 2h", "in 3d", or "Due now".
 */
export const formatRemainingTime = (timestamp) => {
  const now = Date.now();
  const diff = timestamp - now; // Difference in milliseconds

  if (diff <= 0) {
    return "Due now";
  }

  const totalSeconds = Math.floor(diff / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const days = Math.floor(totalSeconds / 86400);

  if (days > 0) {
    return `in ${days}d ${hours}h`;
  } else if (hours > 0) {
    return `in ${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `in ${minutes}m ${seconds}s`;
  } else {
    return `in ${seconds}s`;
  }
};

/**
 * Creates a live countdown that updates every second
 * @param {number} timestamp - The future Unix timestamp (in milliseconds).
 * @param {Function} callback - Function to call with updated time string
 * @returns {Function} Cleanup function to stop the countdown
 */
export const createLiveCountdown = (timestamp, callback) => {
  const updateCountdown = () => {
    const timeString = formatRemainingTime(timestamp);
    callback(timeString);

    // If time is up, stop the countdown
    if (timestamp <= Date.now()) {
      clearInterval(intervalId);
    }
  };

  // Update immediately
  updateCountdown();
  // Then update every second
  const intervalId = setInterval(updateCountdown, 1000);
  // Return cleanup function
  return () => clearInterval(intervalId);
};

/**
 * Request notification permission from the user.
 * @returns {Promise<string>} The permission result.
 */
export const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    console.warn("This browser does not support notifications.");
    return "denied";
  }
  let permission = Notification.permission;
  if (permission === "default") {
    permission = await Notification.requestPermission();
  }
  return permission;
};

/**
 * Register the service worker for push notifications.
 * @returns {Promise<ServiceWorkerRegistration|null>} The registration or null if failed.
 */
export const registerServiceWorker = async () => {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service workers are not supported.");
    return null;
  }
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    console.log("Service Worker registered:", registration);
    return registration;
  } catch (error) {
    console.error("Service Worker registration failed:", error);
    return null;
  }
};

/**
 * Subscribe to push notifications.
 * @param {ServiceWorkerRegistration} registration - The service worker registration.
 * @returns {Promise<PushSubscription|null>} The push subscription or null if failed.
 */
export const subscribePush = async (registration) => {
  if (!("PushManager" in window)) {
    console.warn("Push messaging is not supported.");
    return null;
  }
  try {
    const subscription = await registration.pushManager.getSubscription();
    if (subscription) {
      return subscription;
    }
    // For demo purposes, we'll use a placeholder VAPID key
    // In production, replace with your actual VAPID public key
    const applicationServerKey = urlBase64ToUint8Array(
      "BEl62iUYgUivxIkv69yViEuiBIa40HI8YlOU3kNY7S6sSWgAjxgYrb2ckqwpXfFfQoirHCqOLlxDjXxKiDkfVVs"
    );
    const newSubscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    });
    console.log("Push subscription:", newSubscription);
    return newSubscription;
  } catch (error) {
    console.error("Push subscription failed:", error);
    return null;
  }
};

/**
 * Utility to convert VAPID key from base64 string to Uint8Array.
 * @param {string} base64String - The base64 encoded string.
 * @returns {Uint8Array} The converted Uint8Array.
 */
export const urlBase64ToUint8Array = (base64String) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

/**
 * Schedule a push notification for a reminder.
 * @param {string} title - Notification title.
 * @param {string} body - Notification body.
 * @param {number} timestamp - When to show the notification (Unix ms).
 * @param {Object} data - Additional data for the notification.
 */
export const schedulePushNotification = (title, body, timestamp, data = {}) => {
  if (!("serviceWorker" in navigator) || !("Notification" in window)) {
    console.warn("Push notifications not supported.");
    return;
  }
  if (Notification.permission !== "granted") {
    console.warn("Notification permission not granted.");
    return;
  }
  const delay = timestamp - Date.now();
  console.log(`Scheduling notification for ${title} at ${new Date(timestamp)} (delay: ${delay}ms)`);
  if (delay <= 0) {
    showNotification(title, body, data);
    return;
  }
  setTimeout(() => {
    showNotification(title, body, data);
  }, delay);
};

/**
 * Show a notification immediately.
 * @param {string} title - Notification title.
 * @param {string} body - Notification body.
 * @param {Object} data - Additional data for the notification.
 */
export const showNotification = (title, body, data = {}) => {
  if (Notification.permission !== "granted") {
    console.warn("Notification permission not granted.");
    return;
  }

  console.log('🔔 showNotification called:', { title, body, permission: Notification.permission });

  // Better mobile detection - check for touch capability and screen size
  const isMobile = /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent) || 
                   ('ontouchstart' in window) || 
                   (window.screen && window.screen.width <= 768);
  const isPageHidden = document.hidden;
  
  console.log('🔔 Device info:', { 
    isMobile, 
    isPageHidden, 
    hasTouch: 'ontouchstart' in window,
    screenWidth: window.screen?.width,
    userAgent: navigator.userAgent.substring(0, 100) 
  });
  
  // For mobile devices when page is hidden, try to bring attention
  if (isMobile && isPageHidden) {
    console.log('🔔 Mobile page hidden - trying to bring attention');
    // Try to focus the window
    if (window.focus) window.focus();
    
    // Flash the title to get attention
    const originalTitle = document.title;
    document.title = `🔔 ${title}`;
    setTimeout(() => {
      document.title = originalTitle;
    }, 3000);
  }

  // Check if Done button should be displayed (from settings)
  const shouldDisplayDoneButton = data?.reminderDisplayDoneButton ?? true; // Default to true
  const shouldRequireInteraction = shouldDisplayDoneButton;
  
  console.log('🔔 Done button setting:', {
    shouldDisplayDoneButton,
    shouldRequireInteraction,
    settingValue: data?.reminderDisplayDoneButton
  });

  // Always try service worker first (required for mobile)
  navigator.serviceWorker.getRegistration().then((registration) => {
    console.log('🔔 Service worker registration:', !!registration, registration?.active ? 'active' : 'not active');
    
    if (registration && registration.active) {
      const uniqueTag = `${data.itemId || 'reminder'}-${Date.now()}`;
      
      // Configure actions based on setting
      const actions = shouldDisplayDoneButton ? [
        { action: "done", title: "✅ Done", icon: "/favicon-32x32.png" },
        { action: "snooze", title: "⏰ Snooze", icon: "/favicon-32x32.png" },
        { action: "open", title: "📱 Open App", icon: "/favicon-32x32.png" }
      ] : [
        { action: "snooze", title: "⏰ Snooze", icon: "/favicon-32x32.png" },
        { action: "open", title: "📱 Open App", icon: "/favicon-32x32.png" }
      ];
      
      console.log('🔔 Attempting service worker notification with tag:', uniqueTag);
      console.log('🔔 Notification options:', {
        requireInteraction: shouldRequireInteraction,
        silent: !(data?.reminderSoundEnabled ?? true),
        vibrate: (data?.reminderVibrationEnabled ?? true) ? [200, 100, 200] : undefined,
        actions: actions.length,
        actionsIncludeDone: shouldDisplayDoneButton
      });
      
      return registration.showNotification(title, {
        requireInteraction: shouldRequireInteraction, // Only require interaction if Done button is enabled
        silent: !(data?.reminderSoundEnabled ?? true),
        vibrate: (data?.reminderVibrationEnabled ?? true) ? [200, 100, 200] : undefined,
        body,
        icon: "/favicon-32x32.png",
        badge: "/favicon-32x32.png",
        data: { 
          ...data, 
          shouldDisplayDoneButton, // Pass setting to service worker
          autoTimeoutMs: shouldDisplayDoneButton ? null : 8000 // Auto-dismiss after 5s if no Done button
        },
        actions: actions,
        tag: uniqueTag,
        persistent: shouldDisplayDoneButton, // Only persistent if Done button is enabled
        renotify: true,   // Force renotify
      }).then(() => {
        console.log('🔔 Service worker notification SUCCESS with tag:', uniqueTag);
        
        // If Done button is disabled, set up auto-dismiss after 5 seconds
        if (!shouldDisplayDoneButton) {
          setTimeout(async () => {
            try {
              const notifications = await registration.getNotifications({ tag: uniqueTag });
              notifications.forEach(notification => {
                console.log('🔔 Auto-dismissing notification after 8 seconds:', uniqueTag);
                notification.close();
              });
            } catch (error) {
              console.warn('🔔 Failed to auto-dismiss notification:', error);
            }
          }, 8000);
        }
      }).catch(serviceWorkerError => {
        console.error('🔔 Service worker notification ERROR:', serviceWorkerError);
        throw serviceWorkerError;
      });
    } else {
      console.log('🔔 No active service worker, trying direct notification');
      // Only use direct Notification constructor if no service worker AND not mobile
      if (!isMobile) {
        const uniqueTag = `${data.itemId || 'reminder'}-${Date.now()}`;
        const notification = new Notification(title, {
          body,
          icon: "/favicon-32x32.png",
          badge: "/favicon-32x32.png",
          data: { ...data, shouldDisplayDoneButton },
          tag: uniqueTag,
          requireInteraction: shouldRequireInteraction
        });
        
        console.log('🔔 Direct notification created for desktop');
        
        // Auto-dismiss if Done button is disabled
        if (!shouldDisplayDoneButton) {
          setTimeout(() => {
            console.log('🔔 Auto-dismissing direct notification after 5 seconds:', uniqueTag);
            notification.close();
          }, 8000);
        }
      } else {
        console.error('🔔 MOBILE ERROR: No active service worker available for notifications');
      }
    }
  }).catch(error => {
    console.error('🔔 Service worker registration error:', error);
    // Only fallback to direct constructor on desktop
    if (!isMobile) {
      try {
        const uniqueTag = `${data.itemId || 'reminder'}-${Date.now()}`;
        const notification = new Notification(title, {
          body,
          icon: "/favicon-32x32.png",
          badge: "/favicon-32x32.png",
          data: { ...data, shouldDisplayDoneButton },
          tag: uniqueTag,
          requireInteraction: shouldRequireInteraction
        });
        
        console.log('🔔 Fallback direct notification created for desktop');
        
        // Auto-dismiss if Done button is disabled
        if (!shouldDisplayDoneButton) {
          setTimeout(() => {
            console.log('🔔 Auto-dismissing fallback notification after 5 seconds:', uniqueTag);
            notification.close();
          }, 8000);
        }
      } catch (fallbackError) {
        console.error('🔔 Fallback notification also failed:', fallbackError);
      }
    } else {
      console.error('🔔 MOBILE ERROR: Service worker failed and no fallback available');
    }
  });
};