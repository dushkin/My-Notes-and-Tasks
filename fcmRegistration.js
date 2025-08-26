
import { PushNotifications } from '@capacitor/push-notifications';

export async function registerForPushNotifications(userId) {
  const perm = await PushNotifications.requestPermissions();
  if (perm.receive !== 'granted') return;

  await PushNotifications.register();

  PushNotifications.addListener('registration', (token) => {
    console.log('📱 FCM Token:', token.value);
    fetch('/api/fcm/update-fcm-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, token: token.value }),
    });
  });

  PushNotifications.addListener('registrationError', (err) => {
    console.error('FCM Registration Error:', err);
  });

  // Handle incoming push notifications when app is in foreground
  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('📱 Push notification received:', notification);
    
    // If it's a reminder notification, handle it specially
    if (notification.data?.type === 'reminder') {
      // Dispatch event to reminder monitor
      window.dispatchEvent(new CustomEvent('reminderTriggered', {
        detail: {
          itemId: notification.data.itemId,
          itemTitle: notification.title || notification.body,
          notificationData: {
            reminderVibrationEnabled: true,
            reminderSoundEnabled: true,
            reminderDisplayDoneButton: true,
            itemId: notification.data.itemId,
            reminderId: notification.data.reminderId,
            originalReminder: notification.data
          },
          triggeredByPush: true
        }
      }));
    }
  });

  // Handle notification actions when app is in background
  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('📱 Push notification action performed:', action);
    
    const data = action.notification.data;
    if (data?.type === 'reminder') {
      // Handle the action
      window.dispatchEvent(new CustomEvent('reminderNotificationAction', {
        detail: {
          action: action.actionId,
          itemId: data.itemId,
          reminderId: data.reminderId,
          originalReminder: data
        }
      }));
    }
  });
}
