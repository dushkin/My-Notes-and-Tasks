import { io } from "socket.io-client";

let socket;
let heartbeatInterval;
let reconnectTimeout;
let reconnectAttempts = 0;
let connectionStatus = 'disconnected'; // 'connected', 'connecting', 'disconnected', 'reconnecting'
let currentToken; // Store token for reconnection attempts

// Configuration constants
const HEARTBEAT_INTERVAL = 25000; // 25 seconds (slightly less than server's 30s)
const MAX_RECONNECT_ATTEMPTS = 10; // Increased for better reliability
const RECONNECT_DELAY_BASE = 1000; // 1 second base delay
const RECONNECT_DELAY_MAX = 30000; // 30 seconds max delay
const EXPONENTIAL_BACKOFF_MULTIPLIER = 2; // Doubles delay each attempt
const JITTER_FACTOR = 0.1; // Add 10% random jitter to prevent thundering herd

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

  // Store token for reconnection attempts
  currentToken = token;

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
    reconnection: false, // Disable built-in reconnection to use custom exponential backoff
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
    
    // Attempt custom exponential backoff reconnection
    attemptReconnection();
    
    notifyConnectionStatusChange('connection_error');
  });

  socket.on("disconnect", (reason) => {
    console.log("🔌 WebSocket disconnected:", reason);
    connectionStatus = 'disconnected';
    
    // Stop heartbeat
    stopHeartbeat();
    
    // Only attempt reconnection for certain disconnect reasons
    if (reason !== 'io server disconnect' && reason !== 'io client disconnect') {
      attemptReconnection();
    }
    
    // Notify connection status change
    notifyConnectionStatusChange('disconnected', reason);
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
  console.log("🔄 Forcing manual reconnection...");
  
  // Clear any pending reconnection attempts
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  
  // Reset reconnection attempts for manual retry
  reconnectAttempts = 0;
  
  if (currentToken) {
    // Clean up existing socket and create new one
    cleanupSocket();
    initSocket(currentToken);
  } else {
    console.error("❌ Cannot force reconnect: no token available");
  }
}

/**
 * Attempt reconnection with exponential backoff
 */
function attemptReconnection() {
  // Clear any existing reconnection timeout
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }

  // Check if we've exceeded maximum attempts
  if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
    console.error(`❌ Failed to reconnect after ${MAX_RECONNECT_ATTEMPTS} attempts`);
    connectionStatus = 'failed';
    notifyConnectionStatusChange('reconnect_failed');
    return;
  }

  connectionStatus = 'reconnecting';
  const currentAttempt = reconnectAttempts;
  reconnectAttempts++;
  
  console.log(`🔄 Reconnection attempt #${reconnectAttempts} of ${MAX_RECONNECT_ATTEMPTS}`);
  notifyConnectionStatusChange('reconnecting', reconnectAttempts);

  const delay = calculateExponentialBackoffDelay(currentAttempt);
  
  reconnectTimeout = setTimeout(() => {
    reconnectTimeout = null;
    
    if (!currentToken) {
      console.error("❌ Cannot reconnect: no token available");
      connectionStatus = 'failed';
      notifyConnectionStatusChange('reconnect_failed');
      return;
    }

    console.log(`🔄 Attempting to reconnect... (attempt ${reconnectAttempts})`);
    
    // Create new socket with exponential backoff
    initSocket(currentToken);
  }, delay);
}

// Helper Functions

/**
 * Calculate exponential backoff delay with jitter
 * @param {number} attempt - Current attempt number (0-based)
 * @returns {number} Delay in milliseconds
 */
function calculateExponentialBackoffDelay(attempt) {
  // Calculate base exponential delay
  const exponentialDelay = RECONNECT_DELAY_BASE * Math.pow(EXPONENTIAL_BACKOFF_MULTIPLIER, attempt);
  
  // Cap at maximum delay
  const cappedDelay = Math.min(exponentialDelay, RECONNECT_DELAY_MAX);
  
  // Add jitter to prevent thundering herd problem
  const jitter = cappedDelay * JITTER_FACTOR * Math.random();
  const finalDelay = cappedDelay + jitter;
  
  console.log(`🔄 Exponential backoff: attempt ${attempt + 1}, delay: ${Math.round(finalDelay)}ms`);
  
  return Math.round(finalDelay);
}

/**
 * Cleanup socket and timers
 */
function cleanupSocket() {
  stopHeartbeat();
  
  // Clear reconnection timeout
  if (reconnectTimeout) {
    clearTimeout(reconnectTimeout);
    reconnectTimeout = null;
  }
  
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  
  connectionStatus = 'disconnected';
  reconnectAttempts = 0; // Reset reconnection attempts on cleanup
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

/**
 * Test function to verify exponential backoff delays (for development/debugging)
 * Can be called from browser console: window.testExponentialBackoff()
 */
export function testExponentialBackoff() {
  console.log("🧪 Testing exponential backoff delays:");
  console.log("Configuration:", {
    RECONNECT_DELAY_BASE,
    RECONNECT_DELAY_MAX,
    EXPONENTIAL_BACKOFF_MULTIPLIER,
    JITTER_FACTOR,
    MAX_RECONNECT_ATTEMPTS
  });
  
  for (let i = 0; i < MAX_RECONNECT_ATTEMPTS; i++) {
    const delay = calculateExponentialBackoffDelay(i);
    const baseDelay = RECONNECT_DELAY_BASE * Math.pow(EXPONENTIAL_BACKOFF_MULTIPLIER, i);
    const cappedDelay = Math.min(baseDelay, RECONNECT_DELAY_MAX);
    
    console.log(`Attempt ${i + 1}: ${delay}ms (base: ${baseDelay}ms, capped: ${cappedDelay}ms)`);
  }
}

// Expose test function for browser console debugging
if (typeof window !== 'undefined') {
  window.testExponentialBackoff = testExponentialBackoff;
}