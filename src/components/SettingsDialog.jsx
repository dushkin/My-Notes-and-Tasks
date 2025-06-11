// src/components/SettingsDialog.jsx
import React, { useState, useMemo, useEffect, useRef } from "react";
import { X, Search, RotateCcw, AlertTriangle } from "lucide-react";
import {
  useSettings,
  defaultSettings,
  themeOptions,
  exportFormatOptions,
  editorFontFamilyOptions,
  editorFontSizeOptions,
} from "../contexts/SettingsContext";
import ConfirmDialog from "./ConfirmDialog";

function valueLabel(setting, currentSettings) {
  const v = currentSettings[setting.id];
  if (typeof v === "boolean") return v ? "Enabled" : "Disabled";
  if (setting.options) {
    const o = setting.options.find((opt) => opt.value === v);
    if (o) return o.label;
  }
  if (setting.id === "defaultExportFormat") {
    const o = exportFormatOptions.find((opt) => opt.value === v);
    if (o) return o.label;
  }
  if (setting.id === "autoExportIntervalMinutes")
    return v ? `${v} minutes` : "Not set";

  return String(v);
}

export default function SettingsDialog({ isOpen, onClose }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (isOpen && containerRef.current) {
      setTimeout(() => {
        containerRef.current.focus();
      }, 0);
    }
  }, [isOpen]);

  const handleKeyDown = (e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      e.preventDefault();
      onClose();
    }
  };

  let context;
  try {
    context = useSettings();
  } catch {
    context = {
      settings: defaultSettings,
      updateSetting: () => {},
      resetSettings: () => {},
      resetApplicationData: () => {},
    };
  }
  const { settings, updateSetting, resetSettings, resetApplicationData } =
    context;
  const [search, setSearch] = useState("");

  // Whenever the dialog closes, reset search back to empty
  useEffect(() => {
    if (!isOpen) {
      setSearch("");
    }
  }, [isOpen]);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    onCancel: () => {},
    variant: "default",
    confirmText: "Confirm",
    cancelText: "Cancel",
  });

  const showConfirm = (options) => {
    setConfirmDialog({
      isOpen: true,
      title: options.title || "Confirm",
      message: options.message || "Are you sure?",
      onConfirm: options.onConfirm || (() => {}),
      onCancel:
        options.onCancel ||
        (() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))),
      variant: options.variant || "default",
      confirmText: options.confirmText || "Confirm",
      cancelText: options.cancelText || "Cancel",
    });
  };

  const allSettingsDescriptors = useMemo(
    () => [
      {
        id: "theme",
        label: "Theme",
        desc: "Select the application color scheme.",
        options: themeOptions,
        control: (
          <select
            id="theme"
            data-item-id="setting-theme-select"
            value={settings.theme}
            onChange={(e) => updateSetting("theme", e.target.value)}
            className="p-1 border rounded bg-white dark:bg-zinc-700 dark:border-zinc-600 min-w-[150px]"
          >
            {themeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ),
      },
      {
        id: "autoExpandNewFolders",
        label: "Auto-Expand New Folders",
        desc: "Automatically expand parent folders when adding a new item.",
        control: (
          <input
            id="autoExpandNewFolders"
            type="checkbox"
            data-item-id="setting-autoexpand-checkbox"
            checked={!!settings.autoExpandNewFolders}
            onChange={(e) =>
              updateSetting("autoExpandNewFolders", e.target.checked)
            }
            className="form-checkbox h-5 w-5 text-blue-600 rounded cursor-pointer"
          />
        ),
      },
      {
        id: "editorFontFamily",
        label: "Default Editor Font",
        desc: "Default font family for the note/task editor.",
        options: editorFontFamilyOptions,
        control: (
          <select
            id="editorFontFamily"
            data-item-id="setting-fontfamily-select"
            value={settings.editorFontFamily}
            onChange={(e) => updateSetting("editorFontFamily", e.target.value)}
            className="p-1 border rounded bg-white dark:bg-zinc-700 dark:border-zinc-600 min-w-[150px]"
          >
            {editorFontFamilyOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ),
      },
      {
        id: "editorFontSize",
        label: "Default Editor Font Size",
        desc: "Default font size for the note/task editor.",
        options: editorFontSizeOptions,
        control: (
          <select
            id="editorFontSize"
            data-item-id="setting-fontsize-select"
            value={settings.editorFontSize}
            onChange={(e) => updateSetting("editorFontSize", e.target.value)}
            className="p-1 border rounded bg-white dark:bg-zinc-700 dark:border-zinc-600 min-w-[150px]"
          >
            {editorFontSizeOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ),
      },
      {
        id: "defaultExportFormat",
        label: "Default Export Format",
        desc: "Pre-selected format when exporting items or the tree.",
        control: (
          <div className="flex space-x-3">
            {exportFormatOptions.map((o) => (
              <label
                key={o.value}
                className="flex items-center space-x-1 cursor-pointer"
              >
                <input
                  type="radio"
                  name="defaultExportFormat"
                  data-item-id={`setting-exportformat-${o.value}`}
                  value={o.value}
                  checked={settings.defaultExportFormat === o.value}
                  onChange={(e) =>
                    updateSetting("defaultExportFormat", e.target.value)
                  }
                  className="form-radio text-blue-600 cursor-pointer"
                />
                <span>{o.label}</span>
              </label>
            ))}
          </div>
        ),
      },
      {
        id: "autoExportGroup",
        type: "group",
        label: "Automatic Backup (Auto Export)",
        desc: "Configure periodic automatic export of the entire tree. Exports trigger standard browser downloads.",
        settings: [
          {
            id: "autoExportEnabled",
            label: "Enable Auto Export",
            desc: "Toggle automatic background tree exports.",
            control: (
              <input
                id="autoExportEnabled"
                type="checkbox"
                data-item-id="setting-autoexportenabled-checkbox"
                checked={!!settings.autoExportEnabled}
                onChange={(e) =>
                  updateSetting("autoExportEnabled", e.target.checked)
                }
                className="form-checkbox h-5 w-5 text-blue-600 rounded cursor-pointer"
              />
            ),
          },
          {
            id: "autoExportIntervalMinutes",
            label: "Export Interval",
            desc: "In minutes (minimum 5).",
            control: (
              <input
                id="autoExportIntervalMinutes"
                type="number"
                data-item-id="setting-autoexportinterval-input"
                value={settings.autoExportIntervalMinutes || 30}
                onChange={(e) =>
                  updateSetting(
                    "autoExportIntervalMinutes",
                    Math.max(5, parseInt(e.target.value, 10) || 5)
                  )
                }
                className="p-1 border rounded bg-white dark:bg-zinc-700 dark:border-zinc-600 w-24 text-center"
                min="5"
                step="1"
              />
            ),
          },
        ],
      },
      {
        id: "resetSettings",
        label: "Reset Settings",
        desc: "Reset all settings to their default values.",
        control: (
          <button
            type="button"
            data-item-id="setting-resetsettings-button"
            onClick={() => {
              showConfirm({
                title: "Reset Settings",
                message: "Reset all settings to default values?",
                variant: "warning",
                confirmText: "Reset",
                onConfirm: () => {
                  resetSettings();
                  setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                },
                onCancel: () =>
                  setConfirmDialog((prev) => ({ ...prev, isOpen: false })),
              });
            }}
            className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600 flex items-center"
          >
            <RotateCcw className="w-4 h-4 mr-1" /> Reset
          </button>
        ),
      },
      {
        id: "resetData",
        label: "Reset Application Data",
        desc: "WARNING: Deletes all notes, tasks, folders, and resets settings. Requires manual tree data clearing.",
        control: (
          <button
            type="button"
            data-item-id="setting-resetdata-button"
            onClick={() => {
              showConfirm({
                title: "Reset Application Data",
                message:
                  "WARNING: This will permanently delete all application data (including settings and potentially tree data if not cleared separately). Are you sure?",
                variant: "danger",
                confirmText: "Reset All Data",
                onConfirm: () => {
                  resetApplicationData();
                  setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
                },
                onCancel: () =>
                  setConfirmDialog((prev) => ({ ...prev, isOpen: false })),
              });
            }}
            className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 flex items-center"
          >
            <AlertTriangle className="w-4 h-4 mr-1" /> Reset All Data
          </button>
        ),
      },
    ],
    [
      settings.autoExportEnabled,
      settings.autoExportIntervalMinutes,
      settings.theme,
      settings.autoExpandNewFolders,
      settings.editorFontFamily,
      settings.editorFontSize,
      settings.defaultExportFormat,
      updateSetting,
      resetSettings,
      resetApplicationData,
      showConfirm,
    ]
  );

  const filteredSettings = useMemo(() => {
    if (!search) return allSettingsDescriptors;
    const term = search.toLowerCase();
    return allSettingsDescriptors.filter((s) => {
      if (s.type === "group") {
        if (
          s.label.toLowerCase().includes(term) ||
          (s.desc && s.desc.toLowerCase().includes(term))
        ) {
          return true;
        }
        return s.settings.some(
          (sub) =>
            sub.label.toLowerCase().includes(term) ||
            (sub.desc && sub.desc.toLowerCase().includes(term)) ||
            valueLabel(sub, settings).toLowerCase().includes(term)
        );
      } else {
        return (
          s.label.toLowerCase().includes(term) ||
          (s.desc && s.desc.toLowerCase().includes(term)) ||
          valueLabel(s, settings).toLowerCase().includes(term)
        );
      }
    });
  }, [allSettingsDescriptors, search, settings]);

  if (!isOpen) return null;

  return (
    <>
      <div
        ref={containerRef} tabIndex={0} onKeyDown={handleKeyDown} data-item-id="settings-dialog-overlay"
        className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 backdrop-blur-sm transition-opacity duration-200"
      >
        <div
          data-item-id="settings-dialog-content"
          className="bg-white dark:bg-zinc-800 p-5 rounded-lg shadow-xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-zinc-200 dark:border-zinc-700"
        >
          <div className="flex justify-between items-center mb-4 border-b pb-3 dark:border-zinc-600 flex-shrink-0">
            <h2 className="text-xl font-semibold">Settings</h2>
            <button
              onClick={onClose}
              aria-label="Close Settings"
              data-item-id="settings-close-button-header"
              className="p-1 rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="mb-4 relative flex-shrink-0">
            <input
              data-item-id="settings-search-input"
              type="text"
              placeholder="Search settings..."
              value={search ?? ""}
              onChange={(e) => setSearch(e.target.value ?? "")}
              className="w-full p-2 pl-10 border rounded dark:bg-zinc-700 dark:border-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Search className="w-5 h-5 text-zinc-400 absolute left-3 top-1/2 transform -translate-y-1/2 pointer-events-none" />
          </div>
          <div className="flex-grow overflow-y-auto space-y-3 pr-2 -mr-2 custom-scrollbar">
            {filteredSettings.length ? (
              filteredSettings.map((s) => {
                if (s.type === "group") {
                  // Check if the group's controlling setting (autoExportEnabled) is active
                  const isGroupContentDisabled =
                    s.settings.find((sub) => sub.id === "autoExportEnabled") &&
                    !settings.autoExportEnabled;

                  return (
                    <div
                      key={s.id}
                      data-item-id={`setting-group-${s.id}`}
                      className="p-4 my-3 border border-zinc-300 dark:border-zinc-600 rounded-lg shadow-sm bg-zinc-50 dark:bg-zinc-800/30"
                    >
                      <h4 className="text-md font-semibold mb-1 text-zinc-700 dark:text-zinc-200">
                        {s.label}
                      </h4>
                      {s.desc && (
                        <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">
                          {s.desc}
                        </p>
                      )}
                      <div className="space-y-5">
                        {s.settings.map((subSetting) => {
                          const isControlDisabledByGroupLogic =
                            subSetting.id !== "autoExportEnabled" &&
                            isGroupContentDisabled;
                          const finalDisabledState =
                            (subSetting.control.props &&
                              subSetting.control.props.disabled) ||
                            isControlDisabledByGroupLogic;

                          return (
                            <div
                              key={subSetting.id}
                              data-item-id={`setting-row-${subSetting.id}`}
                              className="flex flex-col sm:flex-row sm:items-start sm:justify-between pb-4 border-b border-zinc-200 dark:border-zinc-600 last:border-b-0 last:pb-0"
                            >
                              <div
                                className={`mb-2 sm:mb-0 sm:mr-4 flex-1 ${
                                  finalDisabledState ? "opacity-60" : ""
                                }`}
                              >
                                <div className="font-medium block">
                                  {subSetting.label}
                                </div>
                                {subSetting.desc && (
                                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                    {subSetting.desc}
                                  </p>
                                )}
                              </div>
                              <div className="flex-shrink-0 flex items-center mt-1 sm:mt-0">
                                {React.cloneElement(subSetting.control, {
                                  id: subSetting.id,
                                  disabled: finalDisabledState,
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                } else {
                  // Render individual, non-grouped settings
                  return (
                    <div
                      key={s.id}
                      data-item-id={`setting-row-${s.id}`}
                      className="flex flex-col sm:flex-row sm:items-start sm:justify-between pb-4 border-b border-zinc-200 dark:border-zinc-700 last:border-b-0"
                    >
                      <div className="mb-2 sm:mb-0 sm:mr-4 flex-1">
                        <div
                          className={`font-medium block ${
                            s.id === "resetData"
                              ? "text-red-600 dark:text-red-400"
                              : ""
                          }`}
                        >
                          {s.label}
                        </div>
                        <p className="text-sm text-zinc-600 dark:text-zinc-400">
                          {s.desc}
                        </p>
                      </div>
                      <div className="flex-shrink-0 flex items-center mt-1 sm:mt-0">
                        {React.cloneElement(s.control, { id: s.id })}
                      </div>
                    </div>
                  );
                }
              })
            ) : (
              <p
                data-item-id="settings-no-results"
                className="text-zinc-500 dark:text-zinc-400 text-center py-6"
              >
                No settings found matching your search.
              </p>
            )}
          </div>
          <div className="mt-6 pt-4 border-t dark:border-zinc-600 flex justify-end flex-shrink-0">
            <button
              data-item-id="settings-close-button-footer"
              onClick={onClose}
              className="px-5 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Close
            </button>
          </div>
        </div>
      </div>
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel}
      />
    </>
  );
}
