import { authFetch } from '../services/apiClient.js';
import storageManager from './storageManager.js';

// Safe content conversion that prevents [object Object]
const safeStringify = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    // Handle the specific case where content data is passed as an object
    if (value.content && typeof value.content === 'string') {
      console.warn('⚠️ Extracting content from object:', value);
      return value.content;
    }
    console.warn('⚠️ Attempted to stringify object as content:', value);
    return '';
  }
  return String(value);
};

class SyncManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.syncQueue = [];
    this.lastSyncTime = 0;
    this.conflictResolver = new ConflictResolver();
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second base delay
    this.initialized = false;
    
    this.init();
  }

  async init() {
    try {
      // Initialize storage
      await storageManager.init();
      
      // Load sync data from storage
      await this.loadFromStorage();
      
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
      
      this.initialized = true;
      console.log('✅ SyncManager initialized with IndexedDB storage');
    } catch (error) {
      console.error('❌ SyncManager initialization failed:', error);
      // Continue without storage - will work in memory only
      this.initialized = true;
    }
  }

  // Load sync data from storage
  async loadFromStorage() {
    try {
      // Load sync queue
      const savedQueue = await storageManager.get('syncQueue', 'queue', []);
      if (Array.isArray(savedQueue)) {
        this.syncQueue = savedQueue;
      }
      
      // Load last sync time
      this.lastSyncTime = await storageManager.get('syncQueue', 'lastSyncTime', 0);
      
      console.log(`📦 Loaded ${this.syncQueue.length} sync items from storage`);
    } catch (error) {
      console.warn('Failed to load sync data from storage:', error);
      this.syncQueue = [];
      this.lastSyncTime = 0;
    }
  }

  // Ensure initialization before operations
  async ensureInitialized() {
    if (!this.initialized) {
      await this.init();
    }
  }

  // Add operation to sync queue
  async addToSyncQueue(operation) {
    await this.ensureInitialized();
    
    const syncItem = {
      id: Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      operation,
      attempts: 0,
      maxAttempts: this.retryAttempts
    };

    this.syncQueue.push(syncItem);
    await this.saveSyncQueue();

    // Try to sync immediately if online
    if (this.isOnline) {
      this.processSyncQueue();
    }

    return syncItem.id;
  }

  // Process all pending sync operations
  async processSyncQueue() {
    await this.ensureInitialized();
    
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
          await this.handleFailedSync(item);
          this.syncQueue = this.syncQueue.filter(qItem => qItem.id !== item.id);
        }
      }
    }

    await this.saveSyncQueue();
    this.lastSyncTime = Date.now();
    await storageManager.set('syncQueue', 'lastSyncTime', this.lastSyncTime);
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
    const response = await authFetch('/notes', {
      method: 'POST',
      body: noteData
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
    const response = await authFetch(`/notes/${noteData.id}`, {
      method: 'PUT',
      body: noteData
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
    
    // Ensure content is a string
    const stringContent = safeStringify(content);
    
    console.log('📤 SyncManager sending content:', stringContent);
    
    const updates = { content: stringContent };
    if (direction) {
      updates.direction = direction;
    }

    const response = await authFetch(`/items/${id}`, {
      method: 'PATCH',
      body: updates
    });

    if (!response.ok) {
      throw new Error(`Failed to update content: ${response.statusText}`);
    }

    const updatedItem = await response.json();
    
    console.log('📥 SyncManager received response:', updatedItem);
    
    // Update local tree data if available
    try {
      const treeData = await storageManager.get('treeData', 'notes_tree', []);
      if (Array.isArray(treeData)) {
        const updateItemInTree = (items) => {
          return items.map(item => {
            if (item.id === id) {
              const safeUpdatedItem = { ...updatedItem };
              // Ensure content is always a string
              if (safeUpdatedItem.content && typeof safeUpdatedItem.content !== 'string') {
                console.warn('⚠️ SyncManager storage update contained non-string content:', typeof safeUpdatedItem.content);
                safeUpdatedItem.content = safeStringify(safeUpdatedItem.content);
              }
              return { ...item, ...safeUpdatedItem };
            }
            if (item.children && Array.isArray(item.children)) {
              return { ...item, children: updateItemInTree(item.children) };
            }
            return item;
          });
        };
        
        const updatedTree = updateItemInTree(treeData);
        await storageManager.set('treeData', 'notes_tree', updatedTree);
      }
    } catch (error) {
      console.warn('Failed to update local tree cache:', error);
    }

    return updatedItem;
  }

  async syncDeleteNote(noteData) {
    const response = await authFetch(`/notes/${noteData.id}`, {
      method: 'DELETE'
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
    const response = await authFetch('/tasks', {
      method: 'POST',
      body: taskData
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
    const response = await authFetch(`/tasks/${taskData.id}`, {
      method: 'PUT',
      body: taskData
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
    const response = await authFetch(`/tasks/${taskData.id}`, {
      method: 'DELETE'
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
  async handleFailedSync(item) {
    try {
      const failedSyncs = await storageManager.get('failedSyncs', 'items', []);
      failedSyncs.push({
        ...item,
        failedAt: Date.now()
      });
      await storageManager.set('failedSyncs', 'items', failedSyncs);

      // Notify user about sync failure
      this.notifyUser('Sync failed for some items. Will retry when connection improves.');
    } catch (error) {
      console.error('Failed to save failed sync item:', error);
    }
  }

  // Save sync queue to storage
  async saveSyncQueue() {
    try {
      await storageManager.set('syncQueue', 'queue', this.syncQueue);
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  // Get sync status
  async getSyncStatus() {
    await this.ensureInitialized();
    
    let failedSyncsCount = 0;
    try {
      const failedSyncs = await storageManager.get('failedSyncs', 'items', []);
      failedSyncsCount = failedSyncs.length;
    } catch (error) {
      console.warn('Failed to get failed syncs count:', error);
    }

    return {
      isOnline: this.isOnline,
      queueLength: this.syncQueue.length,
      lastSyncTime: this.lastSyncTime,
      failedSyncs: failedSyncsCount,
      usingIndexedDB: await storageManager.isUsingIndexedDB()
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
  async cleanup() {
    try {
      const oneWeekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      
      // Clean up failed syncs older than a week
      const failedSyncs = await storageManager.get('failedSyncs', 'items', []);
      const recentFailedSyncs = failedSyncs.filter(item => item.failedAt > oneWeekAgo);
      await storageManager.set('failedSyncs', 'items', recentFailedSyncs);
      
      const cleanedCount = failedSyncs.length - recentFailedSyncs.length;
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} old failed syncs`);
      }
    } catch (error) {
      console.warn('Failed to cleanup old sync data:', error);
    }
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