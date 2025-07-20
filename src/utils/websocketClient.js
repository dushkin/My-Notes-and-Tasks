import { io } from "socket.io-client";

export function connectLiveUpdates(token) { // 👈 Change parameter to `token`
  if (!token) { // 👈 Update check for the new parameter
    console.warn("connectLiveUpdates: Missing token"); // 👈 Update warning message
    return null;
  }

  try {
    const socket = io(import.meta.env.VITE_SOCKET_SERVER || "http://localhost:5001", {
      auth: { token }, // 👈 Send the token in the `auth` object
    });

    socket.on("connect", () => {
      console.log("✅ Socket connected", socket.id);
    });

    socket.on("connect_error", (err) => {
      console.error("❌ Socket connection error:", err.message);
    });

    return socket;
  } catch (err) {
    console.error("❌ Failed to create socket:", err);
    return null;
  }
}