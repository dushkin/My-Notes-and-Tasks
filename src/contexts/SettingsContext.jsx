// src/contexts/SettingsContext.jsx
import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';

const SETTINGS_STORAGE_KEY = "appSettings";

// Define default settings
export const defaultSettings = {
  theme: 'system', // 'light', 'dark', 'system'
  defaultSortOrder: 'foldersFirstAlpha', // e.g., 'foldersFirstAlpha', 'alpha', 'typeAlpha'
  autoExpandNewFolders: true,
  editorFontFamily: 'Arial',
  editorFontSize: '3', // Corresponds to HTML <font size="..."> values
  defaultExportFormat: 'json', // 'json', 'pdf'
};

// --- Available Options (for selects etc.) ---
export const themeOptions = [
    { value: 'system', label: 'System Default' },
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
];

export const sortOrderOptions = [
    { value: 'foldersFirstAlpha', label: 'Folders First, then Alpha' },
    { value: 'alpha', label: 'Alphabetical' },
    { value: 'typeAlpha', label: 'By Type, then Alpha' },
];

export const exportFormatOptions = [
    { value: 'json', label: 'JSON' },
    { value: 'pdf', label: 'PDF' },
];

// FONT_FAMILIES and FONT_SIZES from EditorPane (consider moving to a shared constants file)
export const editorFontFamilyOptions = [ "Arial", "Times New Roman", "Courier New", "Georgia", "Verdana" ].map(f => ({ value: f, label: f }));
export const editorFontSizeOptions = ["1", "2", "3", "4", "5", "6", "7"].map(s => ({ value: s, label: `Size ${s}` }));
// --- End Options ---


// Create the context
export const SettingsContext = createContext();

// Create the provider component
export const SettingsProvider = ({ children }) => {
  const [settings, setSettings] = useState(() => {
    try {
      const stored = localStorage.getItem(SETTINGS_STORAGE_KEY);
      const parsed = stored ? JSON.parse(stored) : defaultSettings;
      // Ensure all keys from defaultSettings exist
      return { ...defaultSettings, ...parsed };
    } catch (error) {
      console.error("Failed to load settings from localStorage:", error);
      return defaultSettings;
    }
  });

  // Apply theme and persist settings on change
  useEffect(() => {
    try {
      // Apply theme
      const root = window.document.documentElement;
      root.classList.remove('light', 'dark');
      let effectiveTheme = settings.theme;
      if (settings.theme === 'system') {
        effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      }
      root.classList.add(effectiveTheme);

      // Persist settings
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error("Failed to save settings or apply theme:", error);
    }
  }, [settings]);

  // Function to update a specific setting
  const updateSetting = useCallback((key, value) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  // Function to reset all settings to default
  const resetSettings = useCallback(() => {
    if (window.confirm("Are you sure you want to reset all settings to their defaults?")) {
        localStorage.removeItem(SETTINGS_STORAGE_KEY);
        setSettings(defaultSettings); // Reset state to defaults
         // Consider if a page reload is needed here depending on how settings are consumed
         // window.location.reload();
    }
  }, []);

  // Function to reset application data (clears tree, expanded state, and settings)
  const resetApplicationData = useCallback(() => {
     if (window.confirm(
        "WARNING: This will permanently delete all your notes, tasks, and folders, and reset all settings. This action cannot be undone. Are you absolutely sure?"
     )) {
         try {
            // Use the keys directly for now. Ideally, import from constants.
            localStorage.removeItem("myNotesTasksTree");
            localStorage.removeItem("myNotesTasksTree_expanded");
            localStorage.removeItem(SETTINGS_STORAGE_KEY);
            // Reset state as well
            setSettings(defaultSettings);
            // Force reload to clear application state completely (including useTree)
            window.location.reload();
         } catch (error) {
            console.error("Failed to reset application data:", error);
            alert("An error occurred while trying to reset data.");
         }
     }
  }, []);

  const value = {
    settings,
    updateSetting,
    resetSettings,
    resetApplicationData,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

// Custom hook to use the settings context
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};