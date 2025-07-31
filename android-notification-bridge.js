
import { LocalNotifications } from '@capacitor/local-notifications';

export async function scheduleReminder(title, body, at) {
  await LocalNotifications.requestPermissions();
  await LocalNotifications.schedule({
    notifications: [{
      title,
      body,
      id: Date.now(),
      // Ensure alarms fire while idle on Android. See note in notificationService.js
      schedule: { at: new Date(at), allowWhileIdle: true },
      sound: "default",
      importance: 5,
    }]
  });
}
