import { LocalNotifications } from '@capacitor/local-notifications';
import { Capacitor } from '@capacitor/core';

class NotificationService {
  constructor() {
    this.isInitialized = false;
    this.permissionGranted = false;
    // Track whether we've created our high‑importance reminder channel
    this.reminderChannelCreated = false;
    // Track whether we've created our low‑importance (drawer only) reminder channel
    this.reminderLowChannelCreated = false;
    // Map of itemId to its scheduled notification id. Used to cancel notifications
    // when the app is in the foreground so we can show an in‑app popup instead of a
    // system heads‑up alert.
    this.notificationIdMap = {};
  }

  async initialize() {
    if (this.isInitialized) return;

    try {
      // Request notification permissions
      if (Capacitor.isNativePlatform()) {
        // On native platforms, use Capacitor LocalNotifications
        const permissionStatus = await LocalNotifications.requestPermissions();
        this.permissionGranted = permissionStatus.display === 'granted';
        
        console.log('📱 Native notification permissions:', permissionStatus);
        
        if (this.permissionGranted) {
          // Create a high‑priority channel for reminders on native platforms. This channel
          // ensures heads‑up/peek notifications (pop‑ups) and a sound on Android.
          try {
            if (!this.reminderChannelCreated && Capacitor.isNativePlatform()) {
              await LocalNotifications.createChannel({
                id: 'reminders',
                name: 'Reminders',
                importance: 5,
                description: 'Reminder notifications',
                // Leave sound unset to use the system default notification sound. When a
                // custom sound is specified on Android 26+, it must exist in res/raw.
                sound: null,
                // Set a custom vibration pattern (in milliseconds) for the channel.
                vibrationPattern: [0, 500, 200, 500],
                visibility: 1
              });
              this.reminderChannelCreated = true;
              console.log('🔔 Reminder notification channel created');
            }
            // Also create a low‑importance channel for reminders that should appear only
            // in the notification drawer (no heads‑up) when the app is in the foreground.
            if (!this.reminderLowChannelCreated && Capacitor.isNativePlatform()) {
              await LocalNotifications.createChannel({
                id: 'reminders_low',
                name: 'Reminders (Drawer)',
                importance: 2,
                description: 'Reminder notifications shown silently in the notification drawer',
                sound: null,
                vibrationPattern: [0, 500, 200, 500],
                visibility: 1
              });
              
              // Create a silent channel for when app is visible
              await LocalNotifications.createChannel({
                id: 'reminders_silent',
                name: 'Silent Reminders',
                importance: 1, // IMPORTANCE_MIN - no sound, no heads-up
                description: 'Silent reminder notifications when app is active',
                sound: null,
                vibrationPattern: null,
                visibility: 0, // VISIBILITY_SECRET - won't show on lock screen
                showBadge: false
              });
              
              this.reminderLowChannelCreated = true;
              console.log('🔔 Low‑importance and silent reminder channels created');
            }
          } catch (err) {
            console.warn('⚠️ Failed to create reminder channel:', err);
          }

          // Listen for notification actions
          await LocalNotifications.addListener('localNotificationActionPerformed', (notification) => {
            console.log('📱 Notification action performed:', notification);
            this.handleNotificationAction(notification);
          });

          // Register action types for notifications
          await this.registerActionTypes();

          await LocalNotifications.addListener('localNotificationReceived', (notification) => {
            console.log('📱 Notification received while app active:', notification);
            
            const extra = notification?.extra || notification?.notification?.extra;
            const itemTitle = extra?.originalReminder?.itemTitle || extra?.itemTitle || notification.body?.replace("Don't forget: ", "") || 'Untitled';
            const wasScheduledWhenVisible = extra?.scheduledWhenVisible;
            
            // If this was scheduled when app was visible, it should be a silent notification
            // and we should always show the in-app alert
            if (wasScheduledWhenVisible || document.visibilityState === 'visible') {
              console.log('🔔 Showing in-app reminder alert for:', itemTitle);
              
              // Show native alert dialog
              if (window.Capacitor?.Plugins?.Dialog) {
                try {
                  window.Capacitor.Plugins.Dialog.alert({
                    title: '⏰ Reminder',
                    message: `Don't forget: ${itemTitle}`,
                    buttonTitle: 'OK'
                  }).then(() => {
                    console.log('✅ Capacitor alert shown successfully');
                  }).catch((error) => {
                    console.error('❌ Capacitor alert failed, using browser alert:', error);
                    alert(`⏰ Reminder: Don't forget: ${itemTitle}`);
                  });
                } catch (error) {
                  console.error('❌ Capacitor alert failed, using browser alert:', error);
                  alert(`⏰ Reminder: Don't forget: ${itemTitle}`);
                }
              } else {
                // Fallback to browser alert
                alert(`⏰ Reminder: Don't forget: ${itemTitle}`);
              }
            }
          });
        }
      } else {
        // On web, use standard Web Notifications API
        if ('Notification' in window) {
          const permission = await Notification.requestPermission();
          this.permissionGranted = permission === 'granted';
          console.log('🌐 Web notification permissions:', permission);
        }
      }
      
      this.isInitialized = true;
      console.log('🔔 Notification service initialized, permission granted:', this.permissionGranted);
    } catch (error) {
      console.error('❌ Failed to initialize notification service:', error);
    }
  }

