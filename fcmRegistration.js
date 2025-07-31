
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
}
