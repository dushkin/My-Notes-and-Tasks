/**
 * IndexedDB Manager - Modern async/await wrapper for IndexedDB
 * 
 * Features:
 * - Clean async/await API
 * - Automatic database versioning
 * - Multiple object stores
 * - Bulk operations
 * - Migration support
 * - Error handling with localStorage fallback
 */

class IndexedDBManager {
  constructor(dbName = 'NotaskDB', version = 1) {
    this.dbName = dbName;
    this.version = version;
    this.db = null;
    this.isSupported = this.checkSupport();
    
    // Define database schema
    this.stores = {
      // Auth tokens
      auth: {
        keyPath: 'key',
        indexes: []
      },
      // Tree data cache
      treeData: {
        keyPath: 'userId', 
        indexes: [
          { name: 'lastUpdated', keyPath: 'lastUpdated' }
        ]
      },
      // Sync queue
      syncQueue: {
        keyPath: 'id',
        indexes: [
          { name: 'timestamp', keyPath: 'timestamp' },
          { name: 'attempts', keyPath: 'attempts' }
        ]
      },
      // Failed syncs
      failedSyncs: {
        keyPath: 'id',
        indexes: [
          { name: 'failedAt', keyPath: 'failedAt' }
        ]
      },
      // App settings
      settings: {
        keyPath: 'key',
        indexes: []
      },
      // Offline data cache
      cache: {
        keyPath: 'key',
        indexes: [
          { name: 'expiry', keyPath: 'expiry' },
          { name: 'size', keyPath: 'size' }
        ]
      }
    };
  }

  /**
   * Check if IndexedDB is supported
   */
  checkSupport() {
    if (typeof window === 'undefined') return false;
    
    try {
      return 'indexedDB' in window && window.indexedDB !== null;
    } catch (e) {
      console.warn('IndexedDB support check failed:', e);
      return false;
    }
  }

  /**
   * Initialize the database
   */
  async init() {
    if (!this.isSupported) {
      console.warn('IndexedDB not supported, will use localStorage fallback');
      return false;
    }

    if (this.db) {
      return true; // Already initialized
    }

    try {
      this.db = await this.openDB();
      console.log('✅ IndexedDB initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize IndexedDB:', error);
      this.isSupported = false;
      return false;
    }
  }

  /**
   * Open IndexedDB connection
   */
  openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => {
        reject(new Error(`Failed to open database: ${request.error?.message || 'Unknown error'}`));
      };

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        const transaction = event.target.transaction;
        
        console.log(`🔄 Upgrading IndexedDB from version ${event.oldVersion} to ${event.newVersion}`);
        
