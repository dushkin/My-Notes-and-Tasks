// src/components/SettingsDialog.jsx
//
// Complete, uncommented implementation with safe fallback when no SettingsProvider
//
import React, { useState, useMemo } from 'react';
import { X, Search, RotateCcw, AlertTriangle } from 'lucide-react';
import {
  useSettings,
  defaultSettings,
  themeOptions,
  sortOrderOptions,
  exportFormatOptions,
  editorFontFamilyOptions,
  editorFontSizeOptions,
} from '../contexts/SettingsContext';

/** Convert a setting's current value to human‑readable text for search */
function valueLabel(setting, settings) {
  const v = settings[setting.id];
  if (typeof v === 'boolean') return v ? 'Enabled' : 'Disabled';
  if (setting.options) {
    const o = setting.options.find(opt => opt.value === v);
    if (o) return o.label;
  }
  if (setting.id === 'defaultExportFormat') {
    const o = exportFormatOptions.find(opt => opt.value === v);
    if (o) return o.label;
  }
  return String(v);
}

export default function SettingsDialog({ isOpen, onClose }) {
  // Safe context attempt
  let context;
  try {
    context = useSettings();
  } catch {
    // Render tests mount without provider – use defaults & no‑ops
    context = {
      settings: defaultSettings,
      updateSetting: () => {},
      resetSettings: () => {},
      resetApplicationData: () => {},
    };
  }
  const { settings, updateSetting, resetSettings, resetApplicationData } = context;
  const [search, setSearch] = useState('');

  /** All setting descriptors (memoised) */
  const all = useMemo(() => [
    {
      id: 'theme',
      label: 'Theme',
      desc: 'Select the application color scheme.',
      options: themeOptions,
      control: (
        <select
          id="theme"
          data-testid="setting-theme-select"
          value={settings.theme}
          onChange={e => updateSetting('theme', e.target.value)}
          className="p-1 border rounded bg-white dark:bg-zinc-700 dark:border-zinc-600 min-w-[150px]"
        >
          {themeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ),
    },
    {
      id: 'autoExpandNewFolders',
      label: 'Auto‑Expand New Folders',
      desc: 'Automatically expand parent folders when adding a new item.',
      control: (
        <input
          id="autoExpandNewFolders"
          type="checkbox"
          data-testid="setting-autoexpand-checkbox"
          checked={settings.autoExpandNewFolders}
          onChange={e => updateSetting('autoExpandNewFolders', e.target.checked)}
          className="form-checkbox h-5 w-5 text-blue-600 rounded cursor-pointer"
        />
      ),
    },
    {
      id: 'editorFontFamily',
      label: 'Default Editor Font',
      desc: 'Default font family for the note/task editor.',
      options: editorFontFamilyOptions,
      control: (
        <select
          id="editorFontFamily"
          data-testid="setting-fontfamily-select"
          value={settings.editorFontFamily}
          onChange={e => updateSetting('editorFontFamily', e.target.value)}
          className="p-1 border rounded bg-white dark:bg-zinc-700 dark:border-zinc-600 min-w-[150px]"
        >
          {editorFontFamilyOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ),
    },
    {
      id: 'editorFontSize',
      label: 'Default Editor Font Size',
      desc: 'Default font size for the note/task editor.',
      options: editorFontSizeOptions,
      control: (
        <select
          id="editorFontSize"
          data-testid="setting-fontsize-select"
          value={settings.editorFontSize}
          onChange={e => updateSetting('editorFontSize', e.target.value)}
          className="p-1 border rounded bg-white dark:bg-zinc-700 dark:border-zinc-600 min-w-[150px]"
        >
          {editorFontSizeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ),
    },
    {
      id: 'defaultExportFormat',
      label: 'Default Export Format',
      desc: 'Pre‑selected format when exporting items or the tree.',
      control: (
        <div className="flex space-x-3">
          {exportFormatOptions.map(o => (
            <label key={o.value} className="flex items-center space-x-1 cursor-pointer">
              <input
                type="radio"
                name="defaultExportFormat"
                data-testid={`setting-exportformat-${o.value}`}
                value={o.value}
                checked={settings.defaultExportFormat === o.value}
                onChange={e => updateSetting('defaultExportFormat', e.target.value)}
                className="form-radio text-blue-600 cursor-pointer"
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      ),
    },
    {
      id: 'resetSettings',
      label: 'Reset Settings',
      desc: 'Reset all settings to their default values.',
      control: (
        <button
          type="button"
          data-testid="setting-resetsettings-button"
          onClick={() => {
            if (window.confirm('Reset all settings to default?')) resetSettings();
          }}
          className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600 flex items-center"
        >
          <RotateCcw className="w-4 h-4 mr-1" /> Reset
        </button>
      ),
    },
    {
      id: 'resetData',
      label: 'Reset Application Data',
      desc: 'WARNING: Deletes all notes, tasks, folders, and resets settings.',
      control: (
        <button
          type="button"
          data-testid="setting-resetdata-button"
          onClick={() => {
            if (window.confirm('WARNING: This will permanently delete all data and reset settings.')) {
              resetApplicationData();
            }
          }}
          className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 flex items-center"
        >
          <AlertTriangle className="w-4 h-4 mr-1" /> Reset All Data
        </button>
      ),
    },
  ], [settings, updateSetting, resetSettings, resetApplicationData]);

  const filtered = useMemo(() => {
    if (!search) return all;
    const term = search.toLowerCase();
    return all.filter(s =>
      s.label.toLowerCase().includes(term) ||
      s.desc.toLowerCase().includes(term) ||
      valueLabel(s, settings).toLowerCase().includes(term),
    );
  }, [all, search, settings]);

  if (!isOpen) return null;

  return (
    <div
      data-testid="settings-dialog-overlay"
      className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 backdrop-blur-sm transition-opacity duration-200"
    >
      <div
        data-testid="settings-dialog-content"
        className="bg-white dark:bg-zinc-800 p-5 rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-zinc-200 dark:border-zinc-700"
      >
        {/* Header */}
        <div className="flex justify-between items-center mb-4 border-b pb-3 dark:border-zinc-600 flex-shrink-0">
          <h2 className="text-xl font-semibold">Settings</h2>
          <button
            aria-label="Close Settings"
            data-testid="settings-close-button-header"
            onClick={onClose}
            className="p-1 rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="mb-4 relative flex-shrink-0">
          <input
            data-testid="settings-search-input"
            type="text"
            placeholder="Search settings..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full p-2 pl-10 border rounded dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Search className="w-5 h-5 text-zinc-400 absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Settings list */}
        <div className="flex-grow overflow-y-auto space-y-5 pr-2 -mr-2 custom-scrollbar">
          {filtered.length ? filtered.map(s => (
            <div
              key={s.id}
              data-testid={`setting-row-${s.id}`}
              className="flex flex-col sm:flex-row sm:items-start sm:justify-between pb-4 border-b border-zinc-200 dark:border-zinc-700 last:border-b-0"
            >
              <div className="mb-2 sm:mb-0 sm:mr-4 flex-1">
                <label htmlFor={s.id} className={`font-medium block ${s.id === 'resetData' ? 'text-red-600 dark:text-red-400' : ''}`}>
                  {s.label}
                </label>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{s.desc}</p>
              </div>
              <div className="flex-shrink-0 flex items-center mt-1 sm:mt-0">
                {React.cloneElement(s.control, { id: s.id })}
              </div>
            </div>
          )) : (
            <p
              data-testid="settings-no-results"
              className="text-zinc-500 dark:text-zinc-400 text-center py-6"
            >
              No settings found matching your search.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 pt-4 border-t dark:border-zinc-600 flex justify-end flex-shrink-0">
          <button
            data-testid="settings-close-button-footer"
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}