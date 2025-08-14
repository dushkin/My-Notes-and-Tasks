import { io } from "socket.io-client";

// Socket instance and state management
let socket;
let heartbeatTimer;
let reconnectionTimer;
let currentReconnectAttempts = 0;
let connectionState = 'disconnected';
let storedAuthToken; 

// Connection status constants
const CONNECTION_STATES = {
  CONNECTED: 'connected',
  CONNECTING: 'connecting', 
  DISCONNECTED: 'disconnected',
  RECONNECTING: 'reconnecting',
  FAILED: 'failed',
  AUTH_ERROR: 'auth_error'
};

// Configuration constants
const SOCKET_CONFIG = {
  HEARTBEAT_INTERVAL: 25000, // 25 seconds (slightly less than server's 30s)
  CONNECTION_TIMEOUT: 10000, // 10 second connection timeout
  MAX_RECONNECT_ATTEMPTS: 10, // Increased for better reliability
  RECONNECT_DELAY_BASE: 1000, // 1 second base delay
  RECONNECT_DELAY_MAX: 30000, // 30 seconds max delay
  EXPONENTIAL_BACKOFF_MULTIPLIER: 2, // Doubles delay each attempt
  JITTER_FACTOR: 0.1 // Add 10% random jitter to prevent thundering herd
};

/**
 * Initializes and returns a single socket instance.
 * Does not create a new socket if one already exists.
 * @param {string} authToken - The user's JWT for authentication.
 * @returns {Socket} The socket instance.
 */
