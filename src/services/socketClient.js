import { io } from "socket.io-client";

let socket;

/**
 * Initializes and returns a single socket instance.
 * Does not create a new socket if one already exists.
 * @param {string} token - The user's JWT for authentication.
 * @returns {Socket} The socket instance.
 */
export function initSocket(token) {
  if (socket) {
    return socket;
  }

  const serverUrl = import.meta.env.VITE_SOCKET_SERVER || "http://localhost:5001";
  
  socket = io(serverUrl, {
    auth: { token },
  });

  socket.on("connect", () => {
    console.log("✅ WebSocket connected:", socket.id);
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
    socket.disconnect();
    socket = null;
  }
}