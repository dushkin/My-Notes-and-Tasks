import { showNotification, getReminders, clearReminder, setReminder } from '../../utils/reminderUtils';

class ReminderMonitor {
  constructor() {
    this.intervalId = null;
    this.checkInterval = 500; // Check every 500ms for better accuracy [cite: 1808]
    this.serviceWorkerMessageHandler = null;
    this.snoozeDialogCallback = null;
    this.lastFeedback = null; // Track feedback [cite: 1809]
    this.processedReminders = new Set(); // Track processed reminders to prevent re-triggering
  }

  start() {
    if (this.intervalId) {
      this.stop();
    }

    console.log('Starting reminder monitor...');
    this.intervalId = setInterval(() => {
      this.checkReminders();
    }, this.checkInterval);
    // Set up service worker message listener [cite: 1811]
    this.setupServiceWorkerListener();
    // Process any pending actions from when app was closed [cite: 1812]
    this.processPendingActions();
    // Check immediately on start [cite: 1813]
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
      // Skip if already processed in this session
      const reminderKey = `${reminder.itemId}-${reminder.timestamp}`;
      if (this.processedReminders.has(reminderKey)) {
        return;
      }

      // Trigger when the reminder time is now or in the past
      if (reminder.timestamp <= now) {
        this.triggerReminder(reminder);
        this.processedReminders.add(reminderKey); // Mark as processed

        // Handle repeating reminders
        if (reminder.repeatOptions) {
          this.scheduleNextRepeat(reminder);
        } else {
          // Clear non-repeating reminders after triggering
          clearReminder(reminder.itemId);
        }
      }
    });
  }

  // In reminderMonitor.js, update triggerReminder
  triggerReminder(reminder) {
    console.log('Triggering reminder:', reminder);
    const itemTitle = this.findItemTitle(reminder.itemId);
    const title = '⏰ Reminder';
    const body = `Don't forget: ${itemTitle || 'Untitled'}`;
    const notificationData = {
      itemId: reminder.itemId,
      reminderId: `${reminder.itemId}-${reminder.timestamp}`, // Unique reminderId
      itemTitle: itemTitle || 'Untitled',
      originalReminder: reminder
    };

    console.log('Calling showNotification with:', { title, body, notificationData });
    showNotification(title, body, notificationData);
    window.dispatchEvent(new CustomEvent('reminderTriggered', {
      detail: { ...reminder, itemTitle, notificationData }
    }));
  }

  // Set up service worker message listener [cite: 1823]
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

  // Handle "Done" action from notification [cite: 1832]
  handleReminderDone(itemId, reminderId) {
    console.log('Marking reminder as done:', itemId);
    // Clear the reminder [cite: 1832]
    clearReminder(itemId);
    // Clear from processed reminders
    this.clearProcessedReminder(itemId);
    // Dispatch event for UI to handle (e.g., mark task as complete) [cite: 1833]
    window.dispatchEvent(new CustomEvent('reminderMarkedDone', {
      detail: {
        itemId,
        reminderId
      }
    }));
  }

  // Handle "Snooze" action from notification [cite: 1834]
  handleReminderSnooze(itemId, reminderId, originalData) {
    console.log('Handling reminder snooze:', itemId);
    // Clear from processed reminders
    this.clearProcessedReminder(itemId);
    // Show snooze dialog [cite: 1835]
    this.showSnoozeDialog(itemId, reminderId, originalData);
  }

  // Handle notification dismissed [cite: 1837]
  handleReminderDismissed(itemId, reminderId) {
    console.log('Reminder dismissed:', itemId);
    // Clear the reminder
    clearReminder(itemId);
    // Clear from processed reminders
    this.clearProcessedReminder(itemId);
    // Dispatch event for UI
    window.dispatchEvent(new CustomEvent('reminderDismissed', {
      detail: {
        itemId,
        reminderId
      }
    }));
  }

  // Handle focus item request [cite: 1839]
  handleFocusItem(itemId) {
    console.log('Focusing on item:', itemId);
    // Dispatch event for UI to focus on the specific item [cite: 1839]
    window.dispatchEvent(new CustomEvent('focusItem', {
      detail: {
        itemId
      }
    }));
  }

  // Show snooze dialog [cite: 1841]
  showSnoozeDialog(itemId, reminderId, originalData) {
    // Dispatch event to show snooze dialog in the UI [cite: 1841]
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

  // Apply snooze with specified duration [cite: 1842]
  applySnooze(itemId, duration, unit, originalData) {
    console.log(`Snoozing reminder for ${duration} ${unit}:`, itemId);
    // Calculate new reminder time [cite: 1842]
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
    // Update the reminder with new time [cite: 1849]
    const reminders = getReminders();
    if (reminders[itemId]) {
      reminders[itemId].timestamp = newReminderTime;
      localStorage.setItem('notes_app_reminders', JSON.stringify(reminders));
      // Clear from processed reminders
      this.clearProcessedReminder(itemId);
      // Show feedback [cite: 1851]
      this.showFeedback(`⏰ Reminder snoozed for ${duration} ${unit}`, 'info');
      console.log(`Reminder snoozed until ${new Date(newReminderTime)}`);
    }
  }

  // Show feedback message [cite: 1853]
  showFeedback(message, type = 'info') {
    // Dispatch event for UI to show feedback [cite: 1853]
    window.dispatchEvent(new CustomEvent('showFeedback', {
      detail: {
        message,
        type
      }
    }));
  }

  // Process pending actions from IndexedDB (when app was closed) [cite: 1854]
  async processPendingActions() {
    try {
      const db = await this.initializeDatabase();
      if (!db) {
        console.warn('Failed to initialize IndexedDB for pending actions');
        return;
      }

      // Check if the actions object store exists [cite: 1856]
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
                  // Apply the stored snooze [cite: 1859]
                  const reminders = getReminders();
                  if (reminders[action.itemId]) {
                    reminders[action.itemId].timestamp = action.data.snoozeUntil;
                    localStorage.setItem('notes_app_reminders', JSON.stringify(reminders));
                    // Clear from processed reminders
                    this.clearProcessedReminder(action.itemId);
                  }
                }
                break;
            }

            // Remove processed action [cite: 1861]
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

  // Initialize IndexedDB database with proper schema [cite: 1867]
  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      try {
        const request = indexedDB.open('NotificationActions', 1);

        request.onerror = () => {
          console.error('Error opening IndexedDB:', request.error);
          resolve(null); // Resolve with null instead of rejecting to prevent app crash [cite: 1867]
        };

        request.onsuccess = (event) => {
          const db = event.target.result;
          console.log('IndexedDB opened successfully');

          // Add error handler for the database connection [cite: 1868]
          db.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
          };

          resolve(db);
        };

        request.onupgradeneeded = (event) => {
          const db = event.target.result;
          console.log('IndexedDB upgrade needed, creating object stores');

          try {
            // Create the actions object store if it doesn't exist [cite: 1869]
            if (!db.objectStoreNames.contains('actions')) {
              const actionsStore = db.createObjectStore('actions', {
                keyPath: 'id',
                autoIncrement: true
              });
              // Create indexes for better querying [cite: 1870]
              actionsStore.createIndex('type', 'type', {
                unique: false
              });
              actionsStore.createIndex('itemId', 'itemId', {
                unique: false
              });
              actionsStore.createIndex('timestamp', 'timestamp', {
                unique: false
              });
              console.log('Created actions object store with indexes');
            }
          } catch (upgradeError) {
            console.error('Error during IndexedDB upgrade:', upgradeError);
            resolve(null);
          }
        };
        request.onblocked = () => {
          console.warn('IndexedDB upgrade blocked by another connection');
          resolve(null);
        };
      } catch (error) {
        console.error('Error initializing IndexedDB:', error);
        resolve(null);
      }
    });
  }

  // Store a pending action in IndexedDB [cite: 1878]
  async storePendingAction(actionType, itemId, reminderId, data = {}) {
    try {
      const db = await this.initializeDatabase();
      if (!db) {
        console.warn('Failed to initialize IndexedDB for storing action');
        return;
      }
      if (!db.objectStoreNames.contains('actions')) {
        console.warn('Actions object store does not exist, cannot store pending action');
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
      request.onsuccess = () => {
        console.log('Pending action stored successfully:', action);
      };
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

  // Clear processed reminder by itemId
  clearProcessedReminder(itemId) {
    // Remove all entries for this itemId from processedReminders
    this.processedReminders = new Set(
      [...this.processedReminders].filter(key => !key.startsWith(`${itemId}-`))
    );
  }

  // Set snooze dialog callback for external components [cite: 1887]
  setSnoozeDialogCallback(callback) {
    this.snoozeDialogCallback = callback;
  }

  findItemTitle(itemId) {
    // Try to get the tree data from localStorage or other sources [cite: 1888]
    try {
      // Check if we have access to the tree data [cite: 1888]
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
    // Try to get tree data from various sources [cite: 1891]
    try {
      // First, try to get from window/global state if available [cite: 1891]
      if (window.treeData) {
        return window.treeData;
      }
      // Try to get from localStorage cache if available [cite: 1892]
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

  scheduleNextRepeat(reminder) {
    if (!reminder.repeatOptions) return;
    const {
      interval,
      unit
    } = reminder.repeatOptions;
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
    const reminders = getReminders();
    reminders[reminder.itemId] = {
      ...reminder,
      timestamp: nextTime
    };
    localStorage.setItem('notes_app_reminders', JSON.stringify(reminders));
    // Clear from processed reminders to allow the next repeat
    this.clearProcessedReminder(reminder.itemId);
    console.log(`Scheduled next repeat for ${reminder.itemId} at ${new Date(nextTime)}`);
  }
}

// Create a singleton instance [cite: 1907]
const reminderMonitor = new ReminderMonitor();
export default reminderMonitor;