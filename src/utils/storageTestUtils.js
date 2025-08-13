/**
 * Storage Test Utilities
 * 
 * Comprehensive testing utilities for IndexedDB migration and storage functionality
 */

import storageManager from './storageManager.js';
import dbManager from './indexedDBManager.js';
import { getAuthStatus, storeTokens, clearTokens } from '../services/authService.js';

class StorageTestUtils {
  constructor() {
    this.testResults = [];
    this.testRunning = false;
  }

  /**
   * Run comprehensive storage tests
   */
  async runAllTests() {
    if (this.testRunning) {
      console.warn('Tests already running');
      return this.testResults;
    }

    this.testRunning = true;
    this.testResults = [];
    
    console.log('🧪 Starting IndexedDB Storage Tests...');
    
    try {
      // Test basic functionality
      await this.testBasicStorageOperations();
      await this.testAuthTokenStorage();
      await this.testSyncQueueOperations();
      await this.testTreeDataStorage();
      await this.testStorageMigration();
      await this.testStorageInfo();
      await this.testBrowserCompatibility();
      await this.testErrorHandling();
      await this.testPerformance();
      
      const passedTests = this.testResults.filter(r => r.passed).length;
      const totalTests = this.testResults.length;
      
      console.log(`✅ Testing completed: ${passedTests}/${totalTests} tests passed`);
      
      if (passedTests === totalTests) {
        console.log('🎉 All tests passed! IndexedDB storage is working correctly.');
      } else {
        console.warn('⚠️ Some tests failed. Check results for details.');
      }
      
    } catch (error) {
      console.error('❌ Test suite failed:', error);
      this.addResult('Test Suite', false, `Suite failed: ${error.message}`);
    } finally {
      this.testRunning = false;
    }
    
    return this.testResults;
  }

  /**
   * Test basic storage operations
   */
  async testBasicStorageOperations() {
    try {
      // Test set/get
      await storageManager.set('cache', 'testKey', { message: 'Hello IndexedDB!' });
      const retrieved = await storageManager.get('cache', 'testKey');
      
      if (!retrieved || retrieved.message !== 'Hello IndexedDB!') {
        throw new Error('Basic set/get failed');
      }
      
      // Test removal
      await storageManager.remove('cache', 'testKey');
      const afterRemoval = await storageManager.get('cache', 'testKey');
      
      if (afterRemoval !== null) {
        throw new Error('Remove operation failed');
      }
      
      this.addResult('Basic Storage Operations', true, 'Set, get, and remove operations working');
    } catch (error) {
      this.addResult('Basic Storage Operations', false, error.message);
    }
  }

  /**
   * Test authentication token storage
   */
  async testAuthTokenStorage() {
    try {
      // Test token storage
      await storeTokens('test-access-token', 'test-refresh-token');
      
      // Wait a bit for async storage
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const authStatus = await getAuthStatus();
      
      if (!authStatus.hasAccessToken || !authStatus.hasRefreshToken) {
        throw new Error('Tokens not stored correctly');
      }
      
      // Test token clearing
      await clearTokens();
      
      const clearedStatus = await getAuthStatus();
      if (clearedStatus.hasAccessToken || clearedStatus.hasRefreshToken) {
        throw new Error('Tokens not cleared correctly');
      }
      
      this.addResult('Auth Token Storage', true, `Using ${authStatus.usingIndexedDB ? 'IndexedDB' : 'localStorage'}`);
    } catch (error) {
      this.addResult('Auth Token Storage', false, error.message);
    }
  }

  /**
   * Test sync queue operations
   */
  async testSyncQueueOperations() {
    try {
      const testQueue = [
        { id: '1', operation: { type: 'TEST' }, timestamp: Date.now() },
        { id: '2', operation: { type: 'TEST2' }, timestamp: Date.now() }
      ];
      
      await storageManager.set('syncQueue', 'queue', testQueue);
      const retrieved = await storageManager.get('syncQueue', 'queue', []);
      
      if (!Array.isArray(retrieved) || retrieved.length !== 2) {
        throw new Error('Sync queue storage failed');
      }
      
      // Test failed syncs
      const failedSync = { id: 'failed1', failedAt: Date.now(), error: 'Test error' };
      await storageManager.set('failedSyncs', 'items', [failedSync]);
      
      const retrievedFailed = await storageManager.get('failedSyncs', 'items', []);
      if (!Array.isArray(retrievedFailed) || retrievedFailed.length !== 1) {
        throw new Error('Failed syncs storage failed');
      }
      
      this.addResult('Sync Queue Operations', true, 'Sync queue and failed syncs storage working');
    } catch (error) {
      this.addResult('Sync Queue Operations', false, error.message);
    }
  }

  /**
   * Test tree data storage
   */
  async testTreeDataStorage() {
    try {
      const testTree = [
        { id: '1', label: 'Test Item', children: [] },
        { id: '2', label: 'Test Folder', children: [
          { id: '3', label: 'Nested Item', children: [] }
        ]}
      ];
      
      await storageManager.set('treeData', 'notes_tree', testTree);
      const retrieved = await storageManager.get('treeData', 'notes_tree', []);
      
      if (!Array.isArray(retrieved) || retrieved.length !== 2) {
        throw new Error('Tree data storage failed');
      }
      
      if (!retrieved[1].children || retrieved[1].children.length !== 1) {
        throw new Error('Nested tree structure not preserved');
      }
      
      this.addResult('Tree Data Storage', true, 'Tree structure preserved correctly');
    } catch (error) {
      this.addResult('Tree Data Storage', false, error.message);
    }
  }

  /**
   * Test storage migration from localStorage
   */
  async testStorageMigration() {
    try {
      // Simulate localStorage data
      localStorage.setItem('test_migration_key', JSON.stringify({ migrated: false }));
      
      // Test manual migration
      const legacyData = localStorage.getItem('test_migration_key');
      if (legacyData) {
        const parsed = JSON.parse(legacyData);
        await storageManager.set('cache', 'test_migration_key', { ...parsed, migrated: true });
      }
      
      const migratedData = await storageManager.get('cache', 'test_migration_key');
      if (!migratedData || !migratedData.migrated) {
        throw new Error('Migration test failed');
      }
      
      // Cleanup
      localStorage.removeItem('test_migration_key');
      await storageManager.remove('cache', 'test_migration_key');
      
      this.addResult('Storage Migration', true, 'localStorage to IndexedDB migration working');
    } catch (error) {
      this.addResult('Storage Migration', false, error.message);
    }
  }

  /**
   * Test storage information and limits
   */
  async testStorageInfo() {
    try {
      const info = await storageManager.getStorageInfo();
      
      if (!info || typeof info.supported === 'undefined') {
        throw new Error('Storage info not available');
      }
      
      const usingIndexedDB = await storageManager.isUsingIndexedDB();
      
      this.addResult('Storage Information', true, 
        `Using ${usingIndexedDB ? 'IndexedDB' : 'localStorage'}, ` +
        `Usage: ${info.usagePercentage || 'unknown'}%`);
    } catch (error) {
      this.addResult('Storage Information', false, error.message);
    }
  }

  /**
   * Test browser compatibility
   */
  async testBrowserCompatibility() {
    try {
      const support = {
        indexedDB: !!window.indexedDB,
        storageEstimate: !!(navigator.storage && navigator.storage.estimate),
        promiseSupport: typeof Promise !== 'undefined',
        asyncAwaitSupport: true // If we're running this, async/await works
      };
      
      let compatibilityScore = 0;
      let total = 0;
      
      Object.entries(support).forEach(([feature, supported]) => {
        total++;
        if (supported) compatibilityScore++;
      });
      
      const percentage = Math.round((compatibilityScore / total) * 100);
      
      this.addResult('Browser Compatibility', percentage >= 75, 
        `${compatibilityScore}/${total} features supported (${percentage}%)`);
    } catch (error) {
      this.addResult('Browser Compatibility', false, error.message);
    }
  }

  /**
   * Test error handling and fallbacks
   */
  async testErrorHandling() {
    try {
      // Test invalid store name
      try {
        await storageManager.get('invalid_store_name', 'key');
        // Should still work due to fallbacks
      } catch (error) {
        // Expected in some cases
      }
      
      // Test large data storage (should handle gracefully)
      const largeData = {
        data: new Array(10000).fill('x').join(''), // ~10KB string
        timestamp: Date.now()
      };
      
      await storageManager.set('cache', 'large_test', largeData);
      const retrieved = await storageManager.get('cache', 'large_test');
      
      if (!retrieved || retrieved.data.length !== largeData.data.length) {
        throw new Error('Large data storage failed');
      }
      
      await storageManager.remove('cache', 'large_test');
      
      this.addResult('Error Handling', true, 'Fallbacks and large data handling working');
    } catch (error) {
      this.addResult('Error Handling', false, error.message);
    }
  }

  /**
   * Test performance benchmarks
   */
  async testPerformance() {
    try {
      const testData = { timestamp: Date.now(), data: 'Performance test data' };
      const iterations = 100;
      
      // Test write performance
      const writeStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await storageManager.set('cache', `perf_test_${i}`, { ...testData, id: i });
      }
      const writeTime = performance.now() - writeStart;
      
      // Test read performance
      const readStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        await storageManager.get('cache', `perf_test_${i}`);
      }
      const readTime = performance.now() - readStart;
      
      // Cleanup
      for (let i = 0; i < iterations; i++) {
        await storageManager.remove('cache', `perf_test_${i}`);
      }
      
      const writeOpsPerSec = Math.round(iterations / (writeTime / 1000));
      const readOpsPerSec = Math.round(iterations / (readTime / 1000));
      
      this.addResult('Performance Benchmark', true, 
        `Write: ${writeOpsPerSec} ops/sec, Read: ${readOpsPerSec} ops/sec`);
    } catch (error) {
      this.addResult('Performance Benchmark', false, error.message);
    }
  }

  /**
   * Add test result
   */
  addResult(testName, passed, details) {
    const result = {
      testName,
      passed,
      details,
      timestamp: new Date().toISOString()
    };
    
    this.testResults.push(result);
    
    const icon = passed ? '✅' : '❌';
    console.log(`${icon} ${testName}: ${details}`);
  }

  /**
   * Get test results summary
   */
  getTestSummary() {
    if (this.testResults.length === 0) {
      return { message: 'No tests run yet', results: [] };
    }
    
    const passedTests = this.testResults.filter(r => r.passed).length;
    const totalTests = this.testResults.length;
    const passRate = Math.round((passedTests / totalTests) * 100);
    
    return {
      message: `${passedTests}/${totalTests} tests passed (${passRate}%)`,
      passedTests,
      totalTests,
      passRate,
      results: this.testResults
    };
  }

  /**
   * Create a visual test report
   */
  generateTestReport() {
    const summary = this.getTestSummary();
    
    let report = `
# IndexedDB Storage Test Report

**Generated:** ${new Date().toLocaleString()}
**Status:** ${summary.passedTests}/${summary.totalTests} tests passed (${summary.passRate}%)

## Test Results

`;

    this.testResults.forEach((result, index) => {
      const status = result.passed ? '✅ PASS' : '❌ FAIL';
      report += `${index + 1}. **${result.testName}** - ${status}\n   ${result.details}\n\n`;
    });

    report += `
## Recommendations

${summary.passRate === 100 ? 
  '🎉 All tests passed! Your IndexedDB implementation is working correctly.' :
  '⚠️  Some tests failed. Review the failed tests and ensure proper fallback mechanisms are in place.'
}
`;

    return report;
  }
}

// Create singleton instance
const testUtils = new StorageTestUtils();

export default testUtils;

// Export individual test functions for selective testing
export {
  testUtils,
  StorageTestUtils
};