import { useEffect, useCallback, useRef } from 'react';
import { getSocket } from '../services/socketClient';

/**
 * Hook for handling real-time sync events from Socket.IO
 * @param {Function} onItemUpdated - Callback when an item is updated from another device
 * @param {Function} onItemDeleted - Callback when an item is deleted from another device  
 * @param {Function} onTreeUpdated - Callback when tree structure is updated from another device
 * @param {boolean} enabled - Whether real-time sync is enabled
 */
export const useRealTimeSync = (
  onItemUpdated,
  onItemDeleted,
  onTreeUpdated,
  enabled = true
) => {
  const callbacksRef = useRef({
    onItemUpdated,
    onItemDeleted,
    onTreeUpdated
  });

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = {
      onItemUpdated,
      onItemDeleted,
      onTreeUpdated
    };
  }, [onItemUpdated, onItemDeleted, onTreeUpdated]);

  // Handle item updated from another device
  const handleItemUpdated = useCallback((data) => {
    console.log('📡 Real-time item update received:', data);
    
    if (callbacksRef.current.onItemUpdated) {
      callbacksRef.current.onItemUpdated(data);
    }
  }, []);

  // Handle item deleted from another device
  const handleItemDeleted = useCallback((data) => {
    console.log('📡 Real-time item deletion received:', data);
    
    if (callbacksRef.current.onItemDeleted) {
      callbacksRef.current.onItemDeleted(data);
    }
  }, []);

  // Handle tree structure updated from another device
  const handleTreeUpdated = useCallback((data) => {
    console.log('📡 Real-time tree update received:', data);
    
    if (callbacksRef.current.onTreeUpdated) {
      callbacksRef.current.onTreeUpdated(data);
    }
  }, []);

  // Set up socket event listeners
  useEffect(() => {
    if (!enabled) return;

    const socket = getSocket();
    if (!socket) {
      console.warn('Socket not available for real-time sync');
      return;
    }

    // Register event listeners
    socket.on('itemUpdated', handleItemUpdated);
    socket.on('itemDeleted', handleItemDeleted);
    socket.on('treeReplaced', handleTreeUpdated);

    console.log('📡 Real-time sync listeners registered');

    // Cleanup function
    return () => {
      socket.off('itemUpdated', handleItemUpdated);
      socket.off('itemDeleted', handleItemDeleted);
      socket.off('treeReplaced', handleTreeUpdated);
      
      console.log('📡 Real-time sync listeners removed');
    };
  }, [enabled, handleItemUpdated, handleItemDeleted, handleTreeUpdated]);

  // Helper function to emit events to other devices
  const emitToOtherDevices = useCallback((eventName, data) => {
    const socket = getSocket();
    if (socket && enabled) {
      socket.emit(eventName, data);
      console.log(`📡 Emitted ${eventName} to other devices:`, data);
    }
  }, [enabled]);

  return {
    emitToOtherDevices,
    isConnected: getSocket()?.connected || false
  };
};

export default useRealTimeSync;