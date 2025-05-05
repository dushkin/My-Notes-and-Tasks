// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { SettingsProvider } from "./contexts/SettingsContext"; // <-- Import Provider
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* Wrap App with the SettingsProvider */}
    <SettingsProvider>
      <App />
    </SettingsProvider>
  </React.StrictMode>
);