self.addEventListener("notificationclick", function(event) {
  event.notification.close();
  if (!event.action) return;

  event.waitUntil(
    self.clients.matchAll().then(clients => {
      for (const client of clients) {
        client.postMessage({ action: event.action, taskId: event.notification.tag });
      }
    })
  );
});