
import { io } from "socket.io-client";

let socket;

export function initSocket() {
  const baseUrl = window.location.origin.replace(/^http/, "ws");
  socket = io(baseUrl, {
    auth: {
      token: localStorage.getItem("accessToken"),
    },
  });
  socket.on("connect", () => {
    console.log("Connected to WebSocket server");
  });
  socket.on("disconnect", () => {
    console.log("Disconnected from WebSocket server");
  });
}

export function getSocket() {
  return socket;
}