export function initializeSocket(authToken) {
  console.log('🔌 Initializing socket with token:', !!authToken);
  
  if (isSocketConnected()) {
    console.log('🔌 Using existing connected socket:', socket.id);
    return socket;
  }

  // Store token for reconnection attempts
  storedAuthToken = authToken;

  // Disconnect existing socket if it exists but is not connected
  if (socket) {
    performSocketCleanup();
  }

  const serverUrl = import.meta.env.VITE_API_BASE_URL || "https://my-notes-and-tasks-backend.onrender.com";

  updateConnectionState(CONNECTION_STATES.CONNECTING);

  socket = io(serverUrl, {
    auth: { token: authToken },
    timeout: SOCKET_CONFIG.CONNECTION_TIMEOUT,
    reconnection: false, // Disable built-in reconnection to use custom exponential backoff
  });

  socket.on("connect", () => {
    console.log("✅ WebSocket connected:", socket.id);
    console.log("🔍 Socket connection debug:", { socketExists: !!socket, socketId: socket.id, connected: socket.connected });
    
    updateConnectionState(CONNECTION_STATES.CONNECTED);
    currentReconnectAttempts = 0; // Reset reconnect attempts on successful connection
    
    // Start heartbeat monitoring
    startClientHeartbeat();
    
    // Notify any listeners that socket is now available
    dispatchSocketEvent('socketConnected', { socketId: socket.id });
    
    // Debug: Check if getSocket() works right after connection
    setTimeout(() => {
      const retrievedSocket = getActiveSocket();
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
    updateConnectionState(CONNECTION_STATES.DISCONNECTED);
    
    // Stop heartbeat on connection error
    stopClientHeartbeat();
    
    // Handle authentication failures
    if (isAuthenticationError(err)) {
      console.error("🔐 Authentication error - token may be expired");
      updateConnectionState(CONNECTION_STATES.AUTH_ERROR);
      disconnectSocket();
      // Don't attempt to reconnect on auth errors
      return;
    }
    
    // Attempt custom exponential backoff reconnection
    scheduleReconnectionAttempt();
    
    updateConnectionState('connection_error');
  });

  socket.on("disconnect", (reason) => {
    console.log("🔌 WebSocket disconnected:", reason);
    updateConnectionState(CONNECTION_STATES.DISCONNECTED);
    
    // Stop heartbeat
    stopClientHeartbeat();
    
    // Only attempt reconnection for certain disconnect reasons
    if (shouldAttemptReconnection(reason)) {
      scheduleReconnectionAttempt();
    }
    
    // Notify connection status change
    dispatchSocketEvent('socketStatusChange', {
      status: CONNECTION_STATES.DISCONNECTED,
      details: reason,
      timestamp: Date.now(),
      reconnectAttempts: currentReconnectAttempts,
      socketId: socket?.id
    });
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
export function getActiveSocket() {
  return socket;
}

/**
 * Disconnects and cleans up the socket instance.
 */
export function disconnectSocket() {
  if (socket) {
    console.log("🔌 Disconnecting socket:", socket.id);
    console.trace("🔍 disconnectSocket() called from:");
    performSocketCleanup();
  }
}

/**
 * Get current connection status
 * @returns {object} Current connection status information
 */
export function getConnectionStatus() {
  return {
    status: connectionState,
    reconnectAttempts: currentReconnectAttempts,
    isConnected: socket?.connected || false,
    socketId: socket?.id
  };
}

/**
 * Force reconnection (useful for manual retry)
 */
export function forceReconnection() {
  console.log("🔄 Forcing manual reconnection...");
  
  // Clear any pending reconnection attempts
  clearReconnectionTimer();
  
  // Reset reconnection attempts for manual retry
  currentReconnectAttempts = 0;
  
  if (storedAuthToken) {
    // Clean up existing socket and create new one
    performSocketCleanup();
    initializeSocket(storedAuthToken);
  } else {
    console.error("❌ Cannot force reconnect: no token available");
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Checks if socket is connected
 * @returns {boolean} True if socket exists and is connected
 */
function isSocketConnected() {
  return socket && socket.connected;
}

/**
 * Checks if an error is an authentication error
 * @param {Error} error - The error to check
 * @returns {boolean} True if it's an authentication error
 */
function isAuthenticationError(error) {
  const authErrorMessages = ["Invalid token", "No token", "unauthorized"];
  return authErrorMessages.includes(error.message);
}

/**
 * Determines if reconnection should be attempted based on disconnect reason
 * @param {string} reason - The disconnect reason
 * @returns {boolean} True if reconnection should be attempted
 */
function shouldAttemptReconnection(reason) {
  const noReconnectReasons = ['io server disconnect', 'io client disconnect'];
  return !noReconnectReasons.includes(reason);
}

/**
 * Updates connection state and notifies listeners
 * @param {string} newState - The new connection state
 */
function updateConnectionState(newState) {
  connectionState = newState;
  dispatchSocketEvent('socketStatusChange', {
    status: newState,
    timestamp: Date.now(),
    reconnectAttempts: currentReconnectAttempts,
    socketId: socket?.id
  });
}

/**
 * Dispatches a socket-related event
 * @param {string} eventName - The event name
 * @param {object} eventData - The event data
 */
function dispatchSocketEvent(eventName, eventData) {
  window.dispatchEvent(new CustomEvent(eventName, { detail: eventData }));
}

/**
 * Clears the reconnection timer
 */
function clearReconnectionTimer() {
  if (reconnectionTimer) {
    clearTimeout(reconnectionTimer);
    reconnectionTimer = null;
  }
}

/**
 * Schedules a reconnection attempt with exponential backoff
 */
function scheduleReconnectionAttempt() {
  clearReconnectionTimer();

  // Check if we've exceeded maximum attempts
  if (currentReconnectAttempts >= SOCKET_CONFIG.MAX_RECONNECT_ATTEMPTS) {
    console.error(`❌ Failed to reconnect after ${SOCKET_CONFIG.MAX_RECONNECT_ATTEMPTS} attempts`);
    updateConnectionState(CONNECTION_STATES.FAILED);
    return;
  }

  updateConnectionState(CONNECTION_STATES.RECONNECTING);
  const currentAttempt = currentReconnectAttempts;
  currentReconnectAttempts++;
  
  console.log(`🔄 Reconnection attempt #${currentReconnectAttempts} of ${SOCKET_CONFIG.MAX_RECONNECT_ATTEMPTS}`);

  const delay = calculateExponentialBackoffDelay(currentAttempt);
  
  reconnectionTimer = setTimeout(() => {
    reconnectionTimer = null;
    
    if (!storedAuthToken) {
      console.error("❌ Cannot reconnect: no token available");
      updateConnectionState(CONNECTION_STATES.FAILED);
      return;
    }

    console.log(`🔄 Attempting to reconnect... (attempt ${currentReconnectAttempts})`);
    
    // Create new socket with exponential backoff
    initializeSocket(storedAuthToken);
  }, delay);
}

/**
 * Calculate exponential backoff delay with jitter
 * @param {number} attempt - Current attempt number (0-based)
 * @returns {number} Delay in milliseconds
 */
function calculateExponentialBackoffDelay(attempt) {
  // Calculate base exponential delay
  const exponentialDelay = SOCKET_CONFIG.RECONNECT_DELAY_BASE * 
    Math.pow(SOCKET_CONFIG.EXPONENTIAL_BACKOFF_MULTIPLIER, attempt);
  
  // Cap at maximum delay
  const cappedDelay = Math.min(exponentialDelay, SOCKET_CONFIG.RECONNECT_DELAY_MAX);
  
  // Add jitter to prevent thundering herd problem
  const jitter = cappedDelay * SOCKET_CONFIG.JITTER_FACTOR * Math.random();
  const finalDelay = cappedDelay + jitter;
  
  console.log(`🔄 Exponential backoff: attempt ${attempt + 1}, delay: ${Math.round(finalDelay)}ms`);
  
  return Math.round(finalDelay);
}

/**
 * Cleanup socket and timers
 */
function performSocketCleanup() {
  stopClientHeartbeat();
  clearReconnectionTimer();
  
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  
  updateConnectionState(CONNECTION_STATES.DISCONNECTED);
  currentReconnectAttempts = 0; // Reset reconnection attempts on cleanup
}

/**
 * Start client-side heartbeat
 */
function startClientHeartbeat() {
  stopClientHeartbeat(); // Clear any existing heartbeat
  
  heartbeatTimer = setInterval(() => {
    if (isSocketConnected()) {
      console.log('💓 Sending ping to server');
      socket.emit('ping');
    } else {
      console.warn('💔 Cannot send heartbeat - socket not connected');
      stopClientHeartbeat();
    }
  }, SOCKET_CONFIG.HEARTBEAT_INTERVAL);
  
  console.log(`💓 Started client heartbeat (interval: ${SOCKET_CONFIG.HEARTBEAT_INTERVAL}ms)`);
}

/**
 * Stop client-side heartbeat
 */
function stopClientHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
    console.log('💔 Stopped client heartbeat');
  }
}

// ============================================================================
// LEGACY FUNCTION EXPORTS (for backward compatibility)
// ============================================================================

// Export original function names for backward compatibility
export const initSocket = initializeSocket;
export const getSocket = getActiveSocket;
export const forceReconnect = forceReconnection;

// ============================================================================
// TESTING AND DEBUG UTILITIES
// ============================================================================

/**
 * Test function to verify exponential backoff delays (for development/debugging)
 * Can be called from browser console: window.testExponentialBackoff()
 */
export function testExponentialBackoff() {
  console.log("🧪 Testing exponential backoff delays:");
  console.log("Configuration:", SOCKET_CONFIG);
  
  for (let i = 0; i < SOCKET_CONFIG.MAX_RECONNECT_ATTEMPTS; i++) {
    const delay = calculateExponentialBackoffDelay(i);
    const baseDelay = SOCKET_CONFIG.RECONNECT_DELAY_BASE * 
      Math.pow(SOCKET_CONFIG.EXPONENTIAL_BACKOFF_MULTIPLIER, i);
    const cappedDelay = Math.min(baseDelay, SOCKET_CONFIG.RECONNECT_DELAY_MAX);
    
    console.log(`Attempt ${i + 1}: ${delay}ms (base: ${baseDelay}ms, capped: ${cappedDelay}ms)`);
  }
}

// Expose test function for browser console debugging
if (typeof window !== 'undefined') {
  window.testExponentialBackoff = testExponentialBackoff;
}