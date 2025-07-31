import React, { useState, useEffect } from 'react';
import { X, Clock, CheckCircle, AlarmClock } from 'lucide-react';
import LoadingButton from '../ui/LoadingButton';

const MobileReminderPopup = ({ 
  isVisible, 
  title, 
  message, 
  onDismiss, 
  onMarkDone, 
  onSnooze,
  showDoneButton = true,
  autoHideDelay = 10000 // 10 seconds default
}) => {
  // We only track progress for the auto‑hide countdown. The jump animation has
  // been removed in favor of a simple slide-down effect.
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    if (isVisible) {
      setProgress(100);
      // Start countdown for auto-hide
      const startTime = Date.now();
      const progressTimer = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const remaining = Math.max(0, autoHideDelay - elapsed);
        const newProgress = (remaining / autoHideDelay) * 100;
        setProgress(newProgress);
        if (remaining <= 0) {
          clearInterval(progressTimer);
          onDismiss();
        }
      }, 100);
      return () => {
        clearInterval(progressTimer);
      };
    }
  }, [isVisible, autoHideDelay, onDismiss]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex justify-center items-center px-2 py-2 pointer-events-none">
      {/* Popup Card */}
      <div
        className={`
          relative bg-white dark:bg-zinc-900 shadow-xl
          rounded-2xl w-full max-w-2xl max-h-[80vh] pointer-events-auto transform transition-transform duration-300
        `}
        style={{
          animation: 'popIn 0.3s ease-out'
        }}
      >
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-zinc-200 dark:bg-zinc-700 rounded-t-2xl overflow-hidden">
          <div 
            className="h-full bg-red-500 dark:bg-red-400 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between p-4 pb-2">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-red-500 dark:bg-red-400 rounded-full flex items-center justify-center animate-pulse">
              <Clock className="w-4 h-4 text-white" />
            </div>
            <h3 className="text-lg font-bold text-red-600 dark:text-red-400">
              {title || '⏰ Reminder'}
            </h3>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Dismiss reminder"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Message */}
        <div className="px-4 pb-4">
          <p className="text-zinc-800 dark:text-zinc-200 text-base font-medium">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-2 p-4 pt-2">
          {showDoneButton && (
            <LoadingButton
              onClick={onMarkDone}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
              variant="primary"
            >
              <CheckCircle className="w-4 h-4" />
              Done
            </LoadingButton>
          )}
          <LoadingButton
            onClick={() => onSnooze(5, 'minutes')}
            className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors"
            variant="secondary"
          >
            <AlarmClock className="w-4 h-4" />
            5min
          </LoadingButton>
        </div>

        {/* Quick snooze options */}
        <div className="px-4 pb-4">
          <div className="flex gap-2 text-sm">
            <button
              onClick={() => onSnooze(1, 'minutes')}
              className="flex-1 py-2 px-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              1min
            </button>
            <button
              onClick={() => onSnooze(10, 'minutes')}
              className="flex-1 py-2 px-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              10min
            </button>
            <button
              onClick={() => onSnooze(30, 'minutes')}
              className="flex-1 py-2 px-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              30min
            </button>
            <button
              onClick={() => onSnooze(1, 'hours')}
              className="flex-1 py-2 px-3 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
            >
              1hr
            </button>
          </div>
        </div>
      </div>

      {/* Custom keyframes for pop-in animation */}
      <style jsx>{`
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.9); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
};

export default MobileReminderPopup;