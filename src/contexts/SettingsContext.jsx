// src/contexts/SettingsContext.jsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import { authFetch } from '../services/apiClient';

// Make sure these arrays are populated with your actual options
export const themeOptions = [
  { value: "system", label: "System Default" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];
export const exportFormatOptions = [
  { value: "json", label: "JSON" },
  { value: "pdf", label: "PDF" },
];
export const editorFontFamilyOptions = [
  { value: "Arial", label: "Arial" },
  { value: "Verdana", label: "Verdana" },
  { value: "Times New Roman", label: "Times New Roman" },
  { value: "Courier New", label: "Courier New" },
  { value: "Georgia", label: "Georgia" },
];
export const editorFontSizeOptions = [
  { value: "1", label: "Smallest" },
  { value: "2", label: "Smaller" },
  { value: "3", label: "Normal" },
  { value: "4", label: "Larger" },
  { value: "5", label: "Largest" },
];
export const defaultSettings = {
  theme: "system",
  autoExpandNewFolders: true,
  editorFontFamily:
    editorFontFamilyOptions.length > 0
      ? editorFontFamilyOptions[0].value
      : "Arial",
  editorFontSize:
    editorFontSizeOptions.length > 2 ? editorFontSizeOptions[2].value : "3",
  defaultExportFormat: "json",
  autoExportEnabled: false,
  autoExportIntervalMinutes: 30,
  // New Notification Settings
  reminderSoundEnabled: true,
  reminderVibrationEnabled: true,
  reminderSoundUrl: '/sounds/default-tone.mp3',
};
const SettingsContext = createContext();

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    console.error(
      "useSettings must be used within a SettingsProvider. Falling back to default settings."
    );
    return {
      settings: defaultSettings,
      updateSetting: () =>
        console.warn("SettingsProvider not found, updateSetting is a no-op."),
      resetSettings: () =>
        console.warn("SettingsProvider not found, resetSettings is a no-op."),
      resetApplicationData: () =>
        console.warn(
          "SettingsProvider not found, resetApplicationData is a no-op."
        ),
      defaultSettings,
    };
  }
  return context;
};

export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(() => {
    try {
      const storedSettings = localStorage.getItem("appSettings");
      const initialSettings = storedSettings ? JSON.parse(storedSettings) : {};
      const mergedSettings = { ...defaultSettings, ...initialSettings };
      delete mergedSettings.autoExportDirectory;
      return mergedSettings;
    } catch (error) {
      console.error("Failed to load settings from localStorage:", error);
      const fallbackSettings = { ...defaultSettings };
      delete fallbackSettings.autoExportDirectory;
      return fallbackSettings;
    }
  });
  useEffect(() => {
    try {
      const settingsToSave = { ...settings };
      delete settingsToSave.autoExportDirectory;

      localStorage.setItem("appSettings", JSON.stringify(settingsToSave));
      document.documentElement.className = "";
      if (
        settings.theme === "dark" ||
        (settings.theme === "system" &&
          window.matchMedia("(prefers-color-scheme: dark)").matches)
      ) {
        document.documentElement.classList.add("dark");
      }
    } catch (error) {
      console.error("Failed to save settings or apply theme:", error);
    }
  }, [settings]);

  const updateSetting = useCallback(async (key, value) => {
    // Optimistically update local state
    setSettings((prevSettings) => ({
      ...prevSettings,
      [key]: value,
    }));
    
    // Persist the change to the backend
    try {
      await authFetch('/user/settings', {
        method: 'PATCH',
        body: JSON.stringify({ [key]: value }),
      });
    } catch (error) {
      console.error(`Failed to save setting '${key}' to the server:`, error);
      // Optional: implement logic to revert the optimistic update or show a toast message
    }
  }, []);

  const resetSettings = useCallback(() => {
    const newDefaultSettings = { ...defaultSettings };
    delete newDefaultSettings.autoExportDirectory;
    setSettings(newDefaultSettings);
    // Persist the reset to the backend
    try {
        authFetch('/user/settings', {
            method: 'PATCH',
            body: JSON.stringify(newDefaultSettings),
        });
    } catch(error) {
        console.error('Failed to reset settings on the server:', error);
    }
  }, []);
  const resetApplicationData = useCallback(() => {
    console.warn(
      "resetApplicationData called - ensure LOCAL_STORAGE_KEY for tree data is also cleared here."
    );
    resetSettings();
    alert(
      "Application settings have been reset. Full data reset requires additional implementation for tree data."
    );
  }, [resetSettings]);
  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSetting,
        resetSettings,
        resetApplicationData,
        defaultSettings,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
};