/**
 * PWA Client Initialization Script
 * This script should be included in your main HTML file to initialize
 * the PWA features including sync, notifications, and service worker
 */

// Initialize PWA features when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    if ('serviceWorker' in navigator) {
        await initializePWA();
    } else {
        console.warn('Service Worker not supported in this browser');
        // Fallback for browsers without service worker support
        initializeFallbackSync();
    }
});

/**
 * Initialize PWA features
 */
async function initializePWA() {
    try {
        // Register service worker
        const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/'
        });
        
        console.log('Service Worker registered successfully:', registration);
        
        // Initialize sync manager
        const syncManager = new SyncManager();
        window.syncManager = syncManager;
        
        // Set up push notifications
        await setupPushNotifications(registration);
        
        // Set up UI event listeners
        setupUIEventListeners();
        
        // Set up sync event listeners
        setupSyncEventListeners();
        
        // Initialize app state
        await initializeAppState();
        
        console.log('PWA initialization completed successfully');
        
    } catch (error) {
        console.error('PWA initialization failed:', error);
        // Initialize fallback features
        initializeFallbackSync();
    }
}

/**
 * Setup push notifications
 */
async function setupPushNotifications(registration) {
    if (!('PushManager' in window)) {
        console.warn('Push messaging not supported');
        return;
    }
    
    try {
        // Get VAPID public key from server
        const response = await fetch('/api/push-notifications/vapid-public-key');
        if (!response.ok) {
            throw new Error('Failed to get VAPID key');
        }
        
        const data = await response.json();
        if (!data.success || !data.publicKey) {
            throw new Error('Invalid VAPID key response');
        }
        
        // Check current subscription
        let subscription = await registration.pushManager.getSubscription();
        
        if (!subscription) {
            // Ask user for permission
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                // Subscribe to push notifications
                subscription = await registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(data.publicKey)
                });
                
                // Send subscription to server
                await sendSubscriptionToServer(subscription);
                
                console.log('Push notifications enabled successfully');
            } else {
                console.log('Push notification permission denied');
            }
        } else {
            // Update existing subscription
            await sendSubscriptionToServer(subscription);
            console.log('Push notifications already enabled');
        }
        
    } catch (error) {
        console.error('Failed to setup push notifications:', error);
    }
}

/**
 * Send subscription to server
 */
async function sendSubscriptionToServer(subscription) {
    const deviceId = window.syncManager?.deviceId || localStorage.getItem('deviceId');
    
    const response = await fetch('/api/push-notifications/subscribe', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`
        },
        body: JSON.stringify({
            subscription: subscription.toJSON(),
            deviceId
        })
    });
    
    if (!response.ok) {
        throw new Error('Failed to send subscription to server');
    }
    
    return response.json();
}

/**
 * Setup UI event listeners
 */
function setupUIEventListeners() {
    // Sync button
    const syncButton = document.getElementById('sync-button');
    if (syncButton) {
        syncButton.addEventListener('click', async () => {
            if (window.syncManager) {
                syncButton.disabled = true;
                syncButton.textContent = 'Syncing...';
                
                const success = await window.syncManager.forceSync();
                
                syncButton.disabled = false;
                syncButton.textContent = success ? 'Sync Complete' : 'Sync Failed';
                
                setTimeout(() => {
                    syncButton.textContent = 'Sync';
                }, 2000);
            }
        });
    }
    
    // Settings sync preferences
    const syncSettings = document.getElementById('sync-settings-form');
    if (syncSettings) {
        syncSettings.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(syncSettings);
            const settings = {
                autoSync: formData.get('autoSync') === 'on',
                syncInterval: parseInt(formData.get('syncInterval')) || 300000,
                backgroundSync: formData.get('backgroundSync') === 'on'
            };
            
            if (window.syncManager) {
                await window.syncManager.updateDeviceSettings({
                    syncSettings: settings
                });
            }
        });
    }
    
    // Device management
    const deviceList = document.getElementById('device-list');
    if (deviceList) {
        deviceList.addEventListener('click', async (e) => {
            if (e.target.classList.contains('remove-device')) {
                const deviceId = e.target.dataset.deviceId;
                if (confirm('Are you sure you want to remove this device?')) {
                    if (window.syncManager) {
                        await window.syncManager.removeDevice(deviceId);
                        e.target.closest('.device-item').remove();
                    }
                }
            }
        });
    }
}

/**
 * Setup sync event listeners
 */
function setupSyncEventListeners() {
    document.addEventListener('syncManagerEvent', (event) => {
        const { type, data } = event.detail;
        
        switch (type) {
            case 'sync_success':
                updateSyncStatus('success', 'Sync completed successfully');
                updateLastSyncTime(data.timestamp || Date.now());
                break;
                
            case 'sync_error':
                updateSyncStatus('error', `Sync failed: ${data.error}`);
                break;
                
            case 'network_status':
                updateNetworkStatus(data.isOnline);
                break;
                
            case 'device_removed':
                showNotification('Device removed successfully', 'success');
                refreshDeviceList();
                break;
                
            case 'focus_item':
                focusItem(data.itemId);
                break;
                
            case 'reminder_action':
                handleReminderActionUI(data);
                break;
                
            case 'offline_sync_success':
                showNotification('Offline changes synchronized', 'success');
                break;
        }
    });
}

/**
 * Initialize app state
 */
async function initializeAppState() {
    try {
        // Load last sync time
        const lastSync = localStorage.getItem('lastSyncTime');
        if (lastSync) {
            updateLastSyncTime(parseInt(lastSync));
        }
        
        // Load device list
        await refreshDeviceList();
        
        // Load sync status
        if (window.syncManager) {
            const status = await window.syncManager.getSyncStatus();
            if (status) {
                updateDeviceStats(status);
            }
        }
        
        // Check for pending notifications permission
        if (Notification.permission === 'default') {
            showNotificationPermissionPrompt();
        }
        
    } catch (error) {
        console.error('Failed to initialize app state:', error);
    }
}

/**
 * Initialize fallback sync for browsers without service worker
 */
function initializeFallbackSync() {
    console.log('Initializing fallback sync features');
    
    // Basic periodic sync using setInterval
    setInterval(async () => {
        if (navigator.onLine && document.visibilityState === 'visible') {
            try {
                await fetch('/api/sync/trigger', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${getAuthToken()}`
                    },
                    body: JSON.stringify({
                        deviceId: localStorage.getItem('deviceId') || 'fallback'
                    })
                });
                console.log('Fallback sync completed');
            } catch (error) {
                console.error('Fallback sync failed:', error);
            }
        }
    }, 5 * 60 * 1000); // 5 minutes
}

/**
 * Utility functions
 */

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');
    
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function getAuthToken() {
    return localStorage.getItem('authToken') || sessionStorage.getItem('authToken');
}

function updateSyncStatus(status, message) {
    const statusElement = document.getElementById('sync-status');
    if (statusElement) {
        statusElement.className = `sync-status ${status}`;
        statusElement.textContent = message;
    }
}

function updateLastSyncTime(timestamp) {
    const element = document.getElementById('last-sync-time');
    if (element) {
        element.textContent = new Date(timestamp).toLocaleString();
    }
}

function updateNetworkStatus(isOnline) {
    const element = document.getElementById('network-status');
    if (element) {
        element.className = `network-status ${isOnline ? 'online' : 'offline'}`;
        element.textContent = isOnline ? 'Online' : 'Offline';
    }
}

async function refreshDeviceList() {
    const deviceListElement = document.getElementById('device-list');
    if (!deviceListElement || !window.syncManager) return;
    
    try {
        const devices = await window.syncManager.getUserDevices();
        deviceListElement.innerHTML = devices.map(device => `
            <div class="device-item" data-device-id="${device.id}">
                <div class="device-info">
                    <span class="device-icon">${getDeviceIcon(device.type)}</span>
                    <span class="device-name">${device.name}</span>
                    <span class="device-status ${device.isOnline ? 'online' : 'offline'}">
                        ${device.isOnline ? 'Online' : 'Offline'}
                    </span>
                </div>
                <div class="device-actions">
                    <span class="last-active">Last active: ${device.lastActiveFormatted}</span>
                    ${device.id !== window.syncManager.deviceId ? 
                        `<button class="remove-device" data-device-id="${device.id}">Remove</button>` : 
                        '<span class="current-device">Current Device</span>'
                    }
                </div>
            </div>
        `).join('');
    } catch (error) {
        console.error('Failed to refresh device list:', error);
    }
}

function getDeviceIcon(deviceType) {
    const icons = {
        'iOS': '📱',
        'Android': '🤖',
        'macOS': '💻',
        'Windows': '🖥️',
        'Linux': '🐧'
    };
    return icons[deviceType] || '📱';
}

function updateDeviceStats(stats) {
    const elements = {
        totalDevices: document.getElementById('total-devices'),
        activeDevices: document.getElementById('active-devices'),
        syncInProgress: document.getElementById('sync-in-progress')
    };
    
    if (elements.totalDevices) {
        elements.totalDevices.textContent = stats.totalDevices;
    }
    if (elements.activeDevices) {
        elements.activeDevices.textContent = stats.activeDevices;
    }
    if (elements.syncInProgress) {
        elements.syncInProgress.textContent = stats.syncInProgress ? 'Yes' : 'No';
    }
}

function showNotification(message, type = 'info') {
    // Create or update notification element
    let notification = document.getElementById('app-notification');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'app-notification';
        notification.className = 'app-notification';
        document.body.appendChild(notification);
    }
    
    notification.className = `app-notification ${type}`;
    notification.textContent = message;
    notification.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        notification.style.display = 'none';
    }, 5000);
}

function showNotificationPermissionPrompt() {
    const prompt = document.createElement('div');
    prompt.className = 'notification-permission-prompt';
    prompt.innerHTML = `
        <div class="prompt-content">
            <h3>Enable Notifications</h3>
            <p>Get reminded about your tasks and stay synced across devices</p>
            <button id="enable-notifications">Enable</button>
            <button id="maybe-later">Maybe Later</button>
        </div>
    `;
    
    document.body.appendChild(prompt);
    
    document.getElementById('enable-notifications').addEventListener('click', async () => {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            showNotification('Notifications enabled successfully', 'success');
            // Re-setup push notifications
            const registration = await navigator.serviceWorker.getRegistration();
            if (registration) {
                await setupPushNotifications(registration);
            }
        }
        prompt.remove();
    });
    
    document.getElementById('maybe-later').addEventListener('click', () => {
        prompt.remove();
    });
}

function focusItem(itemId) {
    // Focus on specific item in the UI
    const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
    if (itemElement) {
        itemElement.scrollIntoView({ behavior: 'smooth' });
        itemElement.classList.add('focused');
        setTimeout(() => {
            itemElement.classList.remove('focused');
        }, 3000);
    }
}

function handleReminderActionUI(data) {
    const { action, itemId } = data;
    
    // Update UI based on reminder action
    const itemElement = document.querySelector(`[data-item-id="${itemId}"]`);
    if (itemElement) {
        switch (action) {
            case 'done':
                itemElement.classList.add('completed');
                showNotification('Task marked as complete', 'success');
                break;
            case 'snooze':
                itemElement.classList.add('snoozed');
                showNotification('Reminder snoozed', 'info');
                break;
            case 'dismiss':
                // Just show a subtle indication
                showNotification('Reminder dismissed', 'info');
                break;
        }
    }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializePWA,
        setupPushNotifications,
        refreshDeviceList
    };
}