
import { scheduleReminder } from './android-notification-bridge';

export async function scheduleReminderForTask(task) {
  if (!task || !task.reminder || task.reminder.disabled) return;

  const ts = new Date(task.reminder.timestamp).getTime();
  if (isNaN(ts) || ts < Date.now()) return;

  try {
    // Pass allowWhileIdle via the bridge by passing the timestamp directly. The bridge now sets
    // allowWhileIdle: true internally. See android-notification-bridge.js
    await scheduleReminder("🔔 Reminder", task.title || "Check your task", ts);
    console.log("✅ Local reminder scheduled for task:", task._id);
  } catch (err) {
    console.error("❌ Failed to schedule local reminder:", err);
  }
}
