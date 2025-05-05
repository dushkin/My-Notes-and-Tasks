// src/components/SettingsDialog.jsx
import React, { useState, useMemo } from 'react';
import { X, Search, RotateCcw, AlertTriangle } from 'lucide-react';
import {
  useSettings,
  themeOptions,
  sortOrderOptions, // Keep even if disabled for now
  exportFormatOptions,
  editorFontFamilyOptions,
  editorFontSizeOptions
} from '../contexts/SettingsContext';
// Adjust path as needed

// Helper to get current value string for searching
const getCurrentValueString = (setting, settings) => {
    const value = settings[setting.id];
    if (typeof value === 'boolean') return value ? 'Enabled' : 'Disabled';
    // Check if options exist and find the corresponding label
    if (setting.options && Array.isArray(setting.options)) {
        const option = setting.options.find(opt => opt.value === value);
        return option ? option.label : String(value); // Return label or value itself
    }
    // Handle cases like radio buttons where options might not be directly on the setting object
    if (setting.id === 'defaultExportFormat' && exportFormatOptions) {
        const option = exportFormatOptions.find(opt => opt.value === value);
        return option ? option.label : String(value);
    }
    // Fallback for other types or if options aren't structured as expected
    return String(value);
};


const SettingsDialog = ({ isOpen, onClose }) => {
  const { settings, updateSetting, resetSettings, resetApplicationData } = useSettings();
  const [searchTerm, setSearchTerm] = useState('');

  // Define settings structure with components
  const allSettings = useMemo(() => [
    {
      id: 'theme',
      label: 'Theme',
      description: 'Select the application color scheme.',
      options: themeOptions, // Used for search
      component: (
        <select
          data-testid="setting-theme-select" // Added testid
          value={settings.theme}
          onChange={(e) => updateSetting('theme', e.target.value)}
          className="p-1 border rounded bg-white dark:bg-zinc-700 dark:border-zinc-600 min-w-[150px]" // Added min-width
        >
          {themeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      )
    },
    /* // Keep sort order setting definition but commented out/disabled in UI
    {
      id: 'defaultSortOrder',
      label: 'Default Sort Order',
      description: 'How items are sorted in the tree (requires app restart/refresh for full effect).',
      options: sortOrderOptions, // Used for search
      component: (
        <select
          value={settings.defaultSortOrder}
          onChange={(e) => updateSetting('defaultSortOrder', e.target.value)}
          className="p-1 border rounded bg-white dark:bg-zinc-700 dark:border-zinc-600 min-w-[150px]"
          disabled // NOTE: Disabled for now as the sorting logic isn't implemented yet
        >
          {sortOrderOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      )
    },
    */
    {
      id: 'autoExpandNewFolders',
      label: 'Auto-Expand New Folders',
      description: 'Automatically expand parent folders when adding a new item.',
      // No options needed for boolean search, helper function handles it
      component: (
         <input
            data-testid="setting-autoexpand-checkbox" // Added testid
            type="checkbox"
            checked={settings.autoExpandNewFolders}
            onChange={(e) => updateSetting('autoExpandNewFolders', e.target.checked)}
            className="form-checkbox h-5 w-5 text-blue-600 rounded cursor-pointer" // Added cursor-pointer
          />
      )
    },
    {
      id: 'editorFontFamily',
      label: 'Default Editor Font',
      description: 'Default font family for the note/task editor.',
      options: editorFontFamilyOptions, // Used for search
      component: (
        <select
          data-testid="setting-fontfamily-select" // Added testid
          value={settings.editorFontFamily}
          onChange={(e) => updateSetting('editorFontFamily', e.target.value)}
          className="p-1 border rounded bg-white dark:bg-zinc-700 dark:border-zinc-600 min-w-[150px]"
        >
          {editorFontFamilyOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      )
    },
    {
      id: 'editorFontSize',
      label: 'Default Editor Font Size',
      description: 'Default font size for the note/task editor.',
      options: editorFontSizeOptions, // Used for search
      component: (
        <select
          data-testid="setting-fontsize-select" // Added testid
          value={settings.editorFontSize}
          onChange={(e) => updateSetting('editorFontSize', e.target.value)}
          className="p-1 border rounded bg-white dark:bg-zinc-700 dark:border-zinc-600 min-w-[150px]"
        >
          {editorFontSizeOptions.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>
      )
    },
    {
      id: 'defaultExportFormat',
      label: 'Default Export Format',
      description: 'Pre-selected format when exporting items or the tree.',
      // options defined separately for radio group, used by helper
      component: (
         <div className="flex space-x-3">
             {exportFormatOptions.map(opt => (
                 <label key={opt.value} className="flex items-center space-x-1 cursor-pointer">
                     <input
                         data-testid={`setting-exportformat-${opt.value}`} // Added testid
                         type="radio"
                         name="defaultExportFormat"
                         value={opt.value}
                         checked={settings.defaultExportFormat === opt.value}
                         onChange={(e) => updateSetting('defaultExportFormat', e.target.value)}
                         className="form-radio text-blue-600 cursor-pointer" // Added cursor-pointer
                     />
                     <span>{opt.label}</span>
                 </label>
             ))}
         </div>
      )
    },
     {
      id: 'resetSettings',
      label: 'Reset Settings',
      description: 'Reset all settings to their default values.',
      component: (
        <button
           data-testid="setting-resetsettings-button" // Added testid
           onClick={resetSettings}
          title="Reset all application settings to default" // Added title
          className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600 flex items-center transition-colors duration-150"
        >
          <RotateCcw className="w-4 h-4 mr-1" /> Reset
        </button>
      )
    },
     {
      id: 'resetData',
      label: 'Reset Application Data',
      description: 'WARNING: Deletes all notes, tasks, folders, and resets settings.',
      component: (
        <button
          data-testid="setting-resetdata-button" // Added testid
          onClick={resetApplicationData}
          title="WARNING: This will delete all your data!" // Added title
          className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 flex items-center transition-colors duration-150"
        >
          <AlertTriangle className="w-4 h-4 mr-1" /> Reset All Data
        </button>
      )
    },
  ], [settings, updateSetting, resetSettings, resetApplicationData]);
  // Dependencies for the settings definition memo

  // Filter settings based on search term (name, description, current value)
  const filteredSettings = useMemo(() => {
      if (!searchTerm) return allSettings;
      const lowerSearchTerm = searchTerm.toLowerCase();
      return allSettings.filter(setting =>
          setting.label.toLowerCase().includes(lowerSearchTerm) ||
          setting.description.toLowerCase().includes(lowerSearchTerm) ||
          getCurrentValueString(setting, settings).toLowerCase().includes(lowerSearchTerm)
      );
  }, [allSettings, searchTerm, settings]);
  // Dependencies for filtering memo

  // Conditional rendering after hooks
  if (!isOpen) return null;
  // --- Render Component ---
  return (
    <div data-testid="settings-dialog-overlay" className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 backdrop-blur-sm transition-opacity duration-200">
      <div data-testid="settings-dialog-content" className="bg-white dark:bg-zinc-800 p-5 rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-zinc-200 dark:border-zinc-700">
        {/* Dialog Header */}
        <div className="flex justify-between items-center mb-4 border-b pb-3 dark:border-zinc-600 flex-shrink-0">
          <h2 className="text-xl font-semibold">Settings</h2>
          <button
            data-testid="settings-close-button-header" // Added testid
            onClick={onClose}
            className="p-1 rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors duration-150"
            aria-label="Close Settings"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-4 relative flex-shrink-0">
          <input
            data-testid="settings-search-input" // Added testid
            type="text"
            placeholder="Search settings by name, description, or value..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full p-2 pl-10 border rounded dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Search className="w-5 h-5 text-zinc-400 absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Settings List */}
        <div className="flex-grow overflow-y-auto space-y-5 pr-2 -mr-2 custom-scrollbar"> {/* Use the class here */}
          {filteredSettings.length > 0 ? (
            filteredSettings.map(setting => (
              <div
                key={setting.id}
                data-testid={`setting-row-${setting.id}`} // Added testid for row
                className="flex flex-col sm:flex-row sm:items-start sm:justify-between pb-4 border-b border-zinc-200 dark:border-zinc-700 last:border-b-0"
              >
                <div className="mb-2 sm:mb-0 sm:mr-4 flex-1">
                  <label
                     htmlFor={setting.id} // Use setting id for association
                     className={`font-medium block ${setting.id === 'resetData' ? 'text-red-600 dark:text-red-400' : ''}`}
                  >
                    {setting.label}
                  </label>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">{setting.description}</p>
                </div>
                <div className="flex-shrink-0 flex items-center mt-1 sm:mt-0">
                    {/* Pass id to potentially associate label with input */}
                  {React.cloneElement(setting.component, { id: setting.id })}
                </div>
              </div>
            ))
          ) : (
            <p data-testid="settings-no-results" className="text-zinc-500 dark:text-zinc-400 text-center py-6">No settings found matching your search.</p>
          )}
        </div>

        {/* Dialog Footer */}
        <div className="mt-6 pt-4 border-t dark:border-zinc-600 flex justify-end flex-shrink-0">
          <button
            data-testid="settings-close-button-footer" // Added testid
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors duration-150"
            autoFocus
          >
            Close
          </button>
        </div>
      </div>
      {/* Style block removed */}
    </div>
  );
};

export default SettingsDialog;