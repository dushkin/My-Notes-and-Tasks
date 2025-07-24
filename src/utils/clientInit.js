// clientInit.js - Client-side initialization and setup

import { authFetch } from '../services/apiClient';

(function () {
  'use strict';

  // Global app state
  window.MyNotesApp = {
    syncManager: null,
    notificationManager: null,
    isInitialized: false,
    config: {
      apiBaseUrl: '/api',
      syncInterval: 30000,
      maxRetries: 3,
      retryDelay: 1000
    }
  };

  // Initialize the application
  async function initializeApp() {
    try {
      console.log('🚀 Initializing My Notes & Tasks App...');

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

      // Register service worker
      await registerServiceWorker();

      // Setup push notifications
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

  // Check browser support for required features
  function checkBrowserSupport() {
    const requiredFeatures = [
      'localStorage',
      'indexedDB',
      'serviceWorker',
      'fetch',
      'Promise'
    ];

    for (const feature of requiredFeatures) {
      if (!isSupported(feature)) {
        console.error(`❌ Feature not supported: ${feature}`);
        return false;
      }
    }

    return true;
  }

  function isSupported(feature) {
    switch (feature) {
      case 'localStorage':
        return typeof Storage !== 'undefined';
      case 'indexedDB':
        return 'indexedDB' in window;
      case 'serviceWorker':
        return 'serviceWorker' in navigator;
      case 'fetch':
        return 'fetch' in window;
      case 'Promise':
        return 'Promise' in window;
      default:
        return false;
    }
  }

  // Initialize core services
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

  // Initialize IndexedDB for offline storage
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

  // Setup global event listeners
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

    console.log('✅ Event listeners set up');
  }

  // Initialize UI components
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

  // Theme management
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

  // Register service worker
  async function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) {
      console.warn('⚠️ Service workers not supported');
      return;
    }

    try {
      // Unregister old service worker first
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (let registration of registrations) {
        await registration.unregister();
        console.log('🗑️ Unregistered old service worker');
      }

      // Register new service worker
      const registration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none' // Force fresh download
      });
      console.log('✅ Service Worker registered:', registration);

      // Listen for updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateAvailableNotification();
          }
        });
      });

      window.MyNotesApp.swRegistration = registration;
    } catch (error) {
      console.error('❌ Service Worker registration failed:', error);
    }
  }

  // Initialize push notifications
  async function initializePushNotifications() {
    if (!('Notification' in window)) {
      console.warn('⚠️ Notifications not supported');
      return;
    }

    if (!('PushManager' in window)) {
      console.warn('⚠️ Push messaging not supported');
      return;
    }

    try {
      // Request notification permission
      const permission = await Notification.requestPermission();
      console.log('📱 Notification permission:', permission);

      if (permission === 'granted' && window.MyNotesApp.swRegistration) {
        // Wait for service worker to be ready
        const registration = await navigator.serviceWorker.ready;

        // Subscribe to push notifications
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: await getVapidKey()
        });

        console.log('✅ Push subscription created');
      }
    } catch (error) {
      console.error('❌ Push notification setup failed:', error);
    }
  }

  // Load initial data
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

  // Event handlers
  function handleBeforeUnload(event) {
    // Save any pending changes
    savePendingChanges();

    // Don't show confirmation dialog for normal operation
    return undefined;
  }

  function handleWindowFocus() {
    // Resume sync operations
    if (window.MyNotesApp.syncManager) {
      window.MyNotesApp.syncManager.processSyncQueue();
    }
  }

  function handleWindowBlur() {
    // Save current state
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

  // Utility functions
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
      z-index: 10000;
      max-width: 300px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  function showUpdateAvailableNotification() {
    const updateDiv = document.createElement('div');
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
    ">
      <div style="margin-bottom: 10px;">Update available!</div>
      <button id="update-now-btn" style="
        background: white;
        color: #2196F3;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
        margin-right: 8px;
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
  `;

    document.body.appendChild(updateDiv);

    // Add proper event listeners
    const updateNowBtn = updateDiv.querySelector('#update-now-btn');
    const updateLaterBtn = updateDiv.querySelector('#update-later-btn');

    updateNowBtn.addEventListener('click', async () => {
      console.log('🔄 Update Now clicked - triggering service worker update...');

      try {
        // Get the service worker registration
        const registration = window.MyNotesApp.swRegistration || await navigator.serviceWorker.getRegistration();

        if (registration && registration.waiting) {
          console.log('🔄 Found waiting service worker, sending SKIP_WAITING message...');

          // Tell the waiting service worker to skip waiting
          registration.waiting.postMessage({ type: 'SKIP_WAITING' });

          // Listen for the controller change (new SW taking over)
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            console.log('🔄 Controller changed, reloading page...');
            window.location.reload();
          }, { once: true });

          // Show loading message
          updateNowBtn.textContent = 'Updating...';
          updateNowBtn.disabled = true;

        } else {
          console.log('🔄 No waiting service worker found, forcing page reload...');
          window.location.reload();
        }
      } catch (error) {
        console.error('❌ Error during update:', error);
        // Fallback to simple reload
        window.location.reload();
      }
    });

    updateLaterBtn.addEventListener('click', () => {
      updateDiv.remove();
    });
  }

  // App-specific utility functions
  function createNewNote() {
    const event = new CustomEvent('createNewNote');
    window.dispatchEvent(event);
  }

  function saveCurrentItem() {
    const event = new CustomEvent('saveCurrentItem');
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

    // Apply preferences
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
    // Load from localStorage first (faster)
    const notes = JSON.parse(localStorage.getItem('notes') || '[]');
    const tasks = JSON.parse(localStorage.getItem('tasks') || '[]');

    // Dispatch events to update UI
    window.dispatchEvent(new CustomEvent('notesLoaded', { detail: notes }));
    window.dispatchEvent(new CustomEvent('tasksLoaded', { detail: tasks }));

    // Load from IndexedDB if available
    if (window.MyNotesApp.db) {
      try {
        const dbNotes = await getFromIndexedDB('notes');
        const dbTasks = await getFromIndexedDB('tasks');

        // Merge with localStorage data (IndexedDB is more reliable)
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

      // Use authFetch and get the raw response to parse it
      const response = await authFetch(endpointURL);
      const data = await response.json();

      console.log('🔑 VAPID parsed data:', data);
      return data.publicKey;
    } catch (error) {
      console.error('Failed to get VAPID key:', error);
      return null;
    }
  }

  async function sendSubscriptionToServer(subscription) {
    try {
      console.log('🔍 sendSubscriptionToServer called!');
      console.trace('🔍 Call stack:');
      console.log('✅ Sending push subscription to server...');
      await authFetch('/push/subscribe', {
        method: 'POST',
        body: subscription.toJSON()
      });

      console.log('✅ Push subscription sent to server successfully');
    } catch (error) {
      console.error('Failed to send subscription to server:', error);
    }
  }

  // Touch events for mobile
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

  // Additional UI initialization functions
  function initializeTooltips() {
    // Simple tooltip implementation
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
    // Close modals when clicking outside
    document.addEventListener('click', (event) => {
      if (event.target.classList.contains('modal-overlay')) {
        closeModal(event.target.querySelector('.modal'));
      }
    });

    // Close modals with escape key
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
    // This would set up drag and drop functionality
    console.log('🖱️ Drag and drop initialized');
  }

  function showConflictResolutionDialog(conflict, resolveCallback) {
    // Create and show a modal for conflict resolution
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

    // Store the resolve callback
    window._currentConflictResolve = resolveCallback;
    window._currentConflict = conflict;
  }

  // Global conflict resolution function
  window.resolveConflict = function (strategy) {
    if (window._currentConflictResolve && window._currentConflict) {
      const resolver = new ConflictResolver();
      const resolved = resolver.resolve(window._currentConflict, strategy);
      window._currentConflictResolve(resolved);

      // Clean up
      delete window._currentConflictResolve;
      delete window._currentConflict;

      // Close modal
      const modal = document.querySelector('.conflict-resolution-modal');
      if (modal) {
        modal.parentElement.remove();
      }
    }
  };

  // Notification Manager Class
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
        await this.delay(notification.duration + 500); // Add delay between notifications
      }

      this.isProcessing = false;
    }

    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  }

  // CSS animations
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

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
  } else {
    initializeApp();
  }

  // Export initialization function for manual calling if needed
  window.initializeApp = initializeApp;

})();