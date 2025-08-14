// ============================================================================
// VERSION CONTROL MIGRATION UTILITIES (Frontend)
// ============================================================================
// Utilities to handle version control migration for cached frontend data

/**
 * Add version fields to items that don't have them
 * @param {Array} items - Array of tree items
 * @returns {Array} Items with version fields added
 */
export const addVersionToItems = (items) => {
  if (!Array.isArray(items)) return items;
  
  return items.map(item => {
    const updatedItem = { ...item };
    
    // Add version field if missing
    if (!updatedItem.version || typeof updatedItem.version !== 'number') {
      updatedItem.version = 1;
    }
    
    // Recursively handle children
    if (updatedItem.children && Array.isArray(updatedItem.children)) {
      updatedItem.children = addVersionToItems(updatedItem.children);
    }
    
    return updatedItem;
  });
};

/**
 * Migrate cached tree data in localStorage/IndexedDB
 * @param {object} storageManager - Storage manager instance
 */
export const migrateCachedTreeData = async (storageManager) => {
  try {
    console.log('🔄 Checking cached tree data for version migration...');
    
    // Check IndexedDB storage
    if (storageManager && storageManager.isUsingIndexedDB && await storageManager.isUsingIndexedDB()) {
      const treeData = await storageManager.get('treeData', 'notes_tree', []);
      
      if (Array.isArray(treeData) && treeData.length > 0) {
        // Check if migration is needed
        const needsMigration = checkIfMigrationNeeded(treeData);
        
        if (needsMigration) {
          console.log('🚀 Migrating cached tree data with version control...');
          const migratedTree = addVersionToItems(treeData);
          await storageManager.set('treeData', 'notes_tree', migratedTree);
          console.log('✅ Cached tree data migration completed');
        } else {
          console.log('✅ Cached tree data already has version control');
        }
      }
    }
    
    // Check localStorage as fallback
    try {
      const localTreeData = localStorage.getItem('treeData');
      if (localTreeData) {
        const parsedData = JSON.parse(localTreeData);
        if (Array.isArray(parsedData) && checkIfMigrationNeeded(parsedData)) {
          console.log('🚀 Migrating localStorage tree data...');
          const migratedTree = addVersionToItems(parsedData);
          localStorage.setItem('treeData', JSON.stringify(migratedTree));
          console.log('✅ localStorage tree data migration completed');
        }
      }
    } catch (error) {
      console.warn('Could not migrate localStorage tree data:', error);
    }
    
  } catch (error) {
    console.warn('Version migration failed for cached data:', error);
    // Don't throw - this shouldn't break the app
  }
};

/**
 * Check if tree data needs version migration
 * @param {Array} items - Tree items to check
 * @returns {boolean} True if migration is needed
 */
const checkIfMigrationNeeded = (items) => {
  if (!Array.isArray(items)) return false;
  
  for (const item of items) {
    if (!item.version || typeof item.version !== 'number') {
      return true;
    }
    
    // Check children recursively
    if (item.children && Array.isArray(item.children)) {
      if (checkIfMigrationNeeded(item.children)) {
        return true;
      }
    }
  }
  
  return false;
};

/**
 * Event handler for version conflict resolution from server
 * @param {Event} event - Custom event with resolution details
 */
export const handleVersionConflictResolution = (event) => {
  const { itemId, resolution, serverItem } = event.detail;
  
  console.log(`🔄 Handling version conflict resolution for item ${itemId}:`, resolution);
  
  if (resolution === 'server' && serverItem) {
    // Dispatch event for UI components to refresh the item
    window.dispatchEvent(new CustomEvent('refreshItem', {
      detail: { 
        itemId, 
        updatedItem: serverItem,
        source: 'versionConflictResolution'
      }
    }));
  }
};

/**
 * Initialize version control event listeners
 */
export const initializeVersionControlListeners = () => {
  // Listen for version conflict resolutions
  window.addEventListener('versionConflictResolved', handleVersionConflictResolution);
  
  console.log('✅ Version control event listeners initialized');
};

/**
 * Cleanup version control event listeners
 */
export const cleanupVersionControlListeners = () => {
  window.removeEventListener('versionConflictResolved', handleVersionConflictResolution);
};

/**
 * Get version info for an item from tree data
 * @param {Array} treeData - Tree data to search
 * @param {string} itemId - Item ID to find
 * @returns {object|null} Item with version info or null
 */
export const getItemVersionInfo = (treeData, itemId) => {
  if (!Array.isArray(treeData)) return null;
  
  for (const item of treeData) {
    if (item.id === itemId) {
      return {
        id: item.id,
        version: item.version || 1,
        updatedAt: item.updatedAt,
        label: item.label
      };
    }
    
    // Search children recursively
    if (item.children && Array.isArray(item.children)) {
      const found = getItemVersionInfo(item.children, itemId);
      if (found) return found;
    }
  }
  
  return null;
};

export default {
  addVersionToItems,
  migrateCachedTreeData,
  initializeVersionControlListeners,
  cleanupVersionControlListeners,
  getItemVersionInfo
};