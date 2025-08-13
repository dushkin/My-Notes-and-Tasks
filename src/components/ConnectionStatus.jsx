import React, { useState, useEffect } from 'react';
import { getConnectionStatus, forceReconnect } from '../services/socketClient';

const ConnectionStatus = ({ position = 'bottom-right', showDetailedStatus = false }) => {
  const [connectionInfo, setConnectionInfo] = useState({
    status: 'disconnected',
    reconnectAttempts: 0,
    isConnected: false,
    socketId: null,
    lastUpdate: Date.now()
  });
  
  const [showDetails, setShowDetails] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Update initial connection status
    const initialStatus = getConnectionStatus();
    setConnectionInfo(prev => ({ ...prev, ...initialStatus, lastUpdate: Date.now() }));

    // Listen for connection status changes
    const handleStatusChange = (event) => {
      const { status, details, timestamp, reconnectAttempts, socketId } = event.detail;
      
      setConnectionInfo(prev => ({
        ...prev,
        status,
        details,
        reconnectAttempts,
        socketId,
        isConnected: status === 'connected',
        lastUpdate: timestamp
      }));

      // Show indicator temporarily on status change
      setIsVisible(true);
      if (status === 'connected') {
        setTimeout(() => setIsVisible(false), 3000); // Hide after 3s when connected
      }
    };

    window.addEventListener('socketStatusChange', handleStatusChange);
    
    // Cleanup
    return () => {
      window.removeEventListener('socketStatusChange', handleStatusChange);
    };
  }, []);

  // Auto-hide when connected and no interaction
  useEffect(() => {
    if (connectionInfo.status === 'connected' && !showDetails) {
      const timer = setTimeout(() => setIsVisible(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [connectionInfo.status, showDetails]);

  // Always show if not connected or reconnecting
  useEffect(() => {
    if (['connecting', 'reconnecting', 'disconnected', 'connection_error', 'auth_error', 'failed'].includes(connectionInfo.status)) {
      setIsVisible(true);
    }
  }, [connectionInfo.status]);

  const getStatusConfig = (status) => {
    switch (status) {
      case 'connected':
        return {
          color: 'bg-green-500',
          icon: '🟢',
          text: 'Connected',
          textColor: 'text-green-700'
        };
      case 'connecting':
        return {
          color: 'bg-yellow-500 animate-pulse',
          icon: '🟡',
          text: 'Connecting...',
          textColor: 'text-yellow-700'
        };
      case 'reconnecting':
        return {
          color: 'bg-orange-500 animate-pulse',
          icon: '🔄',
          text: `Reconnecting... (${connectionInfo.reconnectAttempts}/${5})`,
          textColor: 'text-orange-700'
        };
      case 'disconnected':
        return {
          color: 'bg-red-500',
          icon: '🔴',
          text: 'Disconnected',
          textColor: 'text-red-700'
        };
      case 'connection_error':
        return {
          color: 'bg-red-500',
          icon: '❌',
          text: 'Connection Error',
          textColor: 'text-red-700'
        };
      case 'auth_error':
        return {
          color: 'bg-purple-500',
          icon: '🔐',
          text: 'Authentication Error',
          textColor: 'text-purple-700'
        };
      case 'failed':
        return {
          color: 'bg-gray-500',
          icon: '💀',
          text: 'Connection Failed',
          textColor: 'text-gray-700'
        };
      default:
        return {
          color: 'bg-gray-500',
          icon: '❓',
          text: 'Unknown',
          textColor: 'text-gray-700'
        };
    }
  };

  const handleRetryConnection = () => {
    console.log('🔄 User requested manual reconnection');
    forceReconnect();
  };

  const statusConfig = getStatusConfig(connectionInfo.status);

  // Position classes
  const positionClasses = {
    'top-left': 'top-4 left-4',
    'top-right': 'top-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4'
  };

  if (!isVisible && connectionInfo.status === 'connected') {
    return null;
  }

  return (
    <div className={`fixed ${positionClasses[position]} z-50 select-none`}>
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg max-w-sm">
        {/* Status Indicator */}
        <div 
          className="flex items-center gap-3 p-3 cursor-pointer hover:bg-gray-50"
          onClick={() => setShowDetails(!showDetails)}
        >
          <div className={`w-3 h-3 rounded-full ${statusConfig.color}`} />
          <span className={`text-sm font-medium ${statusConfig.textColor}`}>
            {statusConfig.text}
          </span>
          {(['disconnected', 'connection_error', 'failed'].includes(connectionInfo.status)) && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRetryConnection();
              }}
              className="ml-2 px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
            >
              Retry
            </button>
          )}
          {connectionInfo.status === 'connected' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsVisible(false);
              }}
              className="ml-2 text-xs text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          )}
        </div>

        {/* Detailed Status (collapsible) */}
        {(showDetails || showDetailedStatus) && (
          <div className="border-t border-gray-100 p-3 text-xs text-gray-600 space-y-2">
            {connectionInfo.socketId && (
              <div>Socket ID: <code className="bg-gray-100 px-1 rounded">{connectionInfo.socketId}</code></div>
            )}
            <div>Last Update: {new Date(connectionInfo.lastUpdate).toLocaleTimeString()}</div>
            {connectionInfo.reconnectAttempts > 0 && (
              <div>Reconnect Attempts: {connectionInfo.reconnectAttempts}</div>
            )}
            {connectionInfo.details && (
              <div>Details: {JSON.stringify(connectionInfo.details)}</div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setShowDetails(false)}
                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
              >
                Hide Details
              </button>
              {connectionInfo.status !== 'connected' && (
                <button
                  onClick={handleRetryConnection}
                  className="px-2 py-1 text-xs bg-blue-100 hover:bg-blue-200 text-blue-700 rounded"
                >
                  Force Reconnect
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConnectionStatus;