import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";

// Make sure these arrays are populated with your actual options
export const themeOptions = [
  { value: "system", label: "System Default" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];
export const sortOrderOptions = [
  /* Placeholder if you use it elsewhere */
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
  reminderSoundEnabled: true,
  reminderVibrationEnabled: true,
  reminderDisplayDoneButton: true,
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
      // Ensure all default keys are present, even if not in storedSettings
      const mergedSettings = { ...defaultSettings, ...initialSettings };
      // Remove autoExportDirectory explicitly if it exists from older versions
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
      // Create a copy of settings to save, excluding autoExportDirectory if it somehow crept in
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

  const updateSetting = useCallback((key, value) => {
    setSettings((prevSettings) => {
      const newSettings = {
        ...prevSettings,
        [key]: value,
      };
      // Ensure autoExportDirectory is not part of the settings state if key is not it
      if (key !== "autoExportDirectory") {
        delete newSettings.autoExportDirectory;
      } else if (key === "autoExportDirectory" && value === undefined) {
        // If explicitly trying to remove it
        delete newSettings.autoExportDirectory;
      }
      return newSettings;
    });
  }, []);

  const resetSettings = useCallback(() => {
    const newDefaultSettings = { ...defaultSettings };
    delete newDefaultSettings.autoExportDirectory;
    setSettings(newDefaultSettings);
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