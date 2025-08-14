import { authFetch } from '../services/apiClient.js';
import storageManager from './storageManager.js';

// ============================================================================
// SYNC CONFIGURATION
// ============================================================================

const SYNC_CONFIG = {
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY_BASE: 1000, // 1 second base delay
  SYNC_INTERVAL: 30000, // 30 seconds
  FAILED_SYNC_RETENTION_DAYS: 7
};

const SYNC_OPERATION_TYPES = {
  CREATE_NOTE: 'CREATE_NOTE',
  UPDATE_NOTE: 'UPDATE_NOTE', 
  UPDATE_CONTENT: 'UPDATE_CONTENT',
  DELETE_NOTE: 'DELETE_NOTE',
  CREATE_TASK: 'CREATE_TASK',
  UPDATE_TASK: 'UPDATE_TASK',
  DELETE_TASK: 'DELETE_TASK'
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Safe content conversion that prevents [object Object]
 * @param {*} value - Value to convert to string
 * @returns {string} Safely converted string
 */
const ensureStringContent = (value) => {
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

/**
 * Creates a unique sync item identifier
 * @returns {string} Unique identifier
 */
const generateSyncItemId = () => {
  return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

/**
 * Creates a sync item structure
 * @param {object} operation - The sync operation
 * @returns {object} Formatted sync item
 */
const createSyncItem = (operation) => ({
  id: generateSyncItemId(),
  timestamp: Date.now(),
  operation,
  attempts: 0,
  maxAttempts: SYNC_CONFIG.MAX_RETRY_ATTEMPTS
});

// ============================================================================
// SYNC MANAGER CLASS
// ============================================================================

class SyncManager {
  constructor() {
    this.isOnline = navigator.onLine;
    this.syncQueue = [];
    this.lastSyncTime = 0;
    this.conflictResolver = new ConflictResolver();
    this.initialized = false;
    this.syncInterval = null;
    
    this.initialize();
  }

  /**
   * Initialize the sync manager
   */
  async initialize() {
    try {
      await this.initializeStorage();
      await this.loadPersistedSyncData();
      this.setupNetworkListeners();
      this.startPeriodicSync();
      
      // Process initial sync queue if online
      if (this.isOnline) {
        this.processSyncQueue();
      }
      
      this.initialized = true;
      console.log('✅ SyncManager initialized with IndexedDB storage');
    } catch (error) {
      console.error('❌ SyncManager initialization failed:', error);
      // Continue without storage - will work in memory only
      this.initialized = true;
    }
  }

  /**
   * Initialize storage system
   */
  async initializeStorage() {
    await storageManager.init();
  }

  /**
   * Load persisted sync data from storage
   */
  async loadPersistedSyncData() {
    await this.loadSyncQueueFromStorage();
    await this.loadLastSyncTime();
  }

  /**
   * Setup network connectivity listeners
   */
  setupNetworkListeners() {
    window.addEventListener('online', () => {
      this.handleOnlineEvent();
    });

    window.addEventListener('offline', () => {
      this.handleOfflineEvent();
    });
  }

  /**
   * Start periodic sync process
   */
  startPeriodicSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    
    this.syncInterval = setInterval(() => {
      if (this.isOnline) {
        this.processSyncQueue();
      }
    }, SYNC_CONFIG.SYNC_INTERVAL);
  }

  /**
   * Handle online event
   */
  handleOnlineEvent() {
    this.isOnline = true;
    this.processSyncQueue();
  }

  /**
   * Handle offline event  
   */
  handleOfflineEvent() {
    this.isOnline = false;
  }

  /**
   * Load sync queue from storage
   */
  async loadSyncQueueFromStorage() {
    try {
      const savedQueue = await storageManager.get('syncQueue', 'queue', []);
      if (Array.isArray(savedQueue)) {
        this.syncQueue = savedQueue;
      }
      console.log(`📦 Loaded ${this.syncQueue.length} sync items from storage`);
    } catch (error) {
      console.warn('Failed to load sync queue from storage:', error);
      this.syncQueue = [];
    }
  }

  /**
   * Load last sync time from storage
   */
  async loadLastSyncTime() {
    try {
      this.lastSyncTime = await storageManager.get('syncQueue', 'lastSyncTime', 0);
    } catch (error) {
      console.warn('Failed to load last sync time from storage:', error);
      this.lastSyncTime = 0;
    }
  }

  /**
   * Ensure sync manager is initialized before operations
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  /**
   * Add operation to sync queue
   * @param {object} operation - The sync operation to queue
   * @returns {string} The sync item ID
   */
  async addToSyncQueue(operation) {
    await this.ensureInitialized();
    
    const syncItem = createSyncItem(operation);
    this.syncQueue.push(syncItem);
    await this.persistSyncQueue();

    // Try to sync immediately if online
    if (this.isOnline) {
      this.processSyncQueue();
    }

    return syncItem.id;
  }

  /**
   * Process all pending sync operations
   */
  async processSyncQueue() {
    await this.ensureInitialized();
    
    if (!this.canProcessSync()) {
      return;
    }

    const queueSnapshot = [...this.syncQueue];
    
    for (const item of queueSnapshot) {
      try {
        await this.executeSyncItem(item);
        this.removeSyncItemFromQueue(item.id);
      } catch (error) {
        await this.handleSyncItemFailure(item, error);
      }
    }

    await this.finalizeSyncProcess();
  }

  /**
   * Check if sync processing can proceed
   * @returns {boolean} True if sync can proceed
   */
  canProcessSync() {
    return this.isOnline && this.syncQueue.length > 0;
  }

  /**
   * Execute a single sync item
   * @param {object} item - The sync item to execute
   */
  async executeSyncItem(item) {
    const { operation } = item;
    
    switch (operation.type) {
      case SYNC_OPERATION_TYPES.CREATE_NOTE:
        return await this.syncCreateNote(operation.data);
      case SYNC_OPERATION_TYPES.UPDATE_NOTE:
        return await this.syncUpdateNote(operation.data);
      case SYNC_OPERATION_TYPES.UPDATE_CONTENT:
        return await this.syncUpdateContent(operation.data);
      case SYNC_OPERATION_TYPES.DELETE_NOTE:
        return await this.syncDeleteNote(operation.data);
      case SYNC_OPERATION_TYPES.CREATE_TASK:
        return await this.syncCreateTask(operation.data);
      case SYNC_OPERATION_TYPES.UPDATE_TASK:
        return await this.syncUpdateTask(operation.data);
      case SYNC_OPERATION_TYPES.DELETE_TASK:
        return await this.syncDeleteTask(operation.data);
      default:
        throw new Error(`Unknown sync operation type: ${operation.type}`);
    }
  }

  /**
   * Remove sync item from queue
   * @param {string} itemId - The item ID to remove
   */
  removeSyncItemFromQueue(itemId) {
    this.syncQueue = this.syncQueue.filter(item => item.id !== itemId);
  }

  /**
   * Handle sync item failure
   * @param {object} item - The failed sync item
   * @param {Error} error - The error that occurred
   */
  async handleSyncItemFailure(item, error) {
    console.error('Sync failed for item:', item.id, error);
    item.attempts++;
    
    if (item.attempts >= item.maxAttempts) {
      console.error('Max retry attempts reached for sync item:', item.id);
      await this.moveItemToFailedSyncs(item);
      this.removeSyncItemFromQueue(item.id);
    }
  }

  /**
   * Finalize sync process
   */
  async finalizeSyncProcess() {
    await this.persistSyncQueue();
    await this.updateLastSyncTime();
  }

  /**
   * Update last sync time
   */
  async updateLastSyncTime() {
    this.lastSyncTime = Date.now();
    await storageManager.set('syncQueue', 'lastSyncTime', this.lastSyncTime);
  }

  // ============================================================================
  // SYNC OPERATION METHODS
  // ============================================================================

  /**
   * Generic method to perform HTTP sync operations
   * @param {string} endpoint - API endpoint
   * @param {string} method - HTTP method
   * @param {object} data - Data to send
   * @returns {Promise<object>} Response data
   */
  async performSyncRequest(endpoint, method, data = null) {
    const options = { method };
    if (data && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      options.body = data;
    }

    const response = await authFetch(endpoint, options);

    if (!response.ok) {
      throw new Error(`Failed to ${method} ${endpoint}: ${response.statusText}`);
    }

    // DELETE operations might not return content
    if (method === 'DELETE') {
      return { success: true };
    }

    return await response.json();
  }

  /**
   * Update local storage after successful sync
   * @param {string} storageKey - Storage key (e.g., 'notes', 'tasks')
   * @param {object} item - Item to update
   * @param {string} operation - Operation type ('create', 'update', 'delete')
   */
  async updateLocalStorageAfterSync(storageKey, item, operation) {
    try {
      const localItems = JSON.parse(localStorage.getItem(storageKey) || '[]');
      
      switch (operation) {
        case 'create':
          const createIndex = localItems.findIndex(i => i.tempId === item.tempId);
          if (createIndex !== -1) {
            localItems[createIndex] = { ...item, synced: true };
          }
          break;
          
        case 'update':
          const updateIndex = localItems.findIndex(i => i.id === item.id);
          if (updateIndex !== -1) {
            localItems[updateIndex] = { ...item, synced: true };
          }
          break;
          
        case 'delete':
          const filteredItems = localItems.filter(i => i.id !== item.id);
          localStorage.setItem(storageKey, JSON.stringify(filteredItems));
          return;
      }
      
      localStorage.setItem(storageKey, JSON.stringify(localItems));
    } catch (error) {
      console.warn(`Failed to update local ${storageKey} storage:`, error);
    }
  }

  /**
   * Sync note creation
   * @param {object} noteData - Note data to create
   * @returns {Promise<object>} Created note data
   */
  async syncCreateNote(noteData) {
    const serverNote = await this.performSyncRequest('/notes', 'POST', noteData);
    await this.updateLocalStorageAfterSync('notes', serverNote, 'create');
    return serverNote;
  }

  /**
   * Sync note update
   * @param {object} noteData - Note data to update
   * @returns {Promise<object>} Updated note data
   */
  async syncUpdateNote(noteData) {
    const serverNote = await this.performSyncRequest(`/notes/${noteData.id}`, 'PUT', noteData);
    await this.updateLocalStorageAfterSync('notes', serverNote, 'update');
    return serverNote;
  }

  /**
   * Sync note deletion
   * @param {object} noteData - Note data to delete
   * @returns {Promise<object>} Success result
   */
  async syncDeleteNote(noteData) {
    const result = await this.performSyncRequest(`/notes/${noteData.id}`, 'DELETE');
    await this.updateLocalStorageAfterSync('notes', noteData, 'delete');
    return result;
  }

  /**
   * Sync content-only updates (optimized for auto-save)
   * @param {object} contentData - Content update data
   * @returns {Promise<object>} Updated item data
   */
  async syncUpdateContent(contentData) {
    const { id, content, direction } = contentData;
    
    // Ensure content is a string
    const stringContent = ensureStringContent(content);
    console.log('📤 SyncManager sending content:', stringContent);
    
    const updates = { content: stringContent };
    if (direction) {
      updates.direction = direction;
    }

    const updatedItem = await this.performSyncRequest(`/items/${id}`, 'PATCH', updates);
    console.log('📥 SyncManager received response:', updatedItem);
    
    // Update local tree data if available
    await this.updateLocalTreeCache(id, updatedItem);

    return updatedItem;
  }

  /**
   * Update local tree cache after content sync
   * @param {string} itemId - Item ID to update
   * @param {object} updatedItem - Updated item data
   */
  async updateLocalTreeCache(itemId, updatedItem) {
    try {
      const treeData = await storageManager.get('treeData', 'notes_tree', []);
      if (Array.isArray(treeData)) {
        const updatedTree = this.updateItemInTree(treeData, itemId, updatedItem);
        await storageManager.set('treeData', 'notes_tree', updatedTree);
      }
    } catch (error) {
      console.warn('Failed to update local tree cache:', error);
    }
  }

  /**
   * Recursively update item in tree structure
   * @param {Array} items - Tree items
   * @param {string} targetId - ID of item to update
   * @param {object} updatedItem - Updated item data
   * @returns {Array} Updated tree items
   */
  updateItemInTree(items, targetId, updatedItem) {
    return items.map(item => {
      if (item.id === targetId) {
        const safeUpdatedItem = { ...updatedItem };
        // Ensure content is always a string
        if (safeUpdatedItem.content && typeof safeUpdatedItem.content !== 'string') {
          console.warn('⚠️ SyncManager storage update contained non-string content:', typeof safeUpdatedItem.content);
          safeUpdatedItem.content = ensureStringContent(safeUpdatedItem.content);
        }
        return { ...item, ...safeUpdatedItem };
      }
      if (item.children && Array.isArray(item.children)) {
        return { ...item, children: this.updateItemInTree(item.children, targetId, updatedItem) };
      }
      return item;
    });
  }

  /**
   * Sync task creation
   * @param {object} taskData - Task data to create
   * @returns {Promise<object>} Created task data
   */
  async syncCreateTask(taskData) {
    const serverTask = await this.performSyncRequest('/tasks', 'POST', taskData);
    await this.updateLocalStorageAfterSync('tasks', serverTask, 'create');
    return serverTask;
  }

  /**
   * Sync task update
   * @param {object} taskData - Task data to update
   * @returns {Promise<object>} Updated task data
   */
  async syncUpdateTask(taskData) {
    const serverTask = await this.performSyncRequest(`/tasks/${taskData.id}`, 'PUT', taskData);
    await this.updateLocalStorageAfterSync('tasks', serverTask, 'update');
    return serverTask;
  }

  /**
   * Sync task deletion
   * @param {object} taskData - Task data to delete
   * @returns {Promise<object>} Success result
   */
  async syncDeleteTask(taskData) {
    const result = await this.performSyncRequest(`/tasks/${taskData.id}`, 'DELETE');
    await this.updateLocalStorageAfterSync('tasks', taskData, 'delete');
    return result;
  }

  // ============================================================================
  // UTILITY AND STORAGE METHODS
  // ============================================================================

  /**
   * Move failed sync item to failed syncs storage
   * @param {object} item - The failed sync item
   */
  async moveItemToFailedSyncs(item) {
    try {
      const failedSyncs = await storageManager.get('failedSyncs', 'items', []);
      failedSyncs.push({
        ...item,
        failedAt: Date.now()
      });
      await storageManager.set('failedSyncs', 'items', failedSyncs);

      // Notify user about sync failure
      this.notifyUserOfSyncFailure('Sync failed for some items. Will retry when connection improves.');
    } catch (error) {
      console.error('Failed to save failed sync item:', error);
    }
  }

  /**
   * Persist sync queue to storage
   */
  async persistSyncQueue() {
    try {
      await storageManager.set('syncQueue', 'queue', this.syncQueue);
    } catch (error) {
      console.error('Failed to save sync queue:', error);
    }
  }

  /**
   * Notify user of sync failure
   * @param {string} message - Notification message
   */
  notifyUserOfSyncFailure(message) {
    // Try to use push notifications if available
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Sync Status', {
        body: message,
        icon: '/icons/icon-192x192.png'
      });
    } else {
      // Fallback to console or custom notification system
      console.log('Sync notification:', message);
      
      // Dispatch custom event for the UI to handle
      window.dispatchEvent(new CustomEvent('syncNotification', {
        detail: { message }
      }));
    }
  }

  /**
   * Get current sync status
   * @returns {Promise<object>} Sync status information
   */
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

  /**
   * Force sync all data immediately
   * @returns {Promise<object>} Success result
   */
  async forceSyncAll() {
    if (!this.isOnline) {
      throw new Error('Cannot sync while offline');
    }

    try {
      await this.queueAllUnsyncedItems();
      await this.processSyncQueue();
      
      return { success: true, message: 'All data synced successfully' };
    } catch (error) {
      console.error('Force sync failed:', error);
      throw error;
    }
  }

  /**
   * Queue all unsynced items for synchronization
   */
  async queueAllUnsyncedItems() {
    await this.queueUnsyncedNotes();
    await this.queueUnsyncedTasks();
  }

  /**
   * Queue unsynced notes for synchronization
   */
  async queueUnsyncedNotes() {
    const localNotes = JSON.parse(localStorage.getItem('notes') || '[]');
    const unsyncedNotes = localNotes.filter(note => !note.synced);

    for (const note of unsyncedNotes) {
      const operationType = note.tempId 
        ? SYNC_OPERATION_TYPES.CREATE_NOTE 
        : SYNC_OPERATION_TYPES.UPDATE_NOTE;
      
      await this.addToSyncQueue({
        type: operationType,
        data: note
      });
    }
  }

  /**
   * Queue unsynced tasks for synchronization
   */
  async queueUnsyncedTasks() {
    const localTasks = JSON.parse(localStorage.getItem('tasks') || '[]');
    const unsyncedTasks = localTasks.filter(task => !task.synced);

    for (const task of unsyncedTasks) {
      const operationType = task.tempId 
        ? SYNC_OPERATION_TYPES.CREATE_TASK 
        : SYNC_OPERATION_TYPES.UPDATE_TASK;
      
      await this.addToSyncQueue({
        type: operationType,
        data: task
      });
    }
  }

  /**
   * Cleanup old sync data
   * @param {number} daysToRetain - Number of days to retain failed syncs
   */
  async cleanupOldSyncData(daysToRetain = SYNC_CONFIG.FAILED_SYNC_RETENTION_DAYS) {
    try {
      const cutoffTime = Date.now() - (daysToRetain * 24 * 60 * 60 * 1000);
      
      // Clean up failed syncs older than retention period
      const failedSyncs = await storageManager.get('failedSyncs', 'items', []);
      const recentFailedSyncs = failedSyncs.filter(item => item.failedAt > cutoffTime);
      await storageManager.set('failedSyncs', 'items', recentFailedSyncs);
      
      const cleanedCount = failedSyncs.length - recentFailedSyncs.length;
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} old failed syncs`);
      }
      
      return cleanedCount;
    } catch (error) {
      console.warn('Failed to cleanup old sync data:', error);
      return 0;
    }
  }

  /**
   * Destroy sync manager and cleanup resources
   */
  destroy() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    
    // Remove event listeners
    window.removeEventListener('online', this.handleOnlineEvent);
    window.removeEventListener('offline', this.handleOfflineEvent);
    
    this.initialized = false;
    console.log('🧹 SyncManager destroyed and resources cleaned up');
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