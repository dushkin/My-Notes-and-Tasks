import { getReminders } from "../utils/reminderUtils";

export const createReminderHandlers = () => {
  const handleReminderSet = async (reminderData) => {
    console.log("Socket event: reminder:set - SYNCING AND SCHEDULING", reminderData);
    const reminders = getReminders();
    reminders[reminderData.itemId] = reminderData;
    localStorage.setItem("notes_app_reminders", JSON.stringify(reminders));
    
    // Schedule notification on this device too
    try {
      const { notificationService } = await import('../services/notificationService.js');
      await notificationService.scheduleReminder(reminderData);
      console.log('🔔 Cross-device reminder scheduled via notification service');
    } catch (error) {
      console.error('❌ Failed to schedule cross-device reminder:', error);
    }
    
    window.dispatchEvent(
      new CustomEvent("remindersUpdated", { detail: reminders })
    );
  };

  const handleReminderClear = ({ itemId }) => {
    console.log("Socket event: reminder:clear - SYNCING ONLY", { itemId });
    const reminders = getReminders();
    delete reminders[itemId];
    localStorage.setItem("notes_app_reminders", JSON.stringify(reminders));
    window.dispatchEvent(
      new CustomEvent("remindersUpdated", { detail: reminders })
    );
  };

  const handleReminderUpdate = (reminderData) => {
    console.log("Socket event: reminder:update - SYNCING ONLY", reminderData);
    const reminders = getReminders();
    reminders[reminderData.itemId] = reminderData;
    localStorage.setItem("notes_app_reminders", JSON.stringify(reminders));
    window.dispatchEvent(
      new CustomEvent("remindersUpdated", { detail: reminders })
    );
  };

  const handleReminderTriggered = (reminder) => {
    console.log("Socket event: reminder:trigger - DIRECT TRIGGER", reminder);
    window.dispatchEvent(
      new CustomEvent("reminderTriggered", {
        detail: { ...reminder },
      })
    );
  };

  return {
    handleReminderSet,
    handleReminderClear,
    handleReminderUpdate,
    handleReminderTriggered,
  };
};

export const setupSocketListeners = (socket, handlers) => {
  const {
    handleReminderSet,
    handleReminderClear,
    handleReminderUpdate,
    handleReminderTriggered,
  } = handlers;

  socket.on("connect_error", (error) => {
    console.warn("Socket connection failed:", error.message);
  });

  socket.on("disconnect", (reason) => {
    console.log("Socket disconnected:", reason);
  });

  socket.on("reminder:set", handleReminderSet);
  socket.on("reminder:clear", handleReminderClear);
  socket.on("reminder:update", handleReminderUpdate);
  socket.on("reminder:trigger", handleReminderTriggered);

  return () => {
    socket.off("reminder:set", handleReminderSet);
    socket.off("reminder:clear", handleReminderClear);
    socket.off("reminder:update", handleReminderUpdate);
    socket.off("reminder:trigger", handleReminderTriggered);
    socket.off("connect_error");
    socket.off("disconnect");
  };
};

