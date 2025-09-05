import { authFetch } from './apiClient.js';
import { getSocket } from './socketClient';

/**
 * Server-side reminder service that replaces localStorage-based reminders
 * with persistent, cross-device synchronized reminders
 */
class ServerReminderService {
  constructor() {
    this.cache = new Map(); // In-memory cache for quick access
    this.isInitialized = false;
    this.listeners = new Set();
    this.setupSocketListeners();
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      await this.loadReminders();
      this.isInitialized = true;
      console.log('📡 Server reminder service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize server reminder service:', error);
      throw error;
    }
  }

  /**
   * Load all reminders from server and populate cache
   */
  async loadReminders() {
    try {
      const response = await authFetch('/reminders');
      const { reminders } = response;
      
      // Clear cache and repopulate
      this.cache.clear();
      reminders.forEach(reminder => {
        this.cache.set(reminder.itemId, reminder);
      });

      // Notify listeners
      this.notifyListeners('reminders:loaded', reminders);
      return reminders;
    } catch (error) {
      console.error('❌ Failed to load reminders from server:', error);
      throw error;
    }
  }

  /**
   * Get all reminders (from cache if available, otherwise from server)
   */
  async getReminders() {
    if (!this.isInitialized) {
      await this.initialize();
    }
    return Array.from(this.cache.values());
  }

  /**
   * Get a specific reminder by item ID
   */
  async getReminder(itemId) {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    // Try cache first
    if (this.cache.has(itemId)) {
      return this.cache.get(itemId);
    }

    // Fallback to server
    try {
      const response = await authFetch(`/reminders/${itemId}`);
      const reminder = response.reminder;
      this.cache.set(itemId, reminder);
      return reminder;
    } catch (error) {
      if (error.response?.status === 404) {
        return null; // Reminder doesn't exist
      }
      throw error;
    }
  }

  /**
   * Set or update a reminder
   */
  async setReminder(itemId, timestamp, repeatOptions = null, itemTitle = null) {
    try {
      const response = await authFetch(`/reminders/${itemId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          timestamp: new Date(timestamp).toISOString(),
          itemTitle,
          ...(repeatOptions && { repeatOptions }),
          deviceId: this.getDeviceId()
        })
      });

      const reminder = response.reminder;
      this.cache.set(itemId, reminder);

      // Notify listeners
      this.notifyListeners('reminder:set', reminder);
      
      // Schedule local notification if needed
      await this.scheduleLocalNotification(reminder);

      console.log(`📡 Reminder set on server for item ${itemId} at ${new Date(timestamp)}`);
      return reminder;
    } catch (error) {
      console.error('❌ Failed to set reminder on server:', error);
      throw error;
    }
  }

  /**
   * Clear a reminder
   */
  async clearReminder(itemId) {
    try {
      await authFetch(`/reminders/${itemId}`, {
        method: 'DELETE'
      });
      this.cache.delete(itemId);

      // Cancel local notification if any
      await this.cancelLocalNotification(itemId);

      // Notify listeners
      this.notifyListeners('reminder:cleared', { itemId });

      console.log(`📡 Reminder cleared on server for item ${itemId}`);
      return true;
    } catch (error) {
      if (error.response?.status === 404) {
        // Reminder already doesn't exist, consider it cleared
        this.cache.delete(itemId);
        return true;
      }
      console.error('❌ Failed to clear reminder on server:', error);
      throw error;
    }
  }

  /**
   * Snooze a reminder
   */
  async snoozeReminder(itemId, minutes) {
    try {
      const response = await authFetch(`/reminders/${itemId}/snooze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          minutes
        })
      });

      const reminder = response.reminder;
      this.cache.set(itemId, reminder);

      // Reschedule local notification
      await this.scheduleLocalNotification(reminder);

      // Notify listeners
      this.notifyListeners('reminder:snoozed', reminder);

      console.log(`📡 Reminder snoozed on server for item ${itemId} for ${minutes} minutes`);
      return reminder;
    } catch (error) {
      console.error('❌ Failed to snooze reminder on server:', error);
      throw error;
    }
  }

  /**
   * Mark a reminder as triggered (used by notification system)
   */
  async triggerReminder(itemId) {
    try {
      const response = await authFetch(`/reminders/${itemId}/trigger`, {
        method: 'POST'
      });
      const reminder = response.reminder;

      if (reminder.enabled) {
        // Update cache with new occurrence time
        this.cache.set(itemId, reminder);
        await this.scheduleLocalNotification(reminder);
      } else {
        // Remove from cache if disabled
        this.cache.delete(itemId);
        await this.cancelLocalNotification(itemId);
      }

      // Notify listeners
      this.notifyListeners('reminder:triggered', reminder);

      console.log(`📡 Reminder triggered on server for item ${itemId}`);
      return reminder;
    } catch (error) {
      console.error('❌ Failed to trigger reminder on server:', error);
      throw error;
    }
  }

  /**
   * Get due reminders from server
   */
  async getDueReminders() {
    try {
      const response = await authFetch('/reminders/due');
      return response.reminders;
    } catch (error) {
      console.error('❌ Failed to get due reminders from server:', error);
      throw error;
    }
  }

  /**
   * Bulk import reminders from localStorage (for migration)
   */
  async migrateFromLocalStorage() {
    const REMINDERS_STORAGE_KEY = 'notes_app_reminders';
    
    try {
      const localReminders = localStorage.getItem(REMINDERS_STORAGE_KEY);
      if (!localReminders) {
        console.log('📡 No localStorage reminders to migrate');
        return { created: 0, updated: 0, skipped: 0, errors: [] };
      }

      const remindersObj = JSON.parse(localReminders);
      const remindersArray = Object.entries(remindersObj).map(([itemId, data]) => ({
        itemId,
        timestamp: new Date(data.timestamp).toISOString(),
        itemTitle: data.itemTitle || 'Reminder',
        ...(data.repeatOptions && { repeatOptions: data.repeatOptions })
      }));

      if (remindersArray.length === 0) {
        console.log('📡 No valid localStorage reminders to migrate');
        return { created: 0, updated: 0, skipped: 0, errors: [] };
      }

      console.log(`📡 Migrating ${remindersArray.length} reminders from localStorage to server...`);

      const response = await authFetch('/reminders/bulk-import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reminders: remindersArray
        })
      });

      const results = response.results;

      // Clear localStorage after successful migration
      if (results.errors.length === 0 || results.created + results.updated > 0) {
        localStorage.removeItem(REMINDERS_STORAGE_KEY);
        console.log('📡 localStorage reminders cleared after migration');
      }

      // Reload reminders from server
      await this.loadReminders();

      console.log('📡 Reminder migration completed:', results);
      return results;
    } catch (error) {
      console.error('❌ Failed to migrate reminders from localStorage:', error);
      throw error;
    }
  }

  /**
   * Schedule local notification for a reminder
   */
  async scheduleLocalNotification(reminder) {
    try {
      // Use existing notification service
      const { notificationService } = await import('./notificationService.js');
      await notificationService.scheduleReminder(reminder);
    } catch (error) {
      console.warn('⚠️ Failed to schedule local notification:', error);
    }
  }

  /**
   * Cancel local notification for a reminder
   */
  async cancelLocalNotification(itemId) {
    try {
      const { notificationService } = await import('./notificationService.js');
      await notificationService.cancelReminder(itemId);
    } catch (error) {
      console.warn('⚠️ Failed to cancel local notification:', error);
    }
  }

  /**
   * Setup Socket.IO listeners for real-time sync
   */
  setupSocketListeners() {
    const socket = getSocket();
    if (!socket) return;

    socket.on('reminder:set', (data) => {
      console.log("📡 ServerReminderService: reminder:set received", data);
      const reminder = {
        itemId: data.itemId,
        itemTitle: data.itemTitle,
        timestamp: data.timestamp,
        repeatOptions: data.repeatOptions,
        enabled: true
      };
      
      this.cache.set(data.itemId, reminder);
      this.scheduleLocalNotification(reminder);
      this.notifyListeners('reminder:set', reminder);
      console.log('📡 Reminder synced from another device:', data.itemId);
    });

    socket.on('reminder:clear', (data) => {
      this.cache.delete(data.itemId);
      this.cancelLocalNotification(data.itemId);
      this.notifyListeners('reminder:cleared', data);
      console.log('📡 Reminder cleared from another device:', data.itemId);
    });

    socket.on('reminder:update', (data) => {
      if (this.cache.has(data.itemId)) {
        const existing = this.cache.get(data.itemId);
        const updated = { ...existing, ...data };
        this.cache.set(data.itemId, updated);
        this.scheduleLocalNotification(updated);
        this.notifyListeners('reminder:updated', updated);
        console.log('📡 Reminder updated from another device:', data.itemId);
      }
    });

    socket.on('reminder:triggered', (data) => {
      if (data.enabled && this.cache.has(data.itemId)) {
        const existing = this.cache.get(data.itemId);
        const updated = { ...existing, ...data };
        this.cache.set(data.itemId, updated);
        this.scheduleLocalNotification(updated);
      } else {
        this.cache.delete(data.itemId);
        this.cancelLocalNotification(data.itemId);
      }
      this.notifyListeners('reminder:triggered', data);
      console.log('📡 Reminder triggered from another device:', data.itemId);
    });

    socket.on('reminders:bulk_updated', async () => {
      console.log('📡 Bulk reminder update from another device, reloading...');
      await this.loadReminders();
    });
  }

  /**
   * Add event listener
   */
  addEventListener(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notify all listeners
   */
  notifyListeners(event, data) {
    this.listeners.forEach(callback => {
      try {
        callback(event, data);
      } catch (error) {
        console.error('❌ Error in reminder listener:', error);
      }
    });

    // Also fire window events for backward compatibility
    window.dispatchEvent(new CustomEvent('remindersUpdated', {
      detail: Array.from(this.cache.values())
    }));

    if (event === 'reminder:set') {
      window.dispatchEvent(new CustomEvent('reminderSet', { detail: data }));
    } else if (event === 'reminder:cleared') {
      window.dispatchEvent(new CustomEvent('reminderCleared', { detail: data }));
    }
  }

  /**
   * Get device ID for tracking which device set the reminder
   */
  getDeviceId() {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = 'device_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  }

  /**
   * Format remaining time for a reminder (compatible with existing UI)
   */
  formatRemainingTime(timestamp) {
    const now = Date.now();
    const diff = new Date(timestamp).getTime() - now;

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
  }
}

// Create singleton instance
export const serverReminderService = new ServerReminderService();
export default serverReminderService;