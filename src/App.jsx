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

  // Initialize notification service
  useEffect(() => {
    const initNotificationService = async () => {
      try {
        const { notificationService } = await import('./services/notificationService.js');
        await notificationService.initialize();
        await notificationService.registerActionTypes();
        console.log('🔔 Notification service initialized in App');
      } catch (error) {
        console.error('❌ Failed to initialize notification service:', error);
      }
    };

    initNotificationService();
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