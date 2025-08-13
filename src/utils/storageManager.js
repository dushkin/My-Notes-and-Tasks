/**
 * Storage Manager - Unified interface for IndexedDB with localStorage fallback
 * 
 * Provides a consistent API that automatically falls back to localStorage
 * when IndexedDB is not available or fails.
 */

import dbManager from './indexedDBManager.js';

class StorageManager {
  constructor() {
    this.useIndexedDB = null; // Will be determined on first use
    this.initPromise = null;
  }

  /**
   * Initialize storage (determines IndexedDB vs localStorage)
   */
  async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInit();
    return this.initPromise;
  }

  async _doInit() {
    try {
      const success = await dbManager.init();
      this.useIndexedDB = success;
      
      if (success) {
        console.log('📦 StorageManager: Using IndexedDB');
        
        // Migrate existing localStorage data if needed
        await this.migrateFromLocalStorage();
        
        // Schedule periodic cleanup
        this.scheduleCleanup();
      } else {
        console.warn('📦 StorageManager: Falling back to localStorage');
      }
      
      return success;
    } catch (error) {
      console.error('StorageManager init failed:', error);
      this.useIndexedDB = false;
      return false;
    }
  }

  /**
   * Migrate data from localStorage to IndexedDB
   */
  async migrateFromLocalStorage() {
    try {
      const migrationKey = 'indexeddb_migration_completed';
      const migrationCompleted = localStorage.getItem(migrationKey);
      
      if (migrationCompleted) {
        console.log('📦 Migration already completed, skipping');
        return;
      }

      console.log('🔄 Starting localStorage to IndexedDB migration...');

      const migrations = [
        // Auth tokens
        {
          localKeys: ['accessToken', 'refreshToken'],
          store: 'auth',
          transform: (key, value) => ({ key, value, createdAt: Date.now() })
        },
        
        // Tree data
        {
          localKeys: ['notes_tree', 'selectedItemId', 'expandedFolders'],
          store: 'treeData',
          transform: (key, value) => ({
            userId: 'default', // Will be updated when we have user context
            key,
            data: value,
            lastUpdated: Date.now()
          })
        },
        
        // Sync data
        {
          localKeys: ['syncQueue', 'failedSyncs', 'lastSyncTime'],
          store: 'syncQueue',
          transform: (key, value) => ({
            id: `migrated_${key}_${Date.now()}`,
            type: 'MIGRATED_DATA',
            key,
            data: value,
            timestamp: Date.now()
          })
        },
        
        // Settings and misc
        {
          localKeys: ['settings', 'theme', 'language'],
          store: 'settings',
          transform: (key, value) => ({ key, value, updatedAt: Date.now() })
        }
      ];

      let migratedCount = 0;

      for (const migration of migrations) {
        for (const key of migration.localKeys) {
          const value = localStorage.getItem(key);
          if (value !== null) {
            try {
              const parsedValue = JSON.parse(value);
              const transformedData = migration.transform(key, parsedValue);
              await dbManager.set(migration.store, transformedData);
              migratedCount++;
              console.log(`✅ Migrated ${key} to ${migration.store}`);
            } catch (parseError) {
              // Store as raw string if JSON parsing fails
              const transformedData = migration.transform(key, value);
              await dbManager.set(migration.store, transformedData);
              migratedCount++;
              console.log(`✅ Migrated ${key} (raw string) to ${migration.store}`);
            }
          }
        }
      }

      // Mark migration as complete
      localStorage.setItem(migrationKey, JSON.stringify({
        completed: true,
        timestamp: Date.now(),
        migratedCount
      }));

      console.log(`✅ Migration completed! Migrated ${migratedCount} items`);
    } catch (error) {
      console.error('❌ Migration failed:', error);
      // Don't throw - continue with IndexedDB even if migration fails
    }
  }

  /**
   * Schedule periodic cleanup
   */
  scheduleCleanup() {
    // Run cleanup every hour
    setInterval(() => {
      this.cleanup();
    }, 60 * 60 * 1000);

    // Run initial cleanup after 30 seconds
    setTimeout(() => {
      this.cleanup();
    }, 30 * 1000);
  }

  /**
   * Clean up expired data
   */
  async cleanup() {
    if (!this.useIndexedDB) return;

    try {
      await dbManager.cleanupExpiredCache();
      
      // Clean up old failed syncs (older than 7 days)
      const weekAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
      const failedSyncs = await dbManager.queryByIndex('failedSyncs', 'failedAt', IDBKeyRange.upperBound(weekAgo));
      
      for (const sync of failedSyncs) {
        await dbManager.delete('failedSyncs', sync.id);
      }
      
      if (failedSyncs.length > 0) {
        console.log(`🧹 Cleaned up ${failedSyncs.length} old failed syncs`);
      }
    } catch (error) {
      console.warn('Cleanup failed:', error);
    }
  }

  /**
   * Get data with automatic fallback
   */
  async get(store, key, defaultValue = null) {
    await this.init();

    try {
      if (this.useIndexedDB) {
        const result = await dbManager.get(store, key);
        return result ? result.data || result.value || result : defaultValue;
      } else {
        const item = localStorage.getItem(`${store}:${key}`);
        return item !== null ? JSON.parse(item) : defaultValue;
      }
    } catch (error) {
      console.error(`Failed to get ${store}:${key}`, error);
      
      // Try localStorage as fallback even if IndexedDB was preferred
      if (this.useIndexedDB) {
        try {
          const item = localStorage.getItem(`${store}:${key}`);
          return item !== null ? JSON.parse(item) : defaultValue;
        } catch (fallbackError) {
          console.error('Fallback to localStorage also failed:', fallbackError);
        }
      }
      
      return defaultValue;
    }
  }

  /**
   * Set data with automatic fallback
   */
  async set(store, key, data) {
    await this.init();

    try {
      if (this.useIndexedDB) {
        const storeData = {
          key,
          data,
          updatedAt: Date.now()
        };
        
        // Add store-specific fields
        if (store === 'auth') {
          storeData.value = data; // Auth store uses 'value' field
          delete storeData.data;
        } else if (store === 'treeData') {
          storeData.userId = storeData.userId || 'default';
        }
        
        await dbManager.set(store, storeData);
      } else {
        localStorage.setItem(`${store}:${key}`, JSON.stringify(data));
      }
    } catch (error) {
      console.error(`Failed to set ${store}:${key}`, error);
      
      // Try localStorage as fallback
      if (this.useIndexedDB) {
        try {
          localStorage.setItem(`${store}:${key}`, JSON.stringify(data));
          console.warn(`Fell back to localStorage for ${store}:${key}`);
        } catch (fallbackError) {
          console.error('Fallback to localStorage also failed:', fallbackError);
          throw fallbackError;
        }
      } else {
        throw error;
      }
    }
  }

  /**
   * Remove data
   */
  async remove(store, key) {
    await this.init();

    try {
      if (this.useIndexedDB) {
        await dbManager.delete(store, key);
      } else {
        localStorage.removeItem(`${store}:${key}`);
      }
    } catch (error) {
      console.error(`Failed to remove ${store}:${key}`, error);
      
      // Try localStorage as fallback
      if (this.useIndexedDB) {
        localStorage.removeItem(`${store}:${key}`);
      }
    }
  }

  /**
   * Clear all data from a store
   */
  async clear(store) {
    await this.init();

    try {
      if (this.useIndexedDB) {
        await dbManager.clear(store);
      } else {
        // Clear all localStorage keys for this store
        const keysToRemove = [];
        const prefix = `${store}:`;
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith(prefix)) {
            keysToRemove.push(key);
          }
        }
        
        keysToRemove.forEach(key => localStorage.removeItem(key));
      }
    } catch (error) {
      console.error(`Failed to clear ${store}`, error);
    }
  }

  /**
   * Get all data from a store
   */
  async getAll(store) {
    await this.init();

    try {
      if (this.useIndexedDB) {
        const results = await dbManager.getAll(store);
        return results.map(item => ({
          key: item.key,
          data: item.data || item.value,
          ...item
        }));
      } else {
        const results = [];
        const prefix = `${store}:`;
        
        for (let i = 0; i < localStorage.length; i++) {
          const fullKey = localStorage.key(i);
          if (fullKey && fullKey.startsWith(prefix)) {
            const key = fullKey.substring(prefix.length);
            const value = localStorage.getItem(fullKey);
            try {
              results.push({
                key,
                data: JSON.parse(value),
                updatedAt: null
              });
            } catch (e) {
              results.push({
                key,
                data: value,
                updatedAt: null
              });
            }
          }
        }
        
        return results;
      }
    } catch (error) {
      console.error(`Failed to get all from ${store}`, error);
      return [];
    }
  }

  /**
   * Get storage information
   */
  async getStorageInfo() {
    await this.init();

    if (this.useIndexedDB) {
      return await dbManager.getStorageInfo();
    } else {
      // Calculate localStorage usage
      let usage = 0;
      for (let key in localStorage) {
        if (localStorage.hasOwnProperty(key)) {
          usage += localStorage[key].length;
        }
      }
      
      return {
        supported: false,
        type: 'localStorage',
        usage: usage * 2, // Rough estimate (2 bytes per character)
        quota: 5 * 1024 * 1024, // Typical 5MB limit
        usagePercentage: ((usage * 2) / (5 * 1024 * 1024) * 100).toFixed(2)
      };
    }
  }

  /**
   * Check if using IndexedDB
   */
  async isUsingIndexedDB() {
    await this.init();
    return this.useIndexedDB;
  }
}

// Create and export singleton instance
const storageManager = new StorageManager();

export default storageManager;

// Convenience functions for common operations
export const getItem = (store, key, defaultValue) => storageManager.get(store, key, defaultValue);
export const setItem = (store, key, data) => storageManager.set(store, key, data);
export const removeItem = (store, key) => storageManager.remove(store, key);
export const clearStore = (store) => storageManager.clear(store);
export const getAllItems = (store) => storageManager.getAll(store);