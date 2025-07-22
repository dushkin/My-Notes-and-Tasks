import { showNotification, getReminders, clearReminder, updateReminder } from '../../utils/reminderUtils';
import { getSocket } from '../../services/socketClient';

class ReminderMonitor {
  constructor() {
    this.intervalId = null;
    this.checkInterval = 500;
    this.serviceWorkerMessageHandler = null;
    this.snoozeDialogCallback = null;
    this.lastFeedback = null;
    this.processedReminders = new Set();
    this.socketListenersInitialized = false;
  }

  setSettingsContext(settings) {
    this.currentSettings = settings;
  }

  start() {
    if (this.intervalId) {
      this.stop();
    }

    this.intervalId = setInterval(() => {
      this.checkReminders();
    }, this.checkInterval);
    
    // Initialize socket listeners only once
    if (!this.socketListenersInitialized) {
      this.registerSocketListeners();
      this.socketListenersInitialized = true;
    }
    
    this.setupServiceWorkerListener();
    this.processPendingActions();
    this.checkReminders();
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  checkReminders() {
    const reminders = getReminders();
    const now = Date.now();
    
    // DEBUG: Temporary check if this runs on mobile
    if (Object.keys(reminders).length > 0) {
      console.log('📱 Mobile reminder check:', Object.keys(reminders).length, 'reminders');
    }

    Object.values(reminders).forEach(reminder => {
      const reminderKey = `${reminder.itemId}-${reminder.timestamp}`;
      if (this.processedReminders.has(reminderKey)) {
        return;
      }

      // DEBUG: Show the actual timestamp comparison
      const timeDiff = reminder.timestamp - now;
      if (Object.keys(reminders).length > 0) {
        console.log('⏱️ Time check:', {
          reminderTime: new Date(reminder.timestamp).toISOString(),
          currentTime: new Date(now).toISOString(),
          diff: timeDiff,
          willTrigger: reminder.timestamp <= now
        });
      }

      // Only trigger if the time has actually passed
      if (reminder.timestamp <= now) {
        console.log('🔔 MOBILE TRIGGERING REMINDER');
        this.triggerReminder(reminder, this.currentSettings);
        this.processedReminders.add(reminderKey);

        if (reminder.repeatOptions) {
          this.scheduleNextRepeat(reminder);
        } else {
          // INCREASED delay to allow other devices more time to trigger
          setTimeout(() => {
            clearReminder(reminder.itemId);
          }, 5000); // 5 second delay instead of 2
        }
      }
    });
  }

  // REMOVED: forceCheckReminder method - this was causing immediate triggers
  // Instead, socket events should only update localStorage, not trigger immediately

  triggerReminder(reminder, settings) {
    const itemTitle = this.findItemTitle(reminder.itemId);
    const title = '⏰ Reminder';
    const body = `Don't forget: ${itemTitle || 'Untitled'}`;
    const notificationData = {
      reminderVibrationEnabled: settings.reminderVibrationEnabled,
      reminderSoundEnabled: settings.reminderSoundEnabled,
      itemId: reminder.itemId,
      reminderId: `${reminder.itemId}-${reminder.timestamp}`,
      itemTitle: itemTitle || 'Untitled',
      originalReminder: reminder
    };

    // Mobile fix: Try to focus window for backgrounded mobile pages
    const isMobile = /Mobile|Android|iPhone|iPad/.test(navigator.userAgent);
    const isPageHidden = document.hidden;
    
    if (isMobile && isPageHidden) {
      // Try to focus the window
      if (window.focus) window.focus();
      
      // Flash the title to get attention
      const originalTitle = document.title;
      document.title = `🔔 ${title}`;
      setTimeout(() => {
        document.title = originalTitle;
      }, 3000);
    }

    // DEBUG: Check if showNotification exists
    console.log('🚨 About to call showNotification:', {
      title,
      body,
      showNotificationExists: typeof showNotification,
      settings
    });

    // Single notification call - let showNotification handle all the logic
    try {
      showNotification(title, body, notificationData);
      console.log('🚨 showNotification called successfully');
    } catch (error) {
      console.error('🚨 showNotification ERROR:', error);
    }
    
    window.dispatchEvent(new CustomEvent('reminderTriggered', {
      detail: { ...reminder, itemTitle, notificationData }
    }));
  }

  setupServiceWorkerListener() {
    if (this.serviceWorkerMessageHandler) {
      navigator.serviceWorker.removeEventListener('message', this.serviceWorkerMessageHandler);
    }

    this.serviceWorkerMessageHandler = (event) => {
      const {
        type,
        itemId,
        reminderId,
        originalData
      } = event.data;

      switch (type) {
        case 'REMINDER_DONE':
          this.handleReminderDone(itemId, reminderId);
          break;
        case 'REMINDER_SNOOZE':
          this.handleReminderSnooze(itemId, reminderId, originalData);
          break;
        case 'REMINDER_DISMISSED':
          this.handleReminderDismissed(itemId, reminderId);
          break;
        case 'FOCUS_ITEM':
          this.handleFocusItem(itemId);
          break;
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', this.serviceWorkerMessageHandler);
    }
  }

  handleReminderDone(itemId, reminderId) {
    clearReminder(itemId);
    this.clearProcessedReminder(itemId);
    window.dispatchEvent(new CustomEvent('reminderMarkedDone', {
      detail: {
        itemId,
        reminderId
      }
    }));
  }

  handleReminderSnooze(itemId, reminderId, originalData) {
    this.handleFocusItem(itemId);
    this.showSnoozeDialog(itemId, reminderId, originalData);
  }

  handleReminderDismissed(itemId, reminderId) {
    clearReminder(itemId);
    this.clearProcessedReminder(itemId);
    window.dispatchEvent(new CustomEvent('reminderDismissed', {
      detail: {
        itemId,
        reminderId
      }
    }));
  }

  handleFocusItem(itemId) {
    window.focus();
    window.dispatchEvent(new CustomEvent('focusItem', {
      detail: {
        itemId
      }
    }));
  }

  showSnoozeDialog(itemId, reminderId, originalData) {
    window.dispatchEvent(new CustomEvent('showSnoozeDialog', {
      detail: {
        itemId,
        reminderId,
        originalData,
        onSnooze: (duration, unit) => {
          this.applySnooze(itemId, duration, unit, originalData);
        }
      }
    }));
  }

  applySnooze(itemId, duration, unit, originalData) {
    let milliseconds = 0;
    const value = parseInt(duration, 10);
    switch (unit) {
      case 'seconds':
        milliseconds = value * 1000;
        break;
      case 'minutes':
        milliseconds = value * 60 * 1000;
        break;
      case 'hours':
        milliseconds = value * 60 * 60 * 1000;
        break;
      case 'days':
        milliseconds = value * 24 * 60 * 60 * 1000;
        break;
      default:
        console.error('Invalid snooze unit:', unit);
        return;
    }

    const newReminderTime = Date.now() + milliseconds;
    const repeatOptions = originalData?.originalReminder?.repeatOptions || null;

    updateReminder(itemId, newReminderTime, repeatOptions);
    this.clearProcessedReminder(itemId);

    this.showFeedback(`⏰ Reminder snoozed for ${duration} ${unit}`, 'info');
  }

  showFeedback(message, type = 'info') {
    window.dispatchEvent(new CustomEvent('showFeedback', {
      detail: {
        message,
        type
      }
    }));
  }

  async processPendingActions() {
    try {
      const db = await this.initializeDatabase();
      if (!db) {
        console.warn('Failed to initialize IndexedDB for pending actions');
        return;
      }
      if (!db.objectStoreNames.contains('actions')) {
        console.warn('Actions object store does not exist, skipping pending actions processing');
        return;
      }

      const transaction = db.transaction(['actions'], 'readwrite');
      const store = transaction.objectStore('actions');
      const getAllRequest = store.getAll();

      getAllRequest.onsuccess = () => {
        const actions = getAllRequest.result;
        if (actions && actions.length > 0) {
          actions.forEach(action => {
            switch (action.type) {
              case 'done':
                this.handleReminderDone(action.itemId, action.reminderId);
                break;
              case 'snooze':
                if (action.data && action.data.snoozeUntil) {
                  updateReminder(action.itemId, action.data.snoozeUntil);
                  this.clearProcessedReminder(action.itemId);
                }
                break;
            }
            try {
              store.delete(action.id);
            } catch (deleteError) {
              console.warn('Failed to delete processed action:', deleteError);
            }
          });
        }
      };
      getAllRequest.onerror = () => {
        console.error('Error retrieving pending actions:', getAllRequest.error);
      };
      transaction.onerror = () => {
        console.error('Transaction error in processPendingActions:', transaction.error);
      };
    } catch (error) {
      console.error('Error processing pending actions:', error);
    }
  }

  async initializeDatabase() {
    return new Promise((resolve) => {
      try {
        const request = indexedDB.open('NotificationActions', 1);

        request.onerror = (event) => {
          console.error('Error opening IndexedDB:', event.target.error);
          resolve(null);
        };

        request.onsuccess = (event) => {
          const db = event.target.result;
          db.onerror = (dbEvent) => {
            console.error('IndexedDB connection error:', dbEvent.target.error);
          };
          resolve(db);
        };

        request.onupgradeneeded = (event) => {
          try {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('actions')) {
              const store = db.createObjectStore('actions', { keyPath: 'id', autoIncrement: true });
              store.createIndex('type', 'type', { unique: false });
              store.createIndex('itemId', 'itemId', { unique: false });
              store.createIndex('timestamp', 'timestamp', { unique: false });
            }
          } catch (upgradeError) {
            console.error('Error during IndexedDB upgrade:', upgradeError);
            resolve(null);
          }
        };

        request.onblocked = () => {
          console.warn('IndexedDB upgrade blocked by another connection.');
          resolve(null);
        };

      } catch (error) {
        console.error('Error initializing IndexedDB:', error);
        resolve(null);
      }
    });
  }

  async storePendingAction(actionType, itemId, reminderId, data = {}) {
    try {
      const db = await this.initializeDatabase();
      if (!db || !db.objectStoreNames.contains('actions')) {
        console.warn('Failed to get DB or "actions" store does not exist.');
        return;
      }
      const transaction = db.transaction(['actions'], 'readwrite');
      const store = transaction.objectStore('actions');
      const action = {
        type: actionType,
        itemId: itemId,
        reminderId: reminderId,
        data: data,
        timestamp: Date.now()
      };
      const request = store.add(action);
      request.onerror = () => {
        console.error('Error storing pending action:', request.error);
      };
      transaction.onerror = () => {
        console.error('Transaction error in storePendingAction:', transaction.error);
      };
    } catch (error) {
      console.error('Error storing pending action:', error);
    }
  }

  clearProcessedReminder(itemId) {
    this.processedReminders = new Set(
      [...this.processedReminders].filter(key => !key.startsWith(`${itemId}-`))
    );
  }

  setSnoozeDialogCallback(callback) {
    this.snoozeDialogCallback = callback;
  }

  findItemTitle(itemId) {
    try {
      const treeData = this.getTreeData();
      if (treeData) {
        return this.searchTreeForTitle(treeData, itemId);
      }
    } catch (error) {
      console.warn('Could not find item title:', error);
    }
    return null;
  }

  getTreeData() {
    try {
      if (window.treeData) {
        return window.treeData;
      }
      const cachedTree = localStorage.getItem('cached_tree_data');
      if (cachedTree) {
        return JSON.parse(cachedTree);
      }
      return null;
    } catch (error) {
      console.warn('Error getting tree data:', error);
      return null;
    }
  }

  searchTreeForTitle(tree, itemId) {
    if (!Array.isArray(tree)) return null;
    for (const item of tree) {
      if (item.id === itemId) {
        return item.label || 'Untitled';
      }
      if (item.children && Array.isArray(item.children)) {
        const found = this.searchTreeForTitle(item.children, itemId);
        if (found) return found;
      }
    }
    return null;
  }

  registerSocketListeners() {
    const socket = getSocket();
    if (!socket) return;

    // Only sync data, don't trigger reminders immediately
    socket.on("reminder:set", (reminderData) => {
      // Just update localStorage, let the normal check cycle handle triggering
      const reminders = getReminders();
      reminders[reminderData.itemId] = reminderData;
      localStorage.setItem("notes_app_reminders", JSON.stringify(reminders));
      
      // Notify UI of the sync
      window.dispatchEvent(
        new CustomEvent("remindersUpdated", { detail: reminders })
      );
    });

    socket.on("reminder:update", (reminderData) => {
      // Clear any processed state for this item and sync
      this.clearProcessedReminder(reminderData.itemId);
      
      // Just update localStorage
      const reminders = getReminders();
      reminders[reminderData.itemId] = reminderData;
      localStorage.setItem("notes_app_reminders", JSON.stringify(reminders));
      
      // Notify UI of the sync
      window.dispatchEvent(
        new CustomEvent("remindersUpdated", { detail: reminders })
      );
    });

    socket.on("reminder:clear", ({ itemId }) => {
      // Just update localStorage
      const reminders = getReminders();
      delete reminders[itemId];
      localStorage.setItem("notes_app_reminders", JSON.stringify(reminders));
      
      // Clear processed state
      this.clearProcessedReminder(itemId);
      
      // Notify UI of the sync
      window.dispatchEvent(
        new CustomEvent("remindersUpdated", { detail: reminders })
      );
    });

    // Direct trigger from server (for server-scheduled reminders)
    socket.on("reminder:trigger", (reminder) => {
      this.triggerReminder(reminder, this.currentSettings || {});
    });
  }

  scheduleNextRepeat(reminder) {
    if (!reminder.repeatOptions) return;
    const { interval, unit } = reminder.repeatOptions;
    let nextTime = reminder.timestamp;
    switch (unit) {
      case 'seconds':
        nextTime += interval * 1000;
        break;
      case 'minutes':
        nextTime += interval * 60 * 1000;
        break;
      case 'hours':
        nextTime += interval * 60 * 60 * 1000;
        break;
      case 'days':
        nextTime += interval * 24 * 60 * 60 * 1000;
        break;
      default:
        return;
    }
    
    updateReminder(reminder.itemId, nextTime, reminder.repeatOptions);
    this.clearProcessedReminder(reminder.itemId);
  }
}

const reminderMonitor = new ReminderMonitor();

// Clean up service worker listeners
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const { type, itemId } = event.data || {};
    if (type === 'SNOOZE_REMINDER') {
      console.log('Received snooze for item:', itemId);
      const newTime = Date.now() + 5 * 60 * 1000;
      updateReminder(itemId, newTime);
    } else if (type === 'MARK_DONE') {
      console.log('Received done for item:', itemId);
      window.dispatchEvent(new CustomEvent('markTaskDoneExternally', { detail: { itemId } }));
    }
  });
}

export default reminderMonitor;