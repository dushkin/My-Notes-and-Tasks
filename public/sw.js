// public/sw.js

self.addEventListener('push', event => {
    const data = event.data.json();
    const { title, options } = data;

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    const { url, taskId } = event.notification.data;

    if (event.action === 'snooze') {
        // Here you would ideally send a request to your backend to update the reminder time
        console.log(`Snooze action for task: ${taskId}`);
    } else if (event.action === 'complete') {
        // Here you would ideally send a request to your backend to mark the task as complete
        console.log(`Complete action for task: ${taskId}`);
    } else {
        // Default action: open the app and navigate to the item
        event.waitUntil(
            clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
                const matchingClient = windowClients.find(client => {
                    const clientUrl = new URL(client.url);
                    return clientUrl.pathname === '/app';
                });

                if (matchingClient) {
                    matchingClient.navigate(url);
                    return matchingClient.focus();
                } else {
                    return clients.openWindow(url);
                }
            })
        );
    }
});