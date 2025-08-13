import { useEffect, useCallback, useRef } from 'react';
import { getSocket } from '../services/socketClient';

/**
 * Hook for handling real-time sync events from Socket.IO
 * @param {Function} onItemUpdated - Callback when an item is updated from another device
 * @param {Function} onItemDeleted - Callback when an item is deleted from another device  
 * @param {Function} onTreeUpdated - Callback when tree structure is updated from another device
 * @param {Function} onItemCreated - Callback when an item is created from another device
 * @param {Function} onItemMoved - Callback when an item is moved from another device
 * @param {boolean} enabled - Whether real-time sync is enabled
 */
export const useRealTimeSync = (
  onItemUpdated,
  onItemDeleted,
  onTreeUpdated,
  onItemCreated,
  onItemMoved,
  enabled = true
) => {
  const callbacksRef = useRef({
    onItemUpdated,
    onItemDeleted,
    onTreeUpdated,
    onItemCreated,
    onItemMoved
  });

  // Update callbacks ref when they change
  useEffect(() => {
    callbacksRef.current = {
      onItemUpdated,
      onItemDeleted,
      onTreeUpdated,
      onItemCreated,
      onItemMoved
    };
  }, [onItemUpdated, onItemDeleted, onTreeUpdated, onItemCreated, onItemMoved]);

  // Handle item created from another device/session
  const handleItemCreated = useCallback((data) => {
    console.log('📡 Real-time item creation received:', data);
    
    if (callbacksRef.current.onItemCreated) {
      callbacksRef.current.onItemCreated(data);
    }
  }, []);

  // Handle item updated from another device
  const handleItemUpdated = useCallback((data) => {
    console.log('📡 Real-time item update received:', data);
    console.log('📡 handleItemUpdated called with data:', JSON.stringify(data, null, 2));
    
    if (callbacksRef.current.onItemUpdated) {
      console.log('📡 Calling onItemUpdated callback');
      callbacksRef.current.onItemUpdated(data);
    } else {
      console.warn('📡 No onItemUpdated callback available');
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

  // Handle item moved from another device
  const handleItemMoved = useCallback((data) => {
    console.log('📡 Real-time item move received:', data);
    
    if (callbacksRef.current.onItemMoved) {
      callbacksRef.current.onItemMoved(data);
    }
  }, []);

  // Extract socket listener setup into a separate function
  const setupSocketListeners = useCallback((socket) => {
    console.log('📡 Setting up real-time sync listeners', {
      socketId: socket.id,
      connected: socket.connected,
      enabled
    });

    // Register event listeners
    socket.on('itemCreated', handleItemCreated);
    socket.on('itemUpdated', handleItemUpdated);
    socket.on('itemDeleted', handleItemDeleted);
    socket.on('itemMoved', handleItemMoved);
    socket.on('treeReplaced', handleTreeUpdated);

    console.log('📡 Real-time sync listeners registered (including itemCreated)');
    console.log('📡 Registered listeners for socket:', socket.id);

    // Add connection status logging
    socket.on('connect', () => {
      console.log('📡 Socket reconnected in useRealTimeSync:', socket.id);
    });
    
    socket.on('disconnect', (reason) => {
      console.warn('📡 Socket disconnected in useRealTimeSync:', reason);
    });

    // Return cleanup function
    return () => {
      socket.off('itemCreated', handleItemCreated);
      socket.off('itemUpdated', handleItemUpdated);
      socket.off('itemDeleted', handleItemDeleted);
      socket.off('itemMoved', handleItemMoved);
      socket.off('treeReplaced', handleTreeUpdated);
      socket.off('connect');
      socket.off('disconnect');
      
      console.log('📡 Real-time sync listeners removed');
    };
  }, [enabled, handleItemCreated, handleItemUpdated, handleItemDeleted, handleItemMoved, handleTreeUpdated]);

  // Set up socket event listeners
  useEffect(() => {
    if (!enabled) return;

    const socket = getSocket();
    if (!socket) {
      console.warn('📡 Socket not available for real-time sync');
      
      // Listen for socket connection event
      const handleSocketConnected = (event) => {
        console.log('📡 Socket connection event received:', event.detail);
        const retrySocket = getSocket();
        if (retrySocket) {
          console.log('📡 Socket became available via event, setting up listeners');
          setupSocketListeners(retrySocket);
        } else {
          console.warn('📡 Socket still not available even after connection event');
        }
      };
      
      window.addEventListener('socketConnected', handleSocketConnected);
      
      // Also keep the timeout retry as backup
      const retryTimeout = setTimeout(() => {
        const retrySocket = getSocket();
        if (retrySocket) {
          console.log('📡 Socket became available on retry, setting up listeners');
          setupSocketListeners(retrySocket);
        } else {
          console.warn('📡 Socket still not available after retry');
        }
      }, 2000); // Increased to 2 seconds
      
      return () => {
        window.removeEventListener('socketConnected', handleSocketConnected);
        clearTimeout(retryTimeout);
      };
    }

    const cleanup = setupSocketListeners(socket);
    return cleanup;
  }, [enabled, handleItemCreated, handleItemUpdated, handleItemDeleted, handleItemMoved, handleTreeUpdated, setupSocketListeners]);

  // Helper function to emit events to other devices
  const emitToOtherDevices = useCallback((eventName, data) => {
    const socket = getSocket();
    if (socket && enabled) {
      socket.emit(eventName, data);
      console.log(`📡 Emitted ${eventName} to other devices:`, data);
      console.log(`📡 Socket status - Connected: ${socket.connected}, ID: ${socket.id}`);
    } else {
      console.warn(`📡 Failed to emit ${eventName} - Socket: ${!!socket}, Enabled: ${enabled}, Connected: ${socket?.connected}`);
    }
  }, [enabled]);

  return {
    emitToOtherDevices,
    isConnected: getSocket()?.connected || false
  };
};

export default useRealTimeSync;