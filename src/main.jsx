// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { SettingsProvider } from "./contexts/SettingsContext";
import "./styles/index.css";
import './TipTap.css';

// Register the service worker

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    const { action, taskId } = event.data || {};
    if (action === "vi") {
      fetch(`/api/tasks/${taskId}/complete`, { method: "PATCH" });
    } else if (action === "snooze") {
      setTimeout(() => {
        new Notification("Reminder Snoozed", {
          body: "Reminder: " + taskId,
          tag: taskId,
        });
      }, 10 * 60 * 1000);
    }
  });
}
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/serviceWorker.js').then(registration => {
      console.log('ServiceWorker registration successful with scope: ', registration.scope);
    }, err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </React.StrictMode>
);