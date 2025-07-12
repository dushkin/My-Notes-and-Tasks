self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  event.preventDefault();

  const { taskId, snoozeValue, snoozeUnit } = event.notification.data || {};
  if (!event.action || !taskId) return;

  if (event.action === "vi" && taskId) {
    fetch(`/api/tasks/${taskId}/complete`, { method: "PATCH" }).then(() => {
      self.clients.matchAll().then(clients => {
        for (const client of clients) {
          client.postMessage({ action: "task-completed", taskId });
        }
      });
    });
  } else if (event.action === "snooze" && snoozeValue && snoozeUnit) {
    let timeout = 600000;
    const value = parseInt(snoozeValue, 10);
    const units = {
      seconds: 1000,
      minutes: 60 * 1000,
      hours: 3600000,
      days: 86400000,
      weeks: 604800000
    };
    timeout = value * (units[snoozeUnit] || 60000);

    setTimeout(() => {
      registration.showNotification("My Notes & Tasks", {
        body: "Reminder: " + taskId,
        tag: taskId,
        data: { taskId, snoozeValue, snoozeUnit }
      });
    }, timeout);
  } else {
    event.waitUntil(
      self.clients.matchAll().then(clients => {
        for (const client of clients) {
          client.postMessage({ action: event.action, taskId });
        }
      })
    );
  }
});