        // Create or update object stores
        Object.entries(this.stores).forEach(([storeName, config]) => {
          try {
            let store;
            
            if (db.objectStoreNames.contains(storeName)) {
              // Store exists, get it from transaction
              store = transaction.objectStore(storeName);
            } else {
              // Create new store
              store = db.createObjectStore(storeName, {
                keyPath: config.keyPath,
                autoIncrement: !config.keyPath
              });
              console.log(`📦 Created object store: ${storeName}`);
            }
            
            // Create indexes
            config.indexes?.forEach(index => {
              if (!store.indexNames.contains(index.name)) {
                store.createIndex(index.name, index.keyPath, {
                  unique: index.unique || false
                });
                console.log(`🔍 Created index: ${index.name} on ${storeName}`);
              }
            });
          } catch (storeError) {
            console.error(`Failed to create store ${storeName}:`, storeError);
          }
        });
      };
    });
  }

  /**
   * Get a value from a store
   */
  async get(storeName, key) {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get ${key} from ${storeName}: ${request.error?.message}`));
      };
    });
  }

  /**
   * Set a value in a store
   */
  async set(storeName, data) {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(data);

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error(`Failed to set data in ${storeName}: ${request.error?.message}`));
      };
    });
  }

  /**
   * Delete a value from a store
   */
  async delete(storeName, key) {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error(`Failed to delete ${key} from ${storeName}: ${request.error?.message}`));
      };
    });
  }

  /**
   * Get all values from a store
   */
  async getAll(storeName, limit = null) {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = limit ? store.getAll(null, limit) : store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get all from ${storeName}: ${request.error?.message}`));
      };
    });
  }

  /**
   * Clear all data from a store
   */
  async clear(storeName) {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => {
        resolve(true);
      };

      request.onerror = () => {
        reject(new Error(`Failed to clear ${storeName}: ${request.error?.message}`));
      };
    });
  }

  /**
   * Bulk insert/update operations
   */
  async bulkSet(storeName, dataArray) {
    if (!Array.isArray(dataArray) || dataArray.length === 0) {
      return [];
    }

    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readwrite');
      const store = transaction.objectStore(storeName);
      const results = [];
      let completed = 0;

      transaction.oncomplete = () => {
        resolve(results);
      };

      transaction.onerror = () => {
        reject(new Error(`Bulk set failed in ${storeName}: ${transaction.error?.message}`));
      };

      dataArray.forEach((data, index) => {
        const request = store.put(data);
        
        request.onsuccess = () => {
          results[index] = request.result;
          completed++;
        };

        request.onerror = () => {
          results[index] = { error: request.error?.message };
          completed++;
        };
      });
    });
  }

  /**
   * Query with index
   */
  async queryByIndex(storeName, indexName, value, limit = null) {
    await this.ensureDB();
    
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      
      if (!store.indexNames.contains(indexName)) {
        reject(new Error(`Index ${indexName} does not exist in store ${storeName}`));
        return;
      }

      const index = store.index(indexName);
      const request = limit ? index.getAll(value, limit) : index.getAll(value);

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(new Error(`Failed to query ${storeName} by ${indexName}: ${request.error?.message}`));
      };
    });
  }

  /**
   * Get storage usage information
   */
  async getStorageInfo() {
    if (!this.isSupported) {
      return { supported: false };
    }

    try {
      const estimate = await navigator.storage?.estimate?.();
      const stores = {};
      
      // Get count for each store
      for (const storeName of Object.keys(this.stores)) {
        try {
          const data = await this.getAll(storeName);
          stores[storeName] = {
            count: data.length,
            sizeEstimate: JSON.stringify(data).length
          };
        } catch (e) {
          stores[storeName] = { error: e.message };
        }
      }

      return {
        supported: true,
        quota: estimate?.quota,
        usage: estimate?.usage,
        usagePercentage: estimate?.quota ? ((estimate.usage / estimate.quota) * 100).toFixed(2) : null,
        stores
      };
    } catch (error) {
      return { 
        supported: true, 
        error: error.message,
        stores: {}
      };
    }
  }

  /**
   * Cleanup expired cache entries
   */
  async cleanupExpiredCache() {
    try {
      const now = Date.now();
      const cacheData = await this.getAll('cache');
      const expiredKeys = cacheData
        .filter(item => item.expiry && item.expiry < now)
        .map(item => item.key);

      for (const key of expiredKeys) {
        await this.delete('cache', key);
      }

      console.log(`🧹 Cleaned up ${expiredKeys.length} expired cache entries`);
      return expiredKeys.length;
    } catch (error) {
      console.warn('Failed to cleanup expired cache:', error);
      return 0;
    }
  }

  /**
   * Ensure database is initialized
   */
  async ensureDB() {
    if (!this.db) {
      const success = await this.init();
      if (!success) {
        throw new Error('IndexedDB not available');
      }
    }
  }

  /**
   * Close database connection
   */
  close() {
    if (this.db) {
      this.db.close();
      this.db = null;
      console.log('🔌 IndexedDB connection closed');
    }
  }

  /**
   * Delete the entire database (for testing/reset)
   */
  async deleteDatabase() {
    this.close();
    
    return new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(this.dbName);
      
      deleteRequest.onsuccess = () => {
        console.log(`🗑️ Database ${this.dbName} deleted successfully`);
        resolve(true);
      };
      
      deleteRequest.onerror = () => {
        reject(new Error(`Failed to delete database: ${deleteRequest.error?.message}`));
      };
    });
  }
}

// Create and export singleton instance
const dbManager = new IndexedDBManager('NotaskDB', 1);

export default dbManager;

// Export class for testing
export { IndexedDBManager };