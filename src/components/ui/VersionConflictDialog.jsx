import React, { useState } from 'react';

const VersionConflictDialog = ({ 
  isOpen, 
  conflict, 
  onResolve, 
  onCancel 
}) => {
  const [showDetails, setShowDetails] = useState(false);

  if (!isOpen || !conflict) return null;

  const handleAcceptServer = () => {
    onResolve('server');
  };

  const handleForceClient = () => {
    onResolve('client');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center mb-4">
            <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center mr-4">
              <svg 
                className="w-6 h-6 text-yellow-600 dark:text-yellow-400" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth="2" 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Content Conflict Detected
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                This item has been modified by another client
              </p>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm text-zinc-700 dark:text-zinc-300 mb-4">
              The content you're editing has been changed by another device or browser session. 
              You need to choose which version to keep:
            </p>
            
            <div className="space-y-3">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-blue-800 dark:text-blue-200">
                    Server Version (Other Device)
                  </span>
                  <span className="text-xs text-blue-600 dark:text-blue-400">
                    v{conflict.serverVersion}
                  </span>
                </div>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Last saved: {new Date(conflict.serverItem?.updatedAt).toLocaleString()}
                </p>
              </div>
              
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="font-medium text-green-800 dark:text-green-200">
                    Your Version (This Device)
                  </span>
                  <span className="text-xs text-green-600 dark:text-green-400">
                    v{conflict.clientVersion}
                  </span>
                </div>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Contains your current unsaved changes
                </p>
              </div>
            </div>

            {showDetails && (
              <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-700 rounded-lg">
                <h4 className="font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                  Content Preview:
                </h4>
                <div className="text-xs text-zinc-600 dark:text-zinc-400 space-y-2">
                  <div>
                    <strong>Server:</strong>
                    <div className="mt-1 p-2 bg-white dark:bg-zinc-800 rounded border">
                      {conflict.serverItem?.content?.substring(0, 150) || 'Empty'}
                      {conflict.serverItem?.content?.length > 150 && '...'}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col space-y-3">
            <button
              onClick={handleAcceptServer}
              className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Accept Server Version
              <span className="block text-xs opacity-90">
                Your changes will be lost
              </span>
            </button>
            
            <button
              onClick={handleForceClient}
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              Keep Your Changes
              <span className="block text-xs opacity-90">
                Override the server version
              </span>
            </button>
            
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 underline"
            >
              {showDetails ? 'Hide Details' : 'Show Content Details'}
            </button>
            
            <button
              onClick={onCancel}
              className="text-sm text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            >
              Cancel (Keep Editing)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VersionConflictDialog;