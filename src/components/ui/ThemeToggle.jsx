import React from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useSettings } from "../../contexts/SettingsContext";

const ThemeToggle = ({ className = "", size = "medium", showLabel = false }) => {
  const { settings, updateSetting } = useSettings();
  
  const themes = [
    { value: "light", icon: Sun, label: "Light" },
    { value: "dark", icon: Moon, label: "Dark" },
    { value: "system", icon: Monitor, label: "System" },
  ];

  const currentThemeIndex = themes.findIndex(theme => theme.value === settings.theme);
  const currentTheme = themes[currentThemeIndex];

  const toggleTheme = () => {
    const nextIndex = (currentThemeIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    updateSetting("theme", nextTheme.value);
  };

  const sizeClasses = {
    small: "w-4 h-4",
    medium: "w-5 h-5",
    large: "w-6 h-6"
  };

  const buttonSizeClasses = {
    small: "p-1.5",
    medium: "p-2",
    large: "p-2.5"
  };

  const IconComponent = currentTheme.icon;

  return (
    <button
      onClick={toggleTheme}
      className={`text-zinc-600 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-full transition-colors duration-200 ${buttonSizeClasses[size]} ${className}`}
      title={`Current theme: ${currentTheme.label}. Click to cycle themes.`}
      aria-label={`Toggle theme. Current: ${currentTheme.label}`}
    >
      <div className="flex items-center gap-2">
        <IconComponent className={sizeClasses[size]} />
        {showLabel && (
          <span className="text-sm font-medium">{currentTheme.label}</span>
        )}
      </div>
    </button>
  );
};

export default ThemeToggle;