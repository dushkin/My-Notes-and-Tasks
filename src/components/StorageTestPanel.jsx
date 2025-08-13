import React, { useState, useEffect } from 'react';
import testUtils from '../utils/storageTestUtils.js';
import storageManager from '../utils/storageManager.js';

const StorageTestPanel = ({ onClose, initiallyExpanded = false }) => {
  const [testResults, setTestResults] = useState([]);
  const [testing, setTesting] = useState(false);
  const [storageInfo, setStorageInfo] = useState(null);
  const [expanded, setExpanded] = useState(initiallyExpanded);
  
  useEffect(() => {
    loadStorageInfo();
  }, []);

  const loadStorageInfo = async () => {
    try {
      const info = await storageManager.getStorageInfo();
      const usingIndexedDB = await storageManager.isUsingIndexedDB();
      setStorageInfo({ ...info, usingIndexedDB });
    } catch (error) {
      console.error('Failed to load storage info:', error);
    }
  };

  const runTests = async () => {
    setTesting(true);
    try {
      const results = await testUtils.runAllTests();
      setTestResults(results);
    } catch (error) {
      console.error('Test run failed:', error);
    } finally {
      setTesting(false);
    }
  };

  const clearAllStorage = async () => {
    if (!window.confirm('Are you sure you want to clear all storage? This will log you out and remove all offline data.')) {
      return;
    }

    try {
      await storageManager.clear('auth');
      await storageManager.clear('syncQueue');
      await storageManager.clear('failedSyncs');
      await storageManager.clear('treeData');
      await storageManager.clear('cache');
      await storageManager.clear('settings');
      
      alert('All storage cleared! Please refresh the page.');
    } catch (error) {
      console.error('Failed to clear storage:', error);
      alert('Failed to clear storage: ' + error.message);
    }
  };

  const downloadTestReport = () => {
    const report = testUtils.generateTestReport();
    const blob = new Blob([report], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `indexeddb-test-report-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatBytes = (bytes) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const summary = testUtils.getTestSummary();
  const passedTests = testResults.filter(r => r.passed).length;

  if (!expanded) {
    return (
      <div className="fixed bottom-4 left-4 z-50">
        <button
          onClick={() => setExpanded(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
        >
          🗄️ Storage Test
          {testResults.length > 0 && (
            <span className={`text-xs px-2 py-1 rounded ${
              summary.passRate === 100 ? 'bg-green-500' : 'bg-yellow-500'
            }`}>
              {passedTests}/{testResults.length}
            </span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            🗄️ IndexedDB Storage Testing Panel
          </h2>
          <button
            onClick={onClose || (() => setExpanded(false))}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          {/* Storage Info */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Storage Information</h3>
            {storageInfo ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">Storage Type</div>
                  <div className="text-lg">
                    {storageInfo.usingIndexedDB ? (
                      <span className="text-green-600">🗄️ IndexedDB</span>
                    ) : (
                      <span className="text-yellow-600">💾 localStorage (Fallback)</span>
                    )}
                  </div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700 p-3 rounded">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">Usage</div>
                  <div className="text-lg">
                    {storageInfo.quota ? (
                      <>
                        {formatBytes(storageInfo.usage)} / {formatBytes(storageInfo.quota)}
                        <div className="text-sm text-gray-600 dark:text-gray-400">
                          ({storageInfo.usagePercentage}% used)
                        </div>
                      </>
                    ) : (
                      'Unknown'
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-gray-500">Loading storage information...</div>
            )}
          </div>

          {/* Test Controls */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Test Controls</h3>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={runTests}
                disabled={testing}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded flex items-center gap-2"
              >
                {testing ? '🔄' : '🧪'} {testing ? 'Running Tests...' : 'Run All Tests'}
              </button>
              
              {testResults.length > 0 && (
                <button
                  onClick={downloadTestReport}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded flex items-center gap-2"
                >
                  📄 Download Report
                </button>
              )}
              
              <button
                onClick={clearAllStorage}
                className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded flex items-center gap-2"
              >
                🗑️ Clear All Storage
              </button>
              
              <button
                onClick={loadStorageInfo}
                className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded flex items-center gap-2"
              >
                🔄 Refresh Info
              </button>
            </div>
          </div>

          {/* Test Results */}
          {testResults.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                Test Results ({passedTests}/{testResults.length} passed)
              </h3>
              
              {/* Summary */}
              <div className={`p-3 rounded-lg mb-4 ${
                summary.passRate === 100 
                  ? 'bg-green-100 border-green-300 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : summary.passRate >= 75
                  ? 'bg-yellow-100 border-yellow-300 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                  : 'bg-red-100 border-red-300 text-red-800 dark:bg-red-900 dark:text-red-200'
              }`}>
                <div className="font-medium">
                  {summary.passRate === 100 
                    ? '🎉 All tests passed! IndexedDB is working correctly.'
                    : summary.passRate >= 75
                    ? '⚠️ Most tests passed, but some issues detected.'
                    : '❌ Multiple test failures detected. Check fallback mechanisms.'
                  }
                </div>
                <div className="text-sm mt-1">{summary.message}</div>
              </div>

              {/* Individual Test Results */}
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {testResults.map((result, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded border-l-4 ${
                      result.passed
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : 'border-red-500 bg-red-50 dark:bg-red-900/20'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{result.passed ? '✅' : '❌'}</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {result.testName}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {result.details}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
              📋 Testing Instructions
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
              <li>• Click "Run All Tests" to verify IndexedDB functionality</li>
              <li>• Tests cover basic operations, auth tokens, sync queue, and error handling</li>
              <li>• Green results indicate IndexedDB is working correctly</li>
              <li>• Yellow/red results may indicate fallback to localStorage</li>
              <li>• Download the report for detailed analysis</li>
              <li>• Use "Clear All Storage" to reset and test fresh installation</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StorageTestPanel;