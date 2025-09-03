// clientInit.js - Client-side initialization and setup

import { authFetch } from '../services/apiClient';

(function () {
  'use strict';

  // ---------- Environment detection ----------
  const capacitorPlatform = window?.Capacitor?.isNativePlatform?.();
  const capacitorNative = window?.Capacitor?.isNative;
  const userAgentMatch = /\bCapacitor(WebView)?\b/.test(navigator.userAgent);
  
  
  const isNative =
    !!capacitorPlatform ||
    !!capacitorNative ||
    userAgentMatch;

  const swSupported =
    typeof navigator !== 'undefined' && !!navigator.serviceWorker;

  // ---------- Global app state ----------
  window.MyNotesApp = {
    syncManager: null,
    notificationManager: null,
    isInitialized: false,
    swRegistration: undefined,
    config: {
      apiBaseUrl: '/api',
      syncInterval: 30000,
      maxRetries: 3,
      retryDelay: 1000
    }
  };

  // ---------- Bootstrap ----------
  async function initializeApp() {
    try {
      console.log('🚀 Initializing My Notes & Tasks App...', {
        isNative,
        swSupported
      });

      // Check if we're in a supported environment
      if (!checkBrowserSupport()) {
        throw new Error('Browser not supported');
      }

      // Initialize core services
      await initializeServices();

      // Setup event listeners
      setupEventListeners();

      // Initialize UI components
      initializeUI();

      // Register service worker (skip on native or when unsupported)
      await registerServiceWorker();

      // Setup push notifications (skips on native automatically)
      await initializePushNotifications();

      // Load initial data
      await loadInitialData();

      // Mark as initialized
      window.MyNotesApp.isInitialized = true;

      console.log('✅ App initialized successfully');

      // Dispatch initialization complete event
      window.dispatchEvent(new CustomEvent('appInitialized'));
    } catch (error) {
      console.error('❌ Failed to initialize app:', error);
      showErrorMessage('Failed to initialize the application. Please refresh the page.');
    }
  }

  // ---------- Support checks ----------
  function checkBrowserSupport() {
    // Service Worker is required only for web, not for native/Capacitor
    const requiredFeaturesWeb = ['localStorage', 'indexedDB', 'fetch', 'Promise'];
    const requiredFeaturesNative = ['localStorage', 'indexedDB', 'fetch', 'Promise'];

    const required = isNative ? requiredFeaturesNative : requiredFeaturesWeb;

    for (const feature of required) {
      if (!isSupported(feature)) {
        console.error(`❌ Feature not supported: ${feature}`);
        return false;
      }
    }

    // On web, we do a soft check for SW (not hard-fail)
    if (!isNative && !swSupported) {
      console.warn('⚠️ Service Worker not supported in this browser; continuing without it.');
    }

    return true;
  }

  function isSupported(feature) {
    switch (feature) {
      case 'localStorage':
        return typeof Storage !== 'undefined';
      case 'indexedDB':
        return 'indexedDB' in window;
      case 'fetch':
        return 'fetch' in window;
      case 'Promise':
        return 'Promise' in window;
      default:
        return false;
    }
  }

  // ---------- Core services ----------
  async function initializeServices() {
    console.log('📡 Initializing services...');

    // Initialize SyncManager
    if (typeof SyncManager !== 'undefined') {
      window.MyNotesApp.syncManager = new SyncManager();
      console.log('✅ SyncManager initialized');
    } else {
      console.warn('⚠️ SyncManager not available');
    }

    // Initialize NotificationManager
    window.MyNotesApp.notificationManager = new NotificationManager();
    console.log('✅ NotificationManager initialized');

    // Initialize IndexedDB
    await initializeIndexedDB();
    console.log('✅ IndexedDB initialized');
  }

  async function initializeIndexedDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('MyNotesDB', 1);

      request.onerror = () => {
        console.error('Failed to open IndexedDB');
        reject(request.error);
      };

      request.onsuccess = () => {
        window.MyNotesApp.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Create notes store
        if (!db.objectStoreNames.contains('notes')) {
          const notesStore = db.createObjectStore('notes', { keyPath: 'id' });
          notesStore.createIndex('createdAt', 'createdAt', { unique: false });
          notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          notesStore.createIndex('category', 'category', { unique: false });
        }

        // Create tasks store
        if (!db.objectStoreNames.contains('tasks')) {
          const tasksStore = db.createObjectStore('tasks', { keyPath: 'id' });
          tasksStore.createIndex('completed', 'completed', { unique: false });
          tasksStore.createIndex('priority', 'priority', { unique: false });
          tasksStore.createIndex('dueDate', 'dueDate', { unique: false });
        }

        // Create sync queue store
        if (!db.objectStoreNames.contains('syncQueue')) {
          db.createObjectStore('syncQueue', { keyPath: 'id' });
        }
      };
    });
  }

  // ---------- Global listeners ----------
  function setupEventListeners() {
    console.log('👂 Setting up event listeners...');

    // App lifecycle events
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('blur', handleWindowBlur);

    // Network status events
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Keyboard shortcuts
    document.addEventListener('keydown', handleKeyboardShortcuts);

    // Touch events for mobile
    if ('ontouchstart' in window) {
      setupTouchEvents();
    }

    // Custom app events
    window.addEventListener('syncNotification', handleSyncNotification);
    window.addEventListener('conflictResolution', handleConflictResolution);

    // Service worker message handlers
    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        const { type, data } = event.data || {};
        console.log('🔄 Received SW message:', type, data);
        
        switch (type) {
          case 'SW_ACTIVATED':
            console.log('🔄 Service worker activated, reloading page...');
            window.location.reload();
            break;
          case 'FORCE_RELOAD':
            console.log('🔄 Service worker requested force reload...');
            window.location.reload();
            break;
          default:
            console.log('🔄 Unknown SW message type:', type);
        }
      });
      
      console.log('✅ Service worker message handlers set up');
    }

    console.log('✅ Event listeners set up');
  }

  // ---------- UI ----------
  function initializeUI() {
    console.log('🎨 Initializing UI...');

    // Set up theme
    initializeTheme();

    // Initialize tooltips
    initializeTooltips();

    // Setup form validation
    setupFormValidation();

    // Initialize modals
    initializeModals();

    // Setup search functionality
    initializeSearch();

    // Initialize drag and drop
    if (checkDragDropSupport()) {
      initializeDragDrop();
    }

    console.log('✅ UI initialized');
  }

  function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Update theme toggle if it exists
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
      themeToggle.checked = savedTheme === 'dark';
      themeToggle.addEventListener('change', (e) => {
        const newTheme = e.target.checked ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
      });
    }
  }

  // ---------- Service Worker (web only) ----------
  async function registerServiceWorker() {
    // Skip on native or if unsupported
    if (isNative || !swSupported) {
      console.log('📱 Skipping Service Worker (native/unsupported environment)');
      return;
    }

    try {
      // Check if service worker is already registered
      const existingRegistration = await navigator.serviceWorker.getRegistration();
      
      if (existingRegistration) {
        console.log('✅ Service Worker already registered, checking for updates...');
        console.log('🔄 Registration state:', {
          hasActive: !!existingRegistration.active,
          hasWaiting: !!existingRegistration.waiting,
          hasInstalling: !!existingRegistration.installing,
          activeState: existingRegistration.active?.state,
          waitingState: existingRegistration.waiting?.state,
          installingState: existingRegistration.installing?.state,
          scope: existingRegistration.scope
        });
        window.MyNotesApp.swRegistration = existingRegistration;
        
        // Check for waiting worker with detailed logging
        console.log('🔄 Detailed waiting worker analysis:', {
          hasWaiting: !!existingRegistration.waiting,
          hasActive: !!existingRegistration.active,
          waitingUrl: existingRegistration.waiting?.scriptURL,
          activeUrl: existingRegistration.active?.scriptURL,
          sameWorker: existingRegistration.waiting === existingRegistration.active,
          waitingDifferent: existingRegistration.waiting && existingRegistration.active && 
                           existingRegistration.waiting !== existingRegistration.active
        });

        // Only show update notification if there's actually a different waiting worker
        if (existingRegistration.waiting && existingRegistration.active && 
            existingRegistration.waiting !== existingRegistration.active) {
          
          // Additional check - compare script URLs to ensure they're actually different
          const waitingUrl = existingRegistration.waiting.scriptURL;
          const activeUrl = existingRegistration.active.scriptURL;
          console.log('🔄 Comparing script URLs:', { waitingUrl, activeUrl });
          
          if (waitingUrl === activeUrl) {
            console.log('🔄 Script URLs are identical, likely a false positive - skipping notification');
            return;
          }
          
          // Extract version parameters from URLs to compare
          const waitingVersion = new URL(waitingUrl).searchParams.get('v');
          const activeVersion = new URL(activeUrl).searchParams.get('v');
          console.log('🔄 Comparing versions:', { waitingVersion, activeVersion });
          
          if (waitingVersion === activeVersion) {
            console.log('🔄 Versions are identical, skipping notification');
            return;
          }
          
          console.log('🔄 SW update is ready (waiting worker found with different script)');
          
          // Add a small delay to avoid showing notification on fresh page loads
          setTimeout(() => {
            // Triple-check the waiting worker is still there and different
            if (existingRegistration.waiting && 
                existingRegistration.active &&
                existingRegistration.waiting !== existingRegistration.active &&
                existingRegistration.waiting.scriptURL !== existingRegistration.active.scriptURL) {
              console.log('🔄 Confirmed legitimate update available, showing notification');
              showUpdateAvailableNotification();
            } else {
              console.log('🔄 Update check failed validation, skipping notification');
            }
          }, 2000); // Increased delay to 2 seconds
        } else if (existingRegistration.waiting) {
          console.log('🔄 Waiting worker exists but conditions not met for notification:', {
            noActive: !existingRegistration.active,
            sameAsActive: existingRegistration.waiting === existingRegistration.active
          });
        } else {
          // Listen for future updates only
          existingRegistration.addEventListener('updatefound', () => {
            const newWorker = existingRegistration.installing;
            console.log('🔄 SW update found, checking state changes...');
            
            // Check if this is a legitimate update (there's already a controller)
            const hasExistingController = !!navigator.serviceWorker?.controller;
            console.log('🔄 Update context:', {
              hasExistingController,
              controllerState: navigator.serviceWorker?.controller?.state,
              newWorkerScript: newWorker?.scriptURL
            });
            
            newWorker?.addEventListener('statechange', () => {
              console.log('🔄 SW state changed to:', newWorker.state);
              
              // Only show update notification if:
              // 1. New worker is installed
              // 2. There's an existing controller (not first install)
              // 3. The new worker is different from the current controller
              if (newWorker.state === 'installed' && 
                  navigator.serviceWorker?.controller &&
                  newWorker.scriptURL !== navigator.serviceWorker.controller.scriptURL) {
                
                console.log('🔄 Legitimate SW update detected:', {
                  newWorkerUrl: newWorker.scriptURL,
                  controllerUrl: navigator.serviceWorker.controller.scriptURL
                });
                
                // Additional delay to ensure this isn't a race condition
                setTimeout(() => {
                  if (existingRegistration.waiting && navigator.serviceWorker?.controller) {
                    console.log('🔄 Confirmed SW update is ready to install');
                    showUpdateAvailableNotification();
                  } else {
                    console.log('🔄 SW update validation failed, skipping notification');
                  }
                }, 1500);
              } else {
                console.log('🔄 SW state change does not warrant update notification:', {
                  state: newWorker.state,
                  hasController: !!navigator.serviceWorker?.controller,
                  sameScript: newWorker.scriptURL === navigator.serviceWorker?.controller?.scriptURL
                });
              }
            });
          });
        }
      } else {
        // First time registration
        const verParam = (window.APP_VERSION || new Date().toISOString().slice(0, 10));
        const registration = await navigator.serviceWorker.register(`/sw.js?v=${verParam}`, {
          updateViaCache: 'none'
        });
        window.MyNotesApp.swRegistration = registration;
        console.log('✅ Service Worker registered for first time:', registration);

        // Listen for updates on new registration (but be more selective)
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          console.log('🔄 SW update found on new registration');
          
          newWorker?.addEventListener('statechange', () => {
            console.log('🔄 SW state changed to:', newWorker.state);
            
            // For new registrations, only show update if there's already a controller
            // This prevents showing updates during the initial SW installation
            if (newWorker.state === 'installed' && 
                navigator.serviceWorker?.controller &&
                newWorker !== navigator.serviceWorker.controller) {
              console.log('🔄 SW update is ready to install (new registration)');
              showUpdateAvailableNotification();
            } else {
              console.log('🔄 SW installed but no update notification needed (likely first install):', {
                hasController: !!navigator.serviceWorker?.controller,
                isNewWorker: newWorker !== navigator.serviceWorker?.controller
              });
            }
          });
        });
      }
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }
  }

  // ---------- Push Notifications (web only) ----------
  async function initializePushNotifications() {
    if (isNative) return; // native/Capacitor: use platform channels instead

    if (!('Notification' in window)) {
      console.warn('⚠️ Notifications not supported');
      return;
    }
    if (!('PushManager' in window)) {
      console.warn('⚠️ Push messaging not supported');
      return;
    }

    // Just request notification permission during init, but don't subscribe yet
    try {
      const permission = await Notification.requestPermission();
      console.log('🌐 Web notification permissions:', permission);
      console.log('🔔 Notification service initialized, permission granted:', permission === 'granted');
      
      // Store permission status for later use
      window.MyNotesApp.notificationPermission = permission;
    } catch (error) {
      console.error('❌ Failed to request notification permission:', error);
    }
  }

  // ---------- Initial data ----------
  async function loadInitialData() {
    console.log('📊 Loading initial data...');

    try {
      // Load user preferences
      loadUserPreferences();

      // Load offline data first
      await loadOfflineData();

      // If online, sync with server
      if (navigator.onLine && window.MyNotesApp.syncManager) {
        await window.MyNotesApp.syncManager.forceSyncAll();
      }

      console.log('✅ Initial data loaded');
    } catch (error) {
      console.error('❌ Failed to load initial data:', error);
    }
  }

  // ---------- Event handlers ----------
  function handleBeforeUnload() {
    savePendingChanges();
    return undefined;
  }

  function handleWindowFocus() {
    if (window.MyNotesApp.syncManager) {
      window.MyNotesApp.syncManager.processSyncQueue();
    }
  }

  function handleWindowBlur() {
    savePendingChanges();
  }

  function handleOnline() {
    console.log('🌐 Back online');
    showNotification('Back online - syncing data...', 'success');

    if (window.MyNotesApp.syncManager) {
      window.MyNotesApp.syncManager.processSyncQueue();
    }
  }

  function handleOffline() {
    console.log('📴 Gone offline');
    showNotification('Working offline - changes will sync when connection returns', 'info');
  }

  function handleKeyboardShortcuts(event) {
    // Ctrl/Cmd + N: New note
    if ((event.ctrlKey || event.metaKey) && event.key === 'n') {
      event.preventDefault();
      createNewNote();
    }

    // Ctrl/Cmd + S: Save
    if ((event.ctrlKey || event.metaKey) && event.key === 's') {
      event.preventDefault();
      saveCurrentItem();
    }

    // Ctrl/Cmd + F: Search
    if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
      event.preventDefault();
      focusSearch();
    }
  }

  function handleSyncNotification(event) {
    showNotification(event.detail.message, 'info');
  }

  function handleConflictResolution(event) {
    showConflictResolutionDialog(event.detail.conflict, event.detail.resolve);
  }

  // ---------- UI helpers ----------
  function showErrorMessage(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff4444;
      color: white;
      padding: 15px;
      border-radius: 5px;
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;

    document.body.appendChild(errorDiv);

    setTimeout(() => {
      if (errorDiv.parentNode) {
        errorDiv.parentNode.removeChild(errorDiv);
      }
    }, 8000);
  }

  function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    const colors = {
      success: '#4CAF50',
      error: '#f44336',
      warning: '#ff9800',
      info: '#2196F3'
    };

    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${colors[type] || colors.info};
      color: white;
      padding: 12px 16px;
      border-radius: 4px;
      z-index: 99999;
      max-width: 300px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      animation: slideIn 0.3s ease-out;
      pointer-events: none;
      user-select: none;
    `;

    document.body.appendChild(notification);

    const remove = () => {
      if (notification.parentNode) {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
          if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
          }
        }, 300);
      }
    };

    const timeoutId = setTimeout(remove, 3000);

    // Allow manual dismiss
    notification.style.pointerEvents = 'auto';
    notification.style.cursor = 'pointer';
    notification.addEventListener('click', () => {
      clearTimeout(timeoutId);
      remove();
    });
  }

  function showUpdateAvailableNotification() {

    // Check if notification already exists to prevent duplicates
    const existingNotification = document.querySelector('.update-notification');
    if (existingNotification) {
      console.log('🔄 Update notification already showing, skipping duplicate');
      return;
    }

    // Check if we recently dismissed an update notification (within last 5 minutes)
    const lastDismissed = localStorage.getItem('update_notification_dismissed');
    if (lastDismissed) {
      const dismissTime = parseInt(lastDismissed);
      const now = Date.now();
      const fiveMinutesAgo = now - (5 * 60 * 1000);
      
      if (dismissTime > fiveMinutesAgo) {
        console.log('🔄 Update notification was recently dismissed, skipping for now');
        return;
      } else {
        // Clear old timestamp
        localStorage.removeItem('update_notification_dismissed');
      }
    }

    console.log('🔄 Showing update notification');
    
    const updateDiv = document.createElement('div');
    updateDiv.className = 'update-notification';
    updateDiv.innerHTML = `
    <div style="
      position: fixed;
      bottom: 20px;
      left: 20px;
      background: #2196F3;
      color: white;
      padding: 16px;
      border-radius: 8px;
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      animation: slideUp 0.3s ease-out;
    ">
      <div style="margin-bottom: 12px; font-weight: 500;">📱 App Update Available</div>
      <div style="margin-bottom: 12px; font-size: 14px; opacity: 0.9;">
        A new version is ready to install. Update now for the latest features and improvements.
      </div>
      <div style="display: flex; gap: 8px;">
        <button id="update-now-btn" style="
          background: white;
          color: #2196F3;
          border: none;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 500;
          flex: 1;
        ">Update Now</button>
        <button id="update-later-btn" style="
          background: transparent;
          color: white;
          border: 1px solid white;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
        ">Later</button>
      </div>
    </div>
  `;

    // Add slide animation styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideUp {
        from { transform: translateY(100%); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    document.body.appendChild(updateDiv);

    const updateNowBtn = updateDiv.querySelector('#update-now-btn');
    const updateLaterBtn = updateDiv.querySelector('#update-later-btn');

    updateNowBtn.addEventListener('click', async () => {
      console.log('🔄 Update Now clicked - triggering service worker update...');
      updateNowBtn.textContent = 'Updating...';
      updateNowBtn.disabled = true;

      try {
        const registration =
          window.MyNotesApp.swRegistration ||
          (swSupported ? await navigator.serviceWorker.getRegistration() : undefined);

        console.log('🔄 Registration state:', {
          hasRegistration: !!registration,
          hasWaiting: !!registration?.waiting,
          hasInstalling: !!registration?.installing,
          hasActive: !!registration?.active,
          controllerState: navigator.serviceWorker?.controller?.state
        });

        if (registration) {
          // First try to handle waiting service worker
          if (registration.waiting) {
            console.log('🔄 Found waiting service worker, sending SKIP_WAITING message...');
            
            // Set up controller change listener BEFORE sending message
            const controllerChangePromise = new Promise((resolve) => {
              if (navigator.serviceWorker) {
                const handleControllerChange = () => {
                  console.log('🔄 Controller changed, reloading page...');
                  navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
                  resolve();
                };
                navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange, { once: true });
                
                // Timeout for controller change
                setTimeout(() => {
                  navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
                  resolve();
                }, 2000);
              } else {
                resolve();
              }
            });

            // Send the skip waiting message
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            
            // Wait for controller change or timeout
            await controllerChangePromise;
          } 
          // Handle installing service worker (update is in progress)
          else if (registration.installing) {
            console.log('🔄 Service worker is installing, waiting for it to become waiting...');
            
            const installPromise = new Promise((resolve) => {
              const handleStateChange = () => {
                console.log('🔄 Installing worker state changed to:', registration.installing.state);
                if (registration.installing.state === 'installed') {
                  registration.installing.removeEventListener('statechange', handleStateChange);
                  resolve();
                } else if (registration.installing.state === 'redundant') {
                  registration.installing.removeEventListener('statechange', handleStateChange);
                  resolve();
                }
              };
              registration.installing.addEventListener('statechange', handleStateChange);
              
              // Timeout
              setTimeout(() => {
                if (registration.installing) {
                  registration.installing.removeEventListener('statechange', handleStateChange);
                }
                resolve();
              }, 3000);
            });
            
            await installPromise;
            
            // Now try again with waiting worker
            if (registration.waiting) {
              console.log('🔄 Now found waiting service worker after install, sending SKIP_WAITING...');
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            }
          }
          // Force update check if no waiting/installing worker
          else {
            console.log('🔄 No waiting or installing worker, forcing update check...');
            await registration.update();
            
            // Wait a bit for update to complete
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Check again for waiting worker
            if (registration.waiting) {
              console.log('🔄 Found waiting worker after update, sending SKIP_WAITING...');
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            } else {
              console.log('🔄 Still no waiting worker after update, forcing reload...');
            }
          }
          
          // Final timeout fallback
          setTimeout(() => {
            console.log('🔄 Update timeout reached, forcing reload...');
            window.location.reload();
          }, 5000);
          
        } else {
          console.log('🔄 No service worker registration found, forcing page reload...');
          window.location.reload();
        }
      } catch (error) {
        console.error('❌ Error during update:', error);
        console.log('🔄 Falling back to page reload due to error...');
        window.location.reload();
      }
    });

    updateLaterBtn.addEventListener('click', () => {
      console.log('🔄 Update dismissed by user');
      
      // Record the dismissal time to prevent showing again too soon
      localStorage.setItem('update_notification_dismissed', Date.now().toString());
      
      updateDiv.remove();
      if (style.parentNode) {
        style.remove();
      }
    });

    // Auto-dismiss after 30 seconds to avoid permanent clutter
    setTimeout(() => {
      if (updateDiv.parentNode) {
        console.log('🔄 Auto-dismissing update notification after 30 seconds');
        updateDiv.remove();
        if (style.parentNode) {
          style.remove();
        }
      }
    }, 30000);
  }

  // ---------- App-specific utils ----------
  function createNewNote() {
    const event = new CustomEvent('createNewNote');
    window.dispatchEvent(event);
  }

  function saveCurrentItem() {
    const event = new CustomEvent('savePendingChanges');
    window.dispatchEvent(event);
  }

  function focusSearch() {
    const searchInput = document.querySelector('#search-input, .search-input, [data-search]');
    if (searchInput) {
      searchInput.focus();
    }
  }

  function savePendingChanges() {
    const event = new CustomEvent('savePendingChanges');
    window.dispatchEvent(event);
  }

  function loadUserPreferences() {
    const preferences = JSON.parse(localStorage.getItem('userPreferences') || '{}');

    if (preferences.fontSize) {
      document.documentElement.style.fontSize = preferences.fontSize;
    }

    if (preferences.compactMode) {
      document.body.classList.toggle('compact-mode', preferences.compactMode);
    }

    if (preferences.autoSave !== undefined) {
      window.MyNotesApp.config.autoSave = preferences.autoSave;
    }
  }

  async function loadOfflineData() {
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');

    window.dispatchEvent(new CustomEvent('notesLoaded', { detail: notes }));
    window.dispatchEvent(new CustomEvent('tasksLoaded', { detail: tasks }));

    if (window.MyNotesApp.db) {
      try {
        const dbNotes = await getFromIndexedDB('notes');
        const dbTasks = await getFromIndexedDB('tasks');

        if (dbNotes.length > 0) {
          localStorage.setItem('notes', JSON.stringify(dbNotes));
          window.dispatchEvent(new CustomEvent('notesLoaded', { detail: dbNotes }));
        }

        if (dbTasks.length > 0) {
          localStorage.setItem('tasks', JSON.stringify(dbTasks));
          window.dispatchEvent(new CustomEvent('tasksLoaded', { detail: dbTasks }));
        }
      } catch (error) {
        console.error('Failed to load from IndexedDB:', error);
      }
    }
  }

  function getFromIndexedDB(storeName) {
    return new Promise((resolve, reject) => {
      const transaction = window.MyNotesApp.db.transaction([storeName], 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function getVapidKey() {
    try {
      const endpointURL = '/push/vapid-public-key';
      console.log('🔑 Fetching VAPID key from:', endpointURL);

      const data = await authFetch(endpointURL);

      console.log('🔑 VAPID parsed data:', data);
      return data.publicKey;
    } catch (error) {
      console.error('Failed to get VAPID key:', error);
      return null;
    }
  }

  async function sendSubscriptionToServer(subscription) {
    try {
      const subscriptionData = subscription.toJSON();
      console.log('📤 Sending subscription to server:', {
        endpoint: subscriptionData.endpoint?.substring(0, 50) + '...',
        hasKeys: !!subscriptionData.keys,
        hasP256dh: !!subscriptionData.keys?.p256dh,
        hasAuth: !!subscriptionData.keys?.auth
      });
      
      await authFetch('/push/subscribe', {
        method: 'POST',
        body: subscriptionData  // Send object directly, authFetch will JSON.stringify it
      });
      console.log('✅ Push subscription sent to server successfully');
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
    }
  }

  // Function to be called after user authentication
  async function subscribeToAuthenticatedPushNotifications() {
    if (isNative) return; // native/Capacitor: use platform channels instead

    if (!window.MyNotesApp.swRegistration) {
      console.warn('⚠️ No SW registration available for push; skipping');
      return;
    }

    if (window.MyNotesApp.notificationPermission !== 'granted') {
      console.warn('⚠️ Notification permission not granted; skipping push subscription');
      return;
    }

    try {
      // Wait for service worker to be ready
      const registration = await navigator.serviceWorker.ready;

      // Check if already subscribed
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('✅ Push subscription already exists');
        return;
      }

      // Subscribe to push notifications
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: await getVapidKey()
      });

      console.log('✅ Push subscription created');
      await sendSubscriptionToServer(subscription);
    } catch (error) {
      console.error('❌ Push notification subscription failed:', error);
    }
  }

  // Expose the function globally so it can be called after login
  window.subscribeToAuthenticatedPushNotifications = subscribeToAuthenticatedPushNotifications;
  window.subscribeAfterLogin = subscribeToAuthenticatedPushNotifications;

  // ---------- Touch helpers ----------
  function setupTouchEvents() {
    let touchStartY = 0;
    let touchStartTime = 0;

    document.addEventListener('touchstart', (e) => {
      touchStartY = e.touches[0].clientY;
      touchStartTime = Date.now();
    }, { passive: true });

    document.addEventListener('touchend', (e) => {
      const touchEndY = e.changedTouches[0].clientY;
      const touchDuration = Date.now() - touchStartTime;
      const touchDistance = touchStartY - touchEndY;

      // Pull to refresh
      if (touchDistance < -100 && touchDuration < 500 && window.scrollY === 0) {
        handlePullToRefresh();
      }
    }, { passive: true });
  }

  function handlePullToRefresh() {
    if (window.MyNotesApp.syncManager && navigator.onLine) {
      showNotification('Refreshing...', 'info');
      window.MyNotesApp.syncManager.forceSyncAll()
        .then(() => {
          showNotification('Refreshed successfully', 'success');
        })
        .catch(() => {
          showNotification('Refresh failed', 'error');
        });
    }
  }

  // ---------- Misc UI ----------
  function initializeTooltips() {
    document.querySelectorAll('[data-tooltip]').forEach(element => {
      element.addEventListener('mouseenter', showTooltip);
      element.addEventListener('mouseleave', hideTooltip);
    });
  }

  function showTooltip(event) {
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = event.target.getAttribute('data-tooltip');
    tooltip.style.cssText = `
      position: absolute;
      background: #333;
      color: white;
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 14px;
      z-index: 10000;
      pointer-events: none;
      white-space: nowrap;
    `;

    document.body.appendChild(tooltip);

    const rect = event.target.getBoundingClientRect();
    tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
    tooltip.style.top = rect.top - tooltip.offsetHeight - 8 + 'px';

    event.target._tooltip = tooltip;
  }

  function hideTooltip(event) {
    if (event.target._tooltip) {
      document.body.removeChild(event.target._tooltip);
      delete event.target._tooltip;
    }
  }

  function setupFormValidation() {
    document.querySelectorAll('form').forEach(form => {
      form.addEventListener('submit', validateForm);
    });
  }

  function validateForm(event) {
    const form = event.target;
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;

    requiredFields.forEach(field => {
      if (!field.value.trim()) {
        field.classList.add('error');
        isValid = false;
      } else {
        field.classList.remove('error');
      }
    });

    if (!isValid) {
      event.preventDefault();
      showNotification('Please fill in all required fields', 'error');
    }
  }

  function initializeModals() {
    document.addEventListener('click', (event) => {
      if (event.target.classList.contains('modal-overlay')) {
        closeModal(event.target.querySelector('.modal'));
      }
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        const openModal = document.querySelector('.modal.open');
        if (openModal) {
          closeModal(openModal);
        }
      }
    });
  }

  function closeModal(modal) {
    if (modal) {
      modal.classList.remove('open');
      modal.parentElement.classList.remove('open');
    }
  }

  function initializeSearch() {
    const searchInput = document.querySelector('#search-input, .search-input');
    if (searchInput) {
      let searchTimeout;

      searchInput.addEventListener('input', (event) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
          performSearch(event.target.value);
        }, 300);
      });
    }
  }

  function performSearch(query) {
    const event = new CustomEvent('performSearch', { detail: { query } });
    window.dispatchEvent(event);
  }

  function checkDragDropSupport() {
    return 'draggable' in document.createElement('div') &&
      'ondragstart' in document.createElement('div') &&
      'ondrop' in document.createElement('div');
  }

  function initializeDragDrop() {
    console.log('🖱️ Drag and drop initialized');
  }

  function showConflictResolutionDialog(conflict, resolveCallback) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay open';
    modal.innerHTML = `
      <div class="modal conflict-resolution-modal open">
        <div class="modal-header">
          <h3>Sync Conflict Detected</h3>
        </div>
        <div class="modal-body">
          <p>The same item has been modified both locally and on the server. Please choose how to resolve this conflict:</p>
          <div class="conflict-options">
            <button class="btn" onclick="resolveConflict('client')">Keep Local Changes</button>
            <button class="btn" onclick="resolveConflict('server')">Keep Server Changes</button>
            <button class="btn btn-primary" onclick="resolveConflict('merge')">Merge Changes</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    window._currentConflictResolve = resolveCallback;
    window._currentConflict = conflict;
  }

  window.resolveConflict = function (strategy) {
    if (window._currentConflictResolve && window._currentConflict) {
      const resolver = new ConflictResolver();
      const resolved = resolver.resolve(window._currentConflict, strategy);
      window._currentConflictResolve(resolved);

      delete window._currentConflictResolve;
      delete window._currentConflict;

      const modal = document.querySelector('.conflict-resolution-modal');
      if (modal) {
        modal.parentElement.remove();
      }
    }
  };

  // ---------- Notifications manager ----------
  class NotificationManager {
    constructor() {
      this.queue = [];
      this.isProcessing = false;
    }

    show(message, type = 'info', duration = 3000) {
      this.queue.push({ message, type, duration });
      this.processQueue();
    }

    async processQueue() {
      if (this.isProcessing || this.queue.length === 0) return;

      this.isProcessing = true;

      while (this.queue.length > 0) {
        const notification = this.queue.shift();
        showNotification(notification.message, notification.type);
        await this.delay(notification.duration + 500);
      }

      this.isProcessing = false;
    }

    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  }

  // ---------- CSS helpers ----------
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
    
    .error {
      border-color: #f44336 !important;
      background-color: #ffebee !important;
    }
    
    .compact-mode {
      font-size: 14px;
    }
    
    .compact-mode .card {
      padding: 12px;
    }
  `;
  document.head.appendChild(style);

  // ---------- DOM ready ----------
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
  }

  // Export initialization function for manual calling if needed
  window.initializeApp = initializeApp;
})();
