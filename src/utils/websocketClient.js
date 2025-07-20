import { io } from "socket.io-client";

export function connectLiveUpdates(userId) {
  const socket = io(import.meta.env.VITE_SOCKET_SERVER || "http://localhost:5001", {
    auth: { userId: currentUser?._id || currentUser?.id }auth: { userId }
  });

  socket.on("connect", () => {
    console.log("🟢 Connected to socket server");
  });

  socket.on("disconnect", () => {
    console.log("🔴 Disconnected from socket server");
  });

  return socket;
}