  async scheduleReminder(reminder) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.permissionGranted) {
      console.warn('⚠️ Notification permissions not granted');
      return false;
    }

    const { itemId, timestamp, itemTitle } = reminder;
    const notificationTime = new Date(timestamp);
    const now = new Date();

    if (notificationTime <= now) {
      // Show immediately if time has passed
      return this.showImmediate(reminder);
    }

    try {
      if (Capacitor.isNativePlatform()) {
        // Use Capacitor LocalNotifications for native platforms
        // Generate a safe integer id for the notification. Capacitor/Android
        // silently drops notifications with ids > 2^31-1, so we clamp values.
        let safeId;
        try {
          const numeric = parseInt(String(itemId).replace(/[^0-9]/g, ''));
          if (Number.isFinite(numeric) && numeric > 0 && numeric < 2147483647) {
            safeId = numeric;
          } else {
            safeId = Math.floor(Math.random() * 1000000) + 1;
          }
        } catch {
          safeId = Math.floor(Math.random() * 1000000) + 1;
        }

        // Cancel any existing notification for this item first to avoid duplicates
        await this.cancelNotificationByItem(itemId);
        
        // Store mapping between this item and its notification ID so we can cancel it
        // later if the app is in the foreground when the reminder fires. Without this
        // mapping we wouldn't know which notification ID to cancel on receipt.
        this.notificationIdMap[itemId] = safeId;

        // Check if app is currently visible to determine notification behavior
        const isAppVisible = document.visibilityState === 'visible';
        
        const notifications = [
          {
            title: '⏰ Reminder',
            body: `Don't forget: ${itemTitle || 'Untitled'}`,
            id: safeId,
            // Ensure alarms fire while idle on Android
            schedule: { at: notificationTime, allowWhileIdle: true },
            // Use different channel based on app visibility
            channelId: isAppVisible ? 'reminders_silent' : 'reminders',
            // Lower importance if app is visible (will prevent heads-up notification)
            importance: isAppVisible ? 2 : 5,
            // Disable sound if app is visible
            sound: isAppVisible ? null : null,
            attachments: null,
            actionTypeId: 'REMINDER_ACTION',
            extra: {
              itemId,
              reminderId: `${itemId}-${timestamp}`,
              originalReminder: reminder,
              scheduledWhenVisible: isAppVisible
            }
          }
        ];

        console.log('📱 Scheduling native reminder:', notifications[0]);
        await LocalNotifications.schedule({ notifications });
        console.log('📱 Native reminder scheduled successfully:', notifications[0]);
        return true;
      } else {
        // Use service worker for web notifications
        await this.scheduleServiceWorkerReminder(reminder);
        console.log('🌐 Service worker reminder scheduled');
        return true;
      }
    } catch (error) {
      console.error('❌ Failed to schedule reminder:', error);
      return false;
    }
  }

  async scheduleServiceWorkerReminder(reminder) {
    const { itemId, timestamp, itemTitle } = reminder;
    
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      
      if (registration.active) {
        // Send reminder to service worker for background scheduling
        registration.active.postMessage({
          type: 'SCHEDULE_REMINDER',
          data: {
            itemId,
            timestamp,
            itemTitle: itemTitle || 'Untitled',
            reminderData: {
              reminderVibrationEnabled: true,
              reminderSoundEnabled: true,
              reminderDisplayDoneButton: true, // Default to true for better UX
              originalReminder: reminder
            }
          }
        });
        
        console.log('📨 Reminder sent to service worker:', itemId);
      } else {
        // Fallback to setTimeout if service worker not active
        const delay = timestamp - Date.now();
        setTimeout(() => {
          this.showWebNotification(reminder);
        }, delay);
        console.log('🌐 Fallback: Web reminder scheduled with delay:', delay);
      }
    } else {
      // Final fallback for browsers without service worker support
      const delay = timestamp - Date.now();
      setTimeout(() => {
        this.showWebNotification(reminder);
      }, delay);
      console.log('🌐 Legacy: Web reminder scheduled with delay:', delay);
    }
  }

  async showImmediate(reminder) {
    if (!this.permissionGranted) {
      console.warn('⚠️ Cannot show notification - permissions not granted');
      return false;
    }

    try {
      if (Capacitor.isNativePlatform()) {
        const notifications = [
          {
            title: '⏰ Urgent Reminder',
            body: `Don't forget: ${reminder.itemTitle || 'Untitled'}`,
            id: Date.now(),
            // Provide allowWhileIdle to ensure immediate notifications fire even in Doze mode
            schedule: { at: new Date(Date.now() + 1000), allowWhileIdle: true }, // 1 second from now
            // Use the reminders channel for heads‑up notifications
            channelId: 'reminders',
            importance: 5,
            // Do not override channel sound; use null so the channel's default sound applies
            sound: null,
            actionTypeId: 'REMINDER_ACTION',
            extra: {
              itemId: reminder.itemId,
              reminderId: `${reminder.itemId}-${reminder.timestamp}`,
              originalReminder: reminder
            }
          }
        ];

        await LocalNotifications.schedule({ notifications });
        console.log('📱 Immediate native notification scheduled with allowWhileIdle and high importance');
        return true;
      } else {
        return this.showWebNotification(reminder);
      }
    } catch (error) {
      console.error('❌ Failed to show immediate notification:', error);
      return false;
    }
  }

  showWebNotification(reminder) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      console.warn('⚠️ Web notifications not available');
      return false;
    }

    try {
      // Use service worker notification for action buttons if available
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
          if (registration.active) {
            const options = {
              body: `Don't forget: ${reminder.itemTitle || 'Untitled'}`,
              icon: '/favicon-192x192.png',
              badge: '/favicon-48x48.png',
              tag: `reminder-${reminder.itemId}`,
              requireInteraction: true,
              vibrate: [500, 200, 500],
              actions: [
                {
                  action: 'done',
                  title: '✅ Done',
                  icon: '/favicon-32x32.png'
                },
                {
                  action: 'snooze', 
                  title: '⏰ Snooze 10min',
                  icon: '/favicon-32x32.png'
                },
                {
                  action: 'open',
                  title: '📱 Open App',
                  icon: '/favicon-32x32.png'
                }
              ],
              data: {
                itemId: reminder.itemId,
                reminderId: `${reminder.itemId}-${reminder.timestamp}`,
                originalReminder: reminder
              }
            };

            registration.showNotification('⏰ Reminder', options);
            console.log('🌐 Service worker notification shown with actions');
            return true;
          }
        }).catch(error => {
          console.warn('⚠️ Service worker notification failed, using basic notification:', error);
          this.showBasicWebNotification(reminder);
        });
      } else {
        this.showBasicWebNotification(reminder);
      }

      return true;
    } catch (error) {
      console.error('❌ Failed to show web notification:', error);
      return false;
    }
  }

  showBasicWebNotification(reminder) {
    const notification = new Notification('⏰ Reminder', {
      body: `Don't forget: ${reminder.itemTitle || 'Untitled'}`,
      icon: '/favicon-192x192.png',
      badge: '/favicon-48x48.png',
      tag: `reminder-${reminder.itemId}`,
      requireInteraction: true,
      vibrate: [500, 200, 500],
      data: {
        itemId: reminder.itemId,
        reminderId: `${reminder.itemId}-${reminder.timestamp}`,
        originalReminder: reminder
      }
    });

    notification.onclick = () => {
      window.focus();
      this.handleNotificationClick(reminder);
      notification.close();
    };

    console.log('🌐 Basic web notification shown');
  }

  /**
   * Cancel a previously scheduled native notification by its itemId. This is used
   * when the app is in the foreground and we want to suppress the system
   * heads‑up banner. It looks up the numeric ID stored during scheduling and
   * cancels that notification via the Capacitor LocalNotifications API.
   * If no notification ID is found for the given itemId, this method does nothing.
   *
   * @param {string} itemId The item ID associated with the scheduled notification.
   */
  async cancelNotificationByItem(itemId) {
    if (!Capacitor.isNativePlatform()) return;
    const id = this.notificationIdMap[itemId];
    if (!id) {
      console.warn('⚠️ No scheduled notification ID found for item:', itemId);
      return;
    }
    try {
      await LocalNotifications.cancel({ notifications: [{ id }] });
      console.log('🗑️ Cancelled scheduled notification for item:', itemId, 'id:', id);
      // Clear the mapping after successful cancellation
      delete this.notificationIdMap[itemId];
    } catch (error) {
      console.error('❌ Failed to cancel notification for item:', itemId, error);
    }
  }

  /**
   * Schedule a low‑importance notification immediately for the given reminder. This
   * creates a silent entry in the notification drawer without triggering a
   * heads‑up alert. It is used when the app is in the foreground and we have
   * cancelled the high‑importance notification to avoid duplicates. The extra
   * property skipPopup is set so that the in‑app reminder popup can ignore this
   * notification when it triggers.
   *
   * @param {object} reminder An object containing at least itemId, timestamp, and itemTitle.
   */
  async scheduleDrawerNotification(reminder) {
    if (!this.permissionGranted) {
      console.warn('⚠️ Cannot schedule drawer notification - permissions not granted');
      return false;
    }
    if (!Capacitor.isNativePlatform()) return false;
    try {
      // Generate a unique low‑importance ID by offsetting the original notification ID if available,
      // or just using a random number. We avoid collisions by adding a large offset.
      let baseId = this.notificationIdMap[reminder.itemId];
      if (!baseId) {
        baseId = Math.floor(Math.random() * 1000000) + 1;
      }
      const lowId = baseId + 1000000000;
      const notifications = [
        {
          title: '⏰ Reminder',
          body: `Don't forget: ${reminder.itemTitle || 'Untitled'}`,
          id: lowId,
          schedule: { at: new Date(Date.now() + 100), allowWhileIdle: true },
          channelId: 'reminders_low',
          importance: 2,
          sound: null,
          actionTypeId: 'REMINDER_ACTION',
          extra: {
            itemId: reminder.itemId,
            reminderId: `${reminder.itemId}-${reminder.timestamp}`,
            originalReminder: reminder,
            skipPopup: true
          }
        }
      ];
      console.log('📥 Scheduling low‑importance (drawer) notification:', notifications[0]);
      await LocalNotifications.schedule({ notifications });
      return true;
    } catch (error) {
      console.error('❌ Failed to schedule drawer notification:', error);
      return false;
    }
  }

  async cancelReminder(itemId) {
    try {
      if (Capacitor.isNativePlatform()) {
        // Get all pending notifications and find ones for this item
        const pending = await LocalNotifications.getPending();
        const toCancel = pending.notifications.filter(n => 
          n.extra && n.extra.itemId === itemId
        );
        
        if (toCancel.length > 0) {
          const ids = toCancel.map(n => n.id);
          await LocalNotifications.cancel({ notifications: ids.map(id => ({ id })) });
          console.log('📱 Cancelled native notifications for item:', itemId);
        }
      } else {
        // Cancel service worker reminder
        await this.cancelServiceWorkerReminder(itemId);
      }
      
      console.log('🔔 Reminder cancellation requested for:', itemId);
      return true;
    } catch (error) {
      console.error('❌ Failed to cancel reminder:', error);
      return false;
    }
  }

  async cancelServiceWorkerReminder(itemId) {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      
      if (registration.active) {
        registration.active.postMessage({
          type: 'CANCEL_REMINDER',
          data: { itemId }
        });
        
        console.log('📨 Reminder cancellation sent to service worker:', itemId);
      }
    }
  }

  handleNotificationAction(notification) {
    const data = notification.notification.extra;
    const actionId = notification.actionId;
    
    console.log('📱 Handling notification action:', actionId, data);

    // Dispatch events to the app
    window.dispatchEvent(new CustomEvent('reminderNotificationAction', {
      detail: {
        action: actionId,
        itemId: data.itemId,
        reminderId: data.reminderId,
        originalReminder: data.originalReminder
      }
    }));
  }

  handleNotificationClick(reminder) {
    console.log('🌐 Handling notification click:', reminder);
    
    window.dispatchEvent(new CustomEvent('reminderNotificationAction', {
      detail: {
        action: 'open',
        itemId: reminder.itemId,
        reminderId: `${reminder.itemId}-${reminder.timestamp}`,
        originalReminder: reminder
      }
    }));
  }

  async registerActionTypes() {
    if (!Capacitor.isNativePlatform()) return;

    try {
      await LocalNotifications.registerActionTypes({
        types: [
          {
            id: 'REMINDER_ACTION',
            actions: [
              {
                id: 'done',
                title: '✅ Mark Done'
              },
              {
                id: 'snooze',
                title: '⏰ Snooze...'
              },
              {
                id: 'open',
                title: '📱 Open App'
              }
            ]
          }
        ]
      });
      console.log('📱 Notification action types registered');
    } catch (error) {
      console.error('❌ Failed to register action types:', error);
    }
  }

  async checkPermissions() {
    if (Capacitor.isNativePlatform()) {
      const status = await LocalNotifications.checkPermissions();
      return status.display === 'granted';
    } else {
      return Notification.permission === 'granted';
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
export default notificationService;