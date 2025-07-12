
self.addEventListener("notificationclick", function(event) {
  event.notification.close();

  const { taskId, snoozeValue, snoozeUnit } = event.notification.data || {};
  if (!event.action || !taskId) return;

  if (event.action === "snooze" && snoozeValue && snoozeUnit) {
    let timeout = 600000; // default 10 min
    const value = parseInt(snoozeValue, 10);
    const units = {
      seconds: 1000,
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000,
      weeks: 7 * 24 * 60 * 60 * 1000,
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
