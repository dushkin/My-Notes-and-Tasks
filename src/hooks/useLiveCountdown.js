import { useState, useEffect } from 'react';
import { formatRemainingTime } from '../utils/reminderUtils';

/**
 * Custom hook for live countdown that updates every second
 * @param {number} timestamp - The target timestamp
 * @returns {string} The formatted remaining time string
 */
export const useLiveCountdown = (timestamp) => {
  const [timeString, setTimeString] = useState(() => formatRemainingTime(timestamp));

  useEffect(() => {
    if (!timestamp) return;

    const updateCountdown = () => {
      const newTimeString = formatRemainingTime(timestamp);
      setTimeString(newTimeString);
      
      // If time is up, we can stop updating (though the component might handle this)
      const timestampMs = typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp;
      if (timestampMs <= Date.now()) {
        return false; // Indicate we should stop
      }
      return true; // Continue updating
    };

    // Update immediately
    updateCountdown();

    // Set up interval to update every second
    const intervalId = setInterval(() => {
      const shouldContinue = updateCountdown();
      if (!shouldContinue) {
        clearInterval(intervalId);
      }
    }, 1000);

    // Cleanup function
    return () => clearInterval(intervalId);
  }, [timestamp]);

  return timeString;
};

/**
 * Custom hook for multiple live countdowns
 * @param {Object} reminders - Object with itemId as key and reminder object as value
 * @returns {Object} Object with itemId as key and formatted time string as value
 */
export const useLiveCountdowns = (reminders) => {
  const [countdowns, setCountdowns] = useState({});

  useEffect(() => {
    if (!reminders || Object.keys(reminders).length === 0) {
      setCountdowns({});
      return;
    }

    const updateAllCountdowns = () => {
      const newCountdowns = {};
      let hasActiveReminders = false;

      Object.entries(reminders).forEach(([itemId, reminder]) => {
        if (reminder && reminder.timestamp) {
          newCountdowns[itemId] = formatRemainingTime(reminder.timestamp);
          const timestampMs = typeof reminder.timestamp === 'string' ? new Date(reminder.timestamp).getTime() : reminder.timestamp;
          if (timestampMs > Date.now()) {
            hasActiveReminders = true;
          }
        }
      });

      setCountdowns(newCountdowns);
      return hasActiveReminders;
    };

    // Update immediately
    updateAllCountdowns();

    // Set up interval to update every second
    const intervalId = setInterval(() => {
      const hasActive = updateAllCountdowns();
      if (!hasActive) {
        // Still keep updating in case new reminders are added
        // The parent component will handle cleanup
      }
    }, 1000);

    // Cleanup function
    return () => clearInterval(intervalId);
  }, [reminders]);

  return countdowns;
};
