import { getReminders, clearReminder } from './reminderUtils';
import { showNotification } from './reminderUtils';

class ReminderMonitor {
  constructor() {
    this.intervalId = null;
    this.checkInterval = 30000; // Check every 30 seconds
  }

  start() {
    if (this.intervalId) {
      this.stop();
    }
    
    console.log('Starting reminder monitor...');
    this.intervalId = setInterval(() => {
      this.checkReminders();
    }, this.checkInterval);
    
    // Check immediately on start
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
      if (reminder.timestamp <= now) {
        this.triggerReminder(reminder);
        
        // Handle repeating reminders
        if (reminder.repeatOptions) {
          this.scheduleNextRepeat(reminder);
        } else {
          // Clear non-repeating reminder
          clearReminder(reminder.itemId);
        }
      }
    });
  }

  triggerReminder(reminder) {
    console.log('Triggering reminder:', reminder);
    
    // Find the item title from the tree structure
    const itemTitle = this.findItemTitle(reminder.itemId);
    
    // Show notification
    const title = '⏰ Reminder';
    const body = `Don't forget: ${itemTitle || 'Untitled'}`;
    showNotification(title, body);
    
    // You could also dispatch a custom event here for the UI to handle
    window.dispatchEvent(new CustomEvent('reminderTriggered', {
      detail: { ...reminder, itemTitle }
    }));
  }

  findItemTitle(itemId) {
    // Try to get the tree data from localStorage or other sources
    try {
      // Check if we have access to the tree data
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
    // Try to get tree data from various sources
    try {
      // First, try to get from window/global state if available
      if (window.treeData) {
        return window.treeData;
      }
      
      // Try to get from localStorage cache if available
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
    
    // Update the reminder with the next occurrence time
    const reminders = getReminders();
    reminders[reminder.itemId] = {
      ...reminder,
      timestamp: nextTime
    };
    localStorage.setItem('notes_app_reminders', JSON.stringify(reminders));
    
    console.log(`Scheduled next repeat for ${reminder.itemId} at ${new Date(nextTime)}`);
  }
}

// Create a singleton instance
const reminderMonitor = new ReminderMonitor();

export default reminderMonitor;
