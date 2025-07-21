
import { useEffect } from "react";
import { getSocket } from "../services/socketClient";
import { useTree } from "../hooks/useTree"; // Adjust based on your actual context/store

export function useSocketEvents(currentUser) {
  const { fetchUserTree } = useTree(currentUser);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on("task_updated", (task) => {
      console.log("🔄 Task update received:", task);
      fetchUserTree(true);
    });

    socket.on("item_updated", (item) => {
      fetchUserTree(true);
    });

    socket.on("reminder_set", (reminder) => {
      fetchUserTree(true);
    });

    return () => {
      socket.off("task_updated");
      socket.off("item_updated");
      socket.off("reminder_set");
    };
  }, []);
}
