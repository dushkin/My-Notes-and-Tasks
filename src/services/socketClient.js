import { io } from "socket.io-client";

let socket;

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
    socket.disconnect();
  }

  const serverUrl = import.meta.env.VITE_API_BASE_URL || "https://my-notes-and-tasks-backend.onrender.com";

  socket = io(serverUrl, {
    auth: { token },
  });

  socket.on("connect", () => {
    console.log("✅ WebSocket connected:", socket.id);
    console.log("🔍 Socket connection debug:", { socketExists: !!socket, socketId: socket.id, connected: socket.connected });
    
    // Notify any listeners that socket is now available
    window.dispatchEvent(new CustomEvent('socketConnected', { detail: { socketId: socket.id } }));
    
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

  // ✨ Error handler to catch connection failures
  socket.on("connect_error", (err) => {
    console.error("WebSocket connection error:", err.message);

    // This is where you would handle authentication failures
    if (err.message === "Invalid token" || err.message === "No token") {
      // For example, you could disconnect the socket to prevent retries
      // and then redirect the user to the login page.
      disconnectSocket();
      // window.location.href = '/login'; 
    }
  });

  socket.on("disconnect", () => {
    console.log("🔌 WebSocket disconnected");
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
    socket.disconnect();
    socket = null;
  }
}