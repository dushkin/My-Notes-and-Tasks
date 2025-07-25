import { API_BASE_URL } from '../services/apiClient.js';

class SyncManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.syncQueue = [];
    this.lastSyncTime = localStorage.getItem('lastSyncTime') || 0;
    this.conflictResolver = new ConflictResolver();
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second base delay
    
    this.init();
  }

  init() {
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.processSyncQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Process sync queue on startup if online
    if (this.isOnline) {
      this.processSyncQueue();
    }

    // Periodic sync every 30 seconds when online
    setInterval(() => {
      if (this.isOnline) {
        this.processSyncQueue();
      }
    }, 30000);
  }

  // Add operation to sync queue
  addToSyncQueue(operation) {
    const syncItem = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      operation,
      attempts: 0,
      maxAttempts: this.retryAttempts
    };

    this.syncQueue.push(syncItem);
    this.saveSyncQueue();

    // Try to sync immediately if online
    if (this.isOnline) {
      this.processSyncQueue();
    }

    return syncItem.id;
  }

  // Process all pending sync operations
  async processSyncQueue() {
    if (!this.isOnline || this.syncQueue.length === 0) {
      return;
    }

    const queue = [...this.syncQueue];
    
    for (const item of queue) {
      try {
        await this.processSyncItem(item);
        // Remove successful item from queue
        this.syncQueue = this.syncQueue.filter(qItem => qItem.id !== item.id);
      } catch (error) {
        console.error('Sync failed for item:', item.id, error);
        item.attempts++;
        
        if (item.attempts >= item.maxAttempts) {
          console.error('Max retry attempts reached for sync item:', item.id);
          // Move to failed items or handle differently
          this.handleFailedSync(item);
          this.syncQueue = this.syncQueue.filter(qItem => qItem.id !== item.id);
        }
      }
    }

    this.saveSyncQueue();
    this.lastSyncTime = Date.now();
    localStorage.setItem('lastSyncTime', this.lastSyncTime.toString());
  }

  // Process individual sync item
  async processSyncItem(item) {
    const { operation } = item;
    
    switch (operation.type) {
      case 'CREATE_NOTE':
        return await this.syncCreateNote(operation.data);
      case 'UPDATE_NOTE':
        return await this.syncUpdateNote(operation.data);
      case 'UPDATE_CONTENT':
        return await this.syncUpdateContent(operation.data);
      case 'DELETE_NOTE':
        return await this.syncDeleteNote(operation.data);
      case 'CREATE_TASK':
        return await this.syncCreateTask(operation.data);
      case 'UPDATE_TASK':
        return await this.syncUpdateTask(operation.data);
      case 'DELETE_TASK':
        return await this.syncDeleteTask(operation.data);
      default:
        throw new Error('Unknown sync operation type: ' + operation.type);
    }
  }

  // Sync operations for notes
  async syncCreateNote(noteData) {
    const response = await fetch('/api/notes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify(noteData)
    });

    if (!response.ok) {
      throw new Error(`Failed to create note: ${response.statusText}`);
    }

    const serverNote = await response.json();
    
    // Update local storage with server data
    const localNotes = JSON.parse(localStorage.getItem('notes') || '[]');
    const noteIndex = localNotes.findIndex(n => n.tempId === noteData.tempId);
    
    if (noteIndex !== -1) {
      localNotes[noteIndex] = { ...serverNote, synced: true };
      localStorage.setItem('notes', JSON.stringify(localNotes));
    }

    return serverNote;
  }

  async syncUpdateNote(noteData) {
    const response = await fetch(`${API_BASE_URL}/api/notes/${noteData.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify(noteData)
    });

    if (!response.ok) {
      throw new Error(`Failed to update note: ${response.statusText}`);
    }

    const serverNote = await response.json();
    
    // Update local storage
    const localNotes = JSON.parse(localStorage.getItem('notes') || '[]');
    const noteIndex = localNotes.findIndex(n => n.id === noteData.id);
    
    if (noteIndex !== -1) {
      localNotes[noteIndex] = { ...serverNote, synced: true };
      localStorage.setItem('notes', JSON.stringify(localNotes));
    }

    return serverNote;
  }

  // New method for content-only updates (optimized for auto-save)
  async syncUpdateContent(contentData) {
    const { id, content, direction } = contentData;
    
    const updates = { content };
    if (direction) {
      updates.direction = direction;
    }

    const response = await fetch(`${API_BASE_URL || ''}/api/items/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      throw new Error(`Failed to update content: ${response.statusText}`);
    }

    const updatedItem = await response.json();
    
    // Update local tree data if available
    try {
      const treeData = JSON.parse(localStorage.getItem('notes_tree') || '[]');
      if (Array.isArray(treeData)) {
        const updateItemInTree = (items) => {
          return items.map(item => {
            if (item.id === id) {
              return { ...item, ...updatedItem };
            }
            if (item.children && Array.isArray(item.children)) {
              return { ...item, children: updateItemInTree(item.children) };
            }
            return item;
          });
        };
        
        const updatedTree = updateItemInTree(treeData);
        localStorage.setItem('notes_tree', JSON.stringify(updatedTree));
      }
    } catch (error) {
      console.warn('Failed to update local tree cache:', error);
    }

    return updatedItem;
  }

  async syncDeleteNote(noteData) {
    const response = await fetch(`${API_BASE_URL}/api/notes/${noteData.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to delete note: ${response.statusText}`);
    }

    // Remove from local storage
    const localNotes = JSON.parse(localStorage.getItem('notes') || '[]');
    const filteredNotes = localNotes.filter(n => n.id !== noteData.id);
    localStorage.setItem('notes', JSON.stringify(filteredNotes));

    return { success: true };
  }

  // Sync operations for tasks
  async syncCreateTask(taskData) {
    const response = await fetch('/api/tasks', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify(taskData)
    });

    if (!response.ok) {
      throw new Error(`Failed to create task: ${response.statusText}`);
    }

    const serverTask = await response.json();
    
    // Update local storage with server data
    const localTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const taskIndex = localTasks.findIndex(t => t.tempId === taskData.tempId);
    
    if (taskIndex !== -1) {
      localTasks[taskIndex] = { ...serverTask, synced: true };
      localStorage.setItem('tasks', JSON.stringify(localTasks));
    }

    return serverTask;
  }

  async syncUpdateTask(taskData) {
    const response = await fetch(`${API_BASE_URL}/api/tasks/${taskData.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      },
      body: JSON.stringify(taskData)
    });

    if (!response.ok) {
      throw new Error(`Failed to update task: ${response.statusText}`);
    }

    const serverTask = await response.json();
    
    // Update local storage
    const localTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const taskIndex = localTasks.findIndex(t => t.id === taskData.id);
    
    if (taskIndex !== -1) {
      localTasks[taskIndex] = { ...serverTask, synced: true };
      localStorage.setItem('tasks', JSON.stringify(localTasks));
    }

    return serverTask;
  }

  async syncDeleteTask(taskData) {
    const response = await fetch(`${API_BASE_URL}/api/tasks/${taskData.id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('authToken')}`
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to delete task: ${response.statusText}`);
    }

    // Remove from local storage
    const localTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const filteredTasks = localTasks.filter(t => t.id !== taskData.id);
    localStorage.setItem('tasks', JSON.stringify(filteredTasks));

    return { success: true };
  }

  // Handle failed sync operations
  handleFailedSync(item) {
    const failedSyncs = JSON.parse(localStorage.getItem('failedSyncs') || '[]');
    failedSyncs.push({
      ...item,
      failedAt: Date.now()
    });
    localStorage.setItem('failedSyncs', JSON.stringify(failedSyncs));

    // Notify user about sync failure
    this.notifyUser('Sync failed for some items. Will retry when connection improves.');
  }

  // Save sync queue to localStorage
  saveSyncQueue() {
    localStorage.setItem('syncQueue', JSON.stringify(this.syncQueue));
  }

  // Load sync queue from localStorage
  loadSyncQueue() {
    const saved = localStorage.getItem('syncQueue');
    if (saved) {
      this.syncQueue = JSON.parse(saved);
    }
  }

  // Get sync status
  getSyncStatus() {
    return {
      isOnline: this.isOnline,
      queueLength: this.syncQueue.length,
      lastSyncTime: this.lastSyncTime,
      failedSyncs: JSON.parse(localStorage.getItem('failedSyncs') || '[]').length
    };
  }

  // Force sync all data
  async forceSyncAll() {
    if (!this.isOnline) {
      throw new Error('Cannot sync while offline');
    }

    try {
      // Sync notes
      await this.syncAllNotes();
      
      // Sync tasks
      await this.syncAllTasks();
      
      // Process any remaining queue items
      await this.processSyncQueue();
      
      return { success: true, message: 'All data synced successfully' };
    } catch (error) {
      console.error('Force sync failed:', error);
      throw error;
    }
  }

  async syncAllNotes() {
    const localNotes = JSON.parse(localStorage.getItem('notes') || '[]');
    const unsyncedNotes = localNotes.filter(note => !note.synced);

    for (const note of unsyncedNotes) {
      if (note.tempId) {
        // New note, needs to be created
        this.addToSyncQueue({
          type: 'CREATE_NOTE',
          data: note
        });
      } else if (note.modified) {
        // Existing note, needs to be updated
        this.addToSyncQueue({
          type: 'UPDATE_NOTE',
          data: note
        });
      }
    }
  }

  async syncAllTasks() {
    const localTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const unsyncedTasks = localTasks.filter(task => !task.synced);

    for (const task of unsyncedTasks) {
      if (task.tempId) {
        // New task, needs to be created
        this.addToSyncQueue({
          type: 'CREATE_TASK',
          data: task
        });
      } else if (task.modified) {
        // Existing task, needs to be updated
        this.addToSyncQueue({
          type: 'UPDATE_TASK',
          data: task
        });
      }
    }
  }

  // Utility method to notify user
  notifyUser(message) {
    // Try to use push notifications if available
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Sync Status', {
        body: message,
        icon: '/icons/icon-192x192.png'
      });
    } else {
      // Fallback to console or custom notification system
      console.log('Sync notification:', message);
      
      // You could dispatch a custom event here for the UI to handle
      window.dispatchEvent(new CustomEvent('syncNotification', {
        detail: { message }
      }));
    }
  }

  // Cleanup old sync data
  cleanup() {
    const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    
    // Clean up failed syncs older than a week
    const failedSyncs = JSON.parse(localStorage.getItem('failedSyncs') || '[]');
    const recentFailedSyncs = failedSyncs.filter(item => item.failedAt > oneWeekAgo);
    localStorage.setItem('failedSyncs', JSON.stringify(recentFailedSyncs));
  }
}

// Conflict Resolution System
class ConflictResolver {
  constructor() {
    this.strategies = {
      'client-wins': this.clientWins.bind(this),
      'server-wins': this.serverWins.bind(this),
      'last-modified': this.lastModifiedWins.bind(this),
      'merge': this.mergeChanges.bind(this),
      'user-choice': this.userChoice.bind(this)
    };
  }

  resolve(conflict, strategy = 'last-modified') {
    const resolver = this.strategies[strategy];
    if (!resolver) {
      throw new Error(`Unknown conflict resolution strategy: ${strategy}`);
    }
    
    return resolver(conflict);
  }

  clientWins(conflict) {
    return conflict.client;
  }

  serverWins(conflict) {
    return conflict.server;
  }

  lastModifiedWins(conflict) {
    const clientTime = new Date(conflict.client.updatedAt || conflict.client.createdAt);
    const serverTime = new Date(conflict.server.updatedAt || conflict.server.createdAt);
    
    return clientTime > serverTime ? conflict.client : conflict.server;
  }

  mergeChanges(conflict) {
    // Simple merge strategy - combine non-conflicting fields
    const merged = { ...conflict.server };
    
    // Merge specific fields based on type
    if (conflict.client.title !== conflict.server.title) {
      merged.title = conflict.client.title; // Prefer client title
    }
    
    if (conflict.client.content !== conflict.server.content) {
      // For content, we might want to merge or show both versions
      merged.content = this.mergeContent(conflict.client.content, conflict.server.content);
    }
    
    // Always use the latest timestamp
    merged.updatedAt = Math.max(
      new Date(conflict.client.updatedAt || 0).getTime(),
      new Date(conflict.server.updatedAt || 0).getTime()
    );
    
    return merged;
  }

  mergeContent(clientContent, serverContent) {
    // Simple content merge - you might want to implement a more sophisticated diff/merge
    if (clientContent === serverContent) {
      return clientContent;
    }
    
    // If one is empty, use the other
    if (!clientContent.trim()) return serverContent;
    if (!serverContent.trim()) return clientContent;
    
    // Otherwise, combine both with a separator
    return `${clientContent}\n\n--- Merged with server version ---\n\n${serverContent}`;
  }

  async userChoice(conflict) {
    // This would typically show a UI dialog to let the user choose
    return new Promise((resolve) => {
      // Dispatch an event for the UI to handle
      window.dispatchEvent(new CustomEvent('conflictResolution', {
        detail: {
          conflict,
          resolve
        }
      }));
    });
  }
}

// Export the SyncManager class
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SyncManager;
} else {
  window.SyncManager = SyncManager;
}