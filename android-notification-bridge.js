
import { LocalNotifications } from '@capacitor/local-notifications';

export async function initializeNotificationActions() {
  // Register action types for reminder notifications
  try {
    await LocalNotifications.registerActionTypes({
      types: [
        {
          id: 'REMINDER_ACTION',
          actions: [
            {
              id: 'done',
              title: '✅ Done'
            },
            {
              id: 'snooze',
              title: '⏰ Snooze 10min'
            },
            {
              id: 'open',
              title: '📱 Open App'
            }
          ]
        }
      ]
    });
    console.log('📱 Android notification action types registered');
  } catch (error) {
    console.error('❌ Failed to register notification action types:', error);
  }
}

export async function scheduleReminder(title, body, at, itemId = null, reminderId = null) {
  await LocalNotifications.requestPermissions();
  
  // Initialize action types before scheduling
  await initializeNotificationActions();
  
  await LocalNotifications.schedule({
    notifications: [{
      title,
      body,
      id: Date.now(),
      // Ensure alarms fire while idle on Android. See note in notificationService.js
      schedule: { at: new Date(at), allowWhileIdle: true },
      sound: "default",
      importance: 5,
      channelId: 'reminders',
      actionTypeId: 'REMINDER_ACTION',
      extra: {
        itemId: itemId,
        reminderId: reminderId,
        type: 'reminder'
      }
    }]
  });
}
