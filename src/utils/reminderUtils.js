const REMINDERS_STORAGE_KEY = 'notes_app_reminders';

/**
 * Stores a reminder in local storage.
 * @param {string} itemId - The ID of the item the reminder is for.
 * @param {number} timestamp - The Unix timestamp (in milliseconds) when the reminder should trigger.
 * @param {Object|null} repeatOptions - The repeat options for the reminder.
 */
export const setReminder = (itemId, timestamp, repeatOptions = null) => {
    const reminders = getReminders();
    reminders[itemId] = { timestamp, itemId, repeatOptions };
    localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(reminders));
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
 * Clears a specific reminder from local storage.
 * @param {string} itemId - The ID of the item whose reminder should be cleared.
 */
export const clearReminder = (itemId) => {
    const reminders = getReminders();
    delete reminders[itemId];
    localStorage.setItem(REMINDERS_STORAGE_KEY, JSON.stringify(reminders));
    console.log(`Reminder cleared for item ${itemId}`);
};

/**
 * Clears all reminders from local storage.
 */
export const clearAllReminders = () => {
    localStorage.removeItem(REMINDERS_STORAGE_KEY);
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

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
        return `in ${days}d`;
    } else if (hours > 0) {
        return `in ${hours}h`;
    } else if (minutes > 0) {
        return `in ${minutes}m`;
    } else {
        return `in ${seconds}s`;
    }
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
 */
export const schedulePushNotification = (title, body, timestamp) => {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) {
        console.warn("Push notifications not supported.");
        return;
    }
    if (Notification.permission !== "granted") {
        console.warn("Notification permission not granted.");
        return;
    }
    const delay = timestamp - Date.now();
    if (delay <= 0) {
        showNotification(title, body);
        return;
    }
    setTimeout(() => {
        showNotification(title, body);
    }, delay);
};

/**
 * Show a notification immediately.
 * @param {string} title - Notification title.
 * @param {string} body - Notification body.
 */
export const showNotification = (title, body) => {
    if (Notification.permission !== "granted") {
        console.warn("Notification permission not granted.");
        return;
    }
    navigator.serviceWorker.getRegistration().then((registration) => {
        if (registration) {
            registration.showNotification(title, {
                body,
                icon: "/favicon-32x32.png",
                badge: "/favicon-32x32.png",
            });
        } else {
            new Notification(title, {
                body,
                icon: "/favicon-32x32.png",
                badge: "/favicon-32x32.png",
            });
        }
    });
};
