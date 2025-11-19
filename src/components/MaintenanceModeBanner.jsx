import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

/**
 * MaintenanceModeBanner - A dismissible banner to inform users about the project status
 *
 * Features:
 * - Shows project is in minimal maintenance mode
 * - Links to GitHub for self-hosting
 * - Dismissible with localStorage persistence
 * - Responsive design
 * - Can be easily enabled/disabled via environment variable
 */
export default function MaintenanceModeBanner() {
  const [isVisible, setIsVisible] = useState(false);

  // Check if maintenance mode is enabled via environment variable
  const maintenanceModeEnabled = import.meta.env.VITE_MAINTENANCE_MODE === 'true';

  useEffect(() => {
    // Only show if:
    // 1. Maintenance mode is enabled
    // 2. User hasn't dismissed it before
    const dismissed = localStorage.getItem('maintenanceBannerDismissed');
    if (maintenanceModeEnabled && !dismissed) {
      setIsVisible(true);
    }
  }, [maintenanceModeEnabled]);

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('maintenanceBannerDismissed', 'true');
  };

  if (!isVisible) return null;

  return (
    <div className="relative bg-gradient-to-r from-blue-50 to-purple-50 border-b border-blue-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex-1 flex items-center gap-3 min-w-0">
            <div className="flex-shrink-0">
              <span className="text-2xl">ℹ️</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-800">
                <span className="font-semibold">Minimal Maintenance Mode:</span>{' '}
                <span className="hidden sm:inline">
                  This project is currently in minimal maintenance mode.
                  The app remains fully functional and free to use.
                </span>
                <a
                  href="https://github.com/yourusername/notask"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline font-medium"
                >
                  View on GitHub
                </a>
                {' '}for self-hosting instructions or to contribute.
              </p>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-1 rounded-md hover:bg-blue-100 transition-colors duration-200"
            aria-label="Dismiss banner"
          >
            <X className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Usage:
 *
 * 1. Add to App.jsx or MainApp.jsx:
 *
 * import MaintenanceModeBanner from './components/MaintenanceModeBanner';
 *
 * function App() {
 *   return (
 *     <>
 *       <MaintenanceModeBanner />
 *       {/* rest of your app *\/}
 *     </>
 *   );
 * }
 *
 * 2. Enable via environment variable in .env:
 * VITE_MAINTENANCE_MODE=true
 *
 * 3. To disable, simply set to false or remove the variable:
 * VITE_MAINTENANCE_MODE=false
 *
 * 4. Users can dismiss the banner, and it won't show again (stored in localStorage)
 *
 * 5. To reset dismissal (for testing):
 * localStorage.removeItem('maintenanceBannerDismissed')
 */
