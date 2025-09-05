import React, { useEffect } from "react";
import ErrorBoundary from "./ErrorBoundary.jsx";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { initApiClient } from "./services/apiClient";
import { 
  LandingPageRoute, 
  LoginRoute, 
  RegisterRoute, 
  ProtectedAppRoute 
} from "./components/routes/AppRoutes.jsx";
import DeletionStatusPage from "./components/DeletionStatusPage";

const App = () => {
  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === "taskChecked" && event.newValue) {
        try {
          const data = JSON.parse(event.newValue);
          if (data?.id) {
            document
              .querySelector(`[data-id='${data.id}'] input[type='checkbox']`)
              ?.click();
          }
        } catch (e) {
          console.warn("Invalid taskChecked value", event.newValue);
        }
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  // Initialize notification service and service worker message listener
  useEffect(() => {
    const initNotificationService = async () => {
      try {
        const { notificationService } = await import('./services/notificationService.js');
        await notificationService.initialize();
        console.log('🔔 Notification service initialized in App');
      } catch (error) {
        console.error('❌ Failed to initialize notification service:', error);
      }
    };

    // Service worker message listener for reminder alerts
    const handleServiceWorkerMessage = async (event) => {
      if (event.data?.type === 'SHOW_REMINDER_ALERT') {
        const { title, body, itemTitle } = event.data.data;
        console.log('🔔 Showing desktop reminder notification:', itemTitle);
        
        // Use proper browser notification instead of alert
        try {
          if ('Notification' in window && Notification.permission === 'granted') {
            const notification = new Notification(title, {
              body: body,
              icon: '/favicon-192x192.png',
              badge: '/favicon-48x48.png',
              requireInteraction: true,
              tag: `reminder-${event.data.data.itemId || Date.now()}`,
              vibrate: [200, 100, 200]
            });
            
            notification.onclick = () => {
              window.focus();
              notification.close();
            };
            
            // Auto-close after 10 seconds if user doesn't interact
            setTimeout(() => {
              notification.close();
            }, 10000);
            
          } else if ('Notification' in window && Notification.permission === 'default') {
            // Request permission and retry
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
              // Retry with notification
              handleServiceWorkerMessage(event);
            } else {
              // Fallback to alert only if permission denied
              console.warn('⚠️ Notification permission denied, falling back to alert');
              alert(`${title}\n${body}`);
            }
          } else {
            // No notification support, use alert
            console.warn('⚠️ Notifications not supported, using alert');
            alert(`${title}\n${body}`);
          }
        } catch (error) {
          console.error('❌ Failed to show notification, falling back to alert:', error);
          alert(`${title}\n${body}`);
        }
      }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage);
    }

    initNotificationService();

    // Cleanup
    return () => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage);
      }
    };
  }, []);


  return (
    <Router>
      <Routes>
        <Route path="/" element={<LandingPageRoute />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route path="/register" element={<RegisterRoute />} />
        <Route path="/app/*" element={<ProtectedAppRoute />} />
        <Route path="/deletion-status" element={<DeletionStatusPage />} />
      </Routes>
    </Router>
  );
};

function AppWithErrorBoundary() {
  useEffect(() => {
    // Initialize API client with a minimal logout handler
    // This will be properly initialized later in MainApp.jsx with the full handler
    initApiClient(() => {
      console.log('Early logout triggered, redirecting to login...');
      window.location.href = '/login';
    });
  }, []);

  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default AppWithErrorBoundary;