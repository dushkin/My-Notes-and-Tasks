// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { SettingsProvider } from "./contexts/SettingsContext";
import "./styles/index.css";
import './TipTap.css';
import './styles/FloatingActionButton.css';
import './styles/AddDialog.css';

// Ensure app initialization even if Capacitor takes too long
const initializeApp = () => {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <SettingsProvider>
        <App />
      </SettingsProvider>
    </React.StrictMode>
  );
};

// Add timeout fallback for native app initialization
const isNativeCheck = (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
                     window.Ionic || 
                     navigator.userAgent.includes('CapacitorWebView');

if (isNativeCheck) {
  // Wait for Capacitor to be ready, but with a timeout
  if (window.Capacitor) {
    window.Capacitor.Plugins.SplashScreen?.hide?.();
  }
  
  // Force app to start after maximum 3 seconds
  setTimeout(() => {
    if (!document.getElementById("root").hasChildNodes()) {
      console.log('🚨 Force initializing app after timeout');
      initializeApp();
    }
  }, 3000);
  
  // Try to initialize immediately if ready
  if (document.readyState === 'complete') {
    initializeApp();
  } else {
    window.addEventListener('load', initializeApp);
  }
} else {
  initializeApp();
}

// Service Worker registration with cache busting
// Skip service worker registration in native app (Capacitor) environment
const isNative = (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) ||
                 window.Ionic || 
                 navigator.userAgent.includes('CapacitorWebView');

console.log('🔍 SW Registration Check (main.jsx):', {
  hasCapacitor: !!window.Capacitor,
  isNativePlatform: window.Capacitor?.isNativePlatform?.(),
  isNative,
  swSupported: 'serviceWorker' in navigator
});

if ('serviceWorker' in navigator && !isNative) {
  const version = __APP_VERSION__; // Injected at build time
  navigator.serviceWorker.register(`/sw.js?v=${version}`)
    .then(registration => {
      console.log('SW registered:', registration);
      
      // Check for updates
      registration.addEventListener('updatefound', () => {
        console.log('New SW version found, updating...');
        const newWorker = registration.installing;
        
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New version ready, prompt user or auto-update
            console.log('New version available, reloading...');
            window.location.reload();
          }
        });
      });
    })
    .catch(error => console.log('SW registration failed:', error));
} else {
  console.log('📱 Running in native app - skipping service worker registration (main.jsx)');
}