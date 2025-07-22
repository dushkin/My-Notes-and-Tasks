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
  }

  setSettingsContext(settings) {
    this.currentSettings = settings;
  }

  start() {
    if (this.intervalId) {
      this.stop();
    }

    console.log('Starting reminder monitor...');
    this.intervalId = setInterval(() => {
      this.registerSocketListeners();
      this.checkReminders();
    }, this.checkInterval);
    this.setupServiceWorkerListener();
    this.processPendingActions();
    this.checkReminders();
  }

  stop() {
    if (this.intervalId) {
      console.log('Stopping reminder monitor...');
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  checkReminders() {
    const reminders = getReminders();
    const now = Date.now();

    Object.values(reminders).forEach(reminder => {
      const reminderKey = `${reminder.itemId}-${reminder.timestamp}`;
      if (this.processedReminders.has(reminderKey)) {
        return;
      }

      if (reminder.timestamp <= now) {
        this.triggerReminder(reminder, this.currentSettings);
        this.processedReminders.add(reminderKey);

        if (reminder.repeatOptions) {
          this.scheduleNextRepeat(reminder);
        } else {
          // Use socket-broadcasting clearReminder
          clearReminder(reminder.itemId);
        }
      }
    });
  }

  // NEW: Method to force check a specific reminder (for socket-received reminders)
  forceCheckReminder(reminderData) {
    console.log('Force checking reminder:', reminderData);
    const now = Date.now();
    const reminderKey = `${reminderData.itemId}-${reminderData.timestamp}`;
    
    // Don't trigger if already processed
    if (this.processedReminders.has(reminderKey)) {
      console.log('Reminder already processed, skipping:', reminderKey);
      return;
    }

    // If the reminder time has passed or is very close (within 10 seconds), trigger immediately
    const timeDiff = reminderData.timestamp - now;
    if (timeDiff <= 10000) { // 10 seconds tolerance
      console.log('Triggering received reminder immediately:', reminderData);
      this.triggerReminder(reminderData, this.currentSettings);
      this.processedReminders.add(reminderKey);

      if (reminderData.repeatOptions) {
        this.scheduleNextRepeat(reminderData);
      } else {
        // Clear the reminder after triggering
        clearReminder(reminderData.itemId);
      }
    } else {
      console.log(`Reminder scheduled for future: ${new Date(reminderData.timestamp)}`);
    }
  }

  triggerReminder(reminder, settings) {
    console.log('Triggering reminder:', reminder);
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

    console.log('Calling showNotification with:', { title, body, notificationData });
    showNotification(title, body, notificationData);
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
      console.log('Received service worker message:', event.data);

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
        default:
          console.log('Unknown service worker message type:', type);
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', this.serviceWorkerMessageHandler);
    }
  }

  handleReminderDone(itemId, reminderId) {
    console.log('Marking reminder as done:', itemId);
    // Use socket-broadcasting clearReminder
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
    console.log('Handling reminder snooze:', itemId);
    this.handleFocusItem(itemId);
    this.showSnoozeDialog(itemId, reminderId, originalData);
  }

  handleReminderDismissed(itemId, reminderId) {
    console.log('Reminder dismissed:', itemId);
    // Use socket-broadcasting clearReminder
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
    console.log('Focusing on item:', itemId);
    window.focus(); // Bring the application window to the foreground
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
    console.log(`Snoozing reminder for ${duration} ${unit}:`, itemId);
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

    // Use socket-broadcasting updateReminder
    updateReminder(itemId, newReminderTime, repeatOptions);

    // Clear the 'processed' flag so the monitor can trigger it again after the snooze period.
    this.clearProcessedReminder(itemId);

    this.showFeedback(`⏰ Reminder snoozed for ${duration} ${unit}`, 'info');
    console.log(`Reminder snoozed until ${new Date(newReminderTime)}`);
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
            console.log('Processing pending action:', action);
            switch (action.type) {
              case 'done':
                this.handleReminderDone(action.itemId, action.reminderId);
                break;
              case 'snooze':
                if (action.data && action.data.snoozeUntil) {
                  // Use socket-broadcasting updateReminder
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
    if (!socket || this._socketInitialized) return;
    this._socketInitialized = true;

    socket.on("reminder:trigger", (reminder) => {
      console.log("🔔 Received socket trigger:", reminder);
      this.triggerReminder(reminder, this.currentSettings || {});
    });

    // NEW: Listen for socket reminder events and force check them
    socket.on("reminder:set", (reminderData) => {
      console.log("🔔 Received socket reminder:set:", reminderData);
      // Force check this reminder immediately
      setTimeout(() => {
        this.forceCheckReminder(reminderData);
      }, 100); // Small delay to ensure localStorage is updated
    });

    socket.on("reminder:update", (reminderData) => {
      console.log("🔔 Received socket reminder:update:", reminderData);
      // Clear any processed state for this item and force check
      this.clearProcessedReminder(reminderData.itemId);
      setTimeout(() => {
        this.forceCheckReminder(reminderData);
      }, 100);
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
    
    // Use socket-broadcasting updateReminder
    updateReminder(reminder.itemId, nextTime, reminder.repeatOptions);
    this.clearProcessedReminder(reminder.itemId);
    console.log(`Scheduled next repeat for ${reminder.itemId} at ${new Date(nextTime)}`);
  }
}

const reminderMonitor = new ReminderMonitor();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    const { type, itemId } = event.data || {};
    if (type === 'SNOOZE_REMINDER') {
      console.log('Received snooze for item:', itemId);
      const newTime = Date.now() + 5 * 60 * 1000;
      updateReminder(itemId, newTime); // This will broadcast to other devices
    } else if (type === 'MARK_DONE') {
      console.log('Received done for item:', itemId);
      window.dispatchEvent(new CustomEvent('markTaskDoneExternally', { detail: { itemId } }));
    }
  });
}

export default reminderMonitor;