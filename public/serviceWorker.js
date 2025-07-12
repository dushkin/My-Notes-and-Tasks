
self.addEventListener("notificationclick", function(event) {
  if (event.action === "vi") {
    event.notification.close();
  } else {
    // Optional: focus tab or handle other actions
  }
});
