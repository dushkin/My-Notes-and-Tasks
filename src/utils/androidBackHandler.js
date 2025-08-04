import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';

let backButtonListener = null;

export const setupAndroidBackHandler = (isMobile, mobileViewMode, setMobileViewMode, navigate) => {
  // Only setup on mobile platforms (Android)
  if (!Capacitor.isNativePlatform()) {
    console.log('📱 Not on native platform, skipping Android back handler');
    return;
  }

  // Remove existing listener if any
  if (backButtonListener) {
    backButtonListener.remove();
    backButtonListener = null;
  }

  // Setup Android back button listener
  backButtonListener = App.addListener('backButton', ({ canGoBack }) => {
    console.log('🔙 Android back button pressed', { canGoBack, mobileViewMode, url: window.location.href });
    
    // Check if we're on the EditorPage route
    if (window.location.pathname.includes('/item/')) {
      console.log('📱 On EditorPage route, navigating to main app');
      navigate('/');
      return;
    }
    
    // If we're in content view mode in main app, go back to tree view
    if (mobileViewMode === 'content') {
      console.log('📱 Switching from content to tree view');
      if (setMobileViewMode) {
        setMobileViewMode('tree');
        // Update history to maintain proper state
        window.history.pushState(
          { viewMode: 'tree' },
          '',
          window.location.href
        );
      }
      return; // Prevent default back behavior
    }
    
    // If we're in tree view or other views, check if we can go back in browser history
    if (canGoBack) {
      // Try to go back in browser history
      window.history.back();
    } else {
      // If we can't go back, minimize the app instead of closing it
      if (App.minimizeApp) {
        App.minimizeApp();
      } else {
        App.exitApp();
      }
    }
  });

  console.log('✅ Android back button handler setup complete');
};

export const cleanupAndroidBackHandler = () => {
  if (backButtonListener) {
    backButtonListener.remove();
    backButtonListener = null;
    console.log('🧹 Android back button handler cleanup complete');
  }
};