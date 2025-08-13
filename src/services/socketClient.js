import { io } from "socket.io-client";

let socket;
let heartbeatInterval;
let reconnectAttempts = 0;
let connectionStatus = 'disconnected'; // 'connected', 'connecting', 'disconnected', 'reconnecting'

// Configuration constants
const HEARTBEAT_INTERVAL = 25000; // 25 seconds (slightly less than server's 30s)
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_BASE = 1000; // 1 second base delay

/**
 * Initializes and returns a single socket instance.
 * Does not create a new socket if one already exists.
 * @param {string} token - The user's JWT for authentication.
 * @returns {Socket} The socket instance.
 */
export function initSocket(token) {
  if (socket && socket.connected) {
    return socket;
  }

  // Disconnect existing socket if it exists but is not connected or has wrong token
  if (socket) {
    cleanupSocket();
  }

  const serverUrl = import.meta.env.VITE_API_BASE_URL || "https://my-notes-and-tasks-backend.onrender.com";

  connectionStatus = 'connecting';
  notifyConnectionStatusChange('connecting');

  socket = io(serverUrl, {
    auth: { token },
    timeout: 10000, // 10 second connection timeout
    reconnection: true,
    reconnectionAttempts: MAX_RECONNECT_ATTEMPTS,
    reconnectionDelay: RECONNECT_DELAY_BASE,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.5,
  });

  socket.on("connect", () => {
    console.log("✅ WebSocket connected:", socket.id);
    console.log("🔍 Socket connection debug:", { socketExists: !!socket, socketId: socket.id, connected: socket.connected });
    
    connectionStatus = 'connected';
    reconnectAttempts = 0; // Reset reconnect attempts on successful connection
    
    // Start heartbeat monitoring
    startHeartbeat();
    
    // Notify any listeners that socket is now available
    window.dispatchEvent(new CustomEvent('socketConnected', { detail: { socketId: socket.id } }));
    notifyConnectionStatusChange('connected');
    
    // Debug: Check if getSocket() works right after connection
    setTimeout(() => {
      const retrievedSocket = getSocket();
      console.log("🔍 getSocket() check after connection:", { 
        retrievedSocketExists: !!retrievedSocket, 
        retrievedSocketId: retrievedSocket?.id,
        originalSocketStillExists: !!socket,
        originalSocketId: socket?.id
      });
    }, 100);
  });

  // Error handler to catch connection failures
  socket.on("connect_error", (err) => {
    console.error("WebSocket connection error:", err.message);
    connectionStatus = 'disconnected';
    
    // Stop heartbeat on connection error
    stopHeartbeat();
    
    // Handle authentication failures
    if (err.message === "Invalid token" || err.message === "No token" || err.message === "unauthorized") {
      console.error("🔐 Authentication error - token may be expired");
      notifyConnectionStatusChange('auth_error');
      disconnectSocket();
      // Don't attempt to reconnect on auth errors
      return;
    }
    
    notifyConnectionStatusChange('connection_error');
  });

  socket.on("disconnect", (reason) => {
    console.log("🔌 WebSocket disconnected:", reason);
    connectionStatus = 'disconnected';
    
    // Stop heartbeat
    stopHeartbeat();
    
    // Notify connection status change
    notifyConnectionStatusChange('disconnected', reason);
  });

  socket.on("reconnect_attempt", (attemptNumber) => {
    console.log(`🔄 Reconnection attempt #${attemptNumber}`);
    connectionStatus = 'reconnecting';
    reconnectAttempts = attemptNumber;
    notifyConnectionStatusChange('reconnecting', attemptNumber);
  });

  socket.on("reconnect_failed", () => {
    console.error("❌ Failed to reconnect after maximum attempts");
    connectionStatus = 'failed';
    notifyConnectionStatusChange('reconnect_failed');
  });

  // Heartbeat handlers
  socket.on('ping', () => {
    console.log('💓 Ping received from server');
    socket.emit('pong'); // Respond to server ping
  });

  socket.on('pong', () => {
    console.log('💓 Pong received from server');
  });

  return socket;
}

/**
 * Returns the active socket instance.
 * @returns {Socket|undefined} The socket instance or undefined if not initialized.
 */
export function getSocket() {
  return socket;
}

/**
 * Disconnects and cleans up the socket instance.
 */
export function disconnectSocket() {
  if (socket) {
    console.log("🔌 Disconnecting socket:", socket.id);
    console.trace("🔍 disconnectSocket() called from:");
    cleanupSocket();
  }
}

/**
 * Get current connection status
 * @returns {string} Current connection status
 */
export function getConnectionStatus() {
  return {
    status: connectionStatus,
    reconnectAttempts,
    isConnected: socket?.connected || false,
    socketId: socket?.id
  };
}

/**
 * Force reconnection (useful for manual retry)
 */
export function forceReconnect() {
  if (socket && !socket.connected) {
    console.log("🔄 Forcing manual reconnection...");
    socket.connect();
  }
}

// Helper Functions

/**
 * Cleanup socket and timers
 */
function cleanupSocket() {
  stopHeartbeat();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  connectionStatus = 'disconnected';
}

/**
 * Start client-side heartbeat
 */
function startHeartbeat() {
  stopHeartbeat(); // Clear any existing heartbeat
  
  heartbeatInterval = setInterval(() => {
    if (socket && socket.connected) {
      console.log('💓 Sending ping to server');
      socket.emit('ping');
    } else {
      console.warn('💔 Cannot send heartbeat - socket not connected');
      stopHeartbeat();
    }
  }, HEARTBEAT_INTERVAL);
  
  console.log(`💓 Started client heartbeat (interval: ${HEARTBEAT_INTERVAL}ms)`);
}

/**
 * Stop client-side heartbeat
 */
function stopHeartbeat() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    console.log('💔 Stopped client heartbeat');
  }
}

/**
 * Notify about connection status changes
 * @param {string} status - New connection status
 * @param {*} details - Additional details
 */
function notifyConnectionStatusChange(status, details = null) {
  window.dispatchEvent(new CustomEvent('socketStatusChange', {
    detail: {
      status,
      details,
      timestamp: Date.now(),
      reconnectAttempts,
      socketId: socket?.id
    }
  }));
}