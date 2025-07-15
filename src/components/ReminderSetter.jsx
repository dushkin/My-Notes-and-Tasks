import React, { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const ReminderSetter = ({ onSetReminder }) => {
  const [reminderType, setReminderType] = useState("specific"); // 'specific' or 'relative'
  const [specificDateTime, setSpecificDateTime] = useState(null);
  const [relativeValue, setRelativeValue] = useState("");
  const [relativeUnit, setRelativeUnit] = useState("minutes");
  const [isRepeating, setIsRepeating] = useState(false); // State for repeating reminders
  const [repeatInterval, setRepeatInterval] = useState(1); // Default repeat interval
  const [repeatUnit, setRepeatUnit] = useState("days"); // Default repeat unit

  useEffect(() => {
    // Set a default specific date/time to 15 minutes from now
    const defaultDate = new Date();
    defaultDate.setMinutes(defaultDate.getMinutes() + 15);
    setSpecificDateTime(defaultDate);
  }, []);

  useEffect(() => {
    let calculatedTime = null;
    if (reminderType === "specific" && specificDateTime) {
      calculatedTime = specificDateTime.getTime();
    } else if (reminderType === "relative" && relativeValue) {
      const now = new Date();
      let milliseconds = 0;
      const value = parseInt(relativeValue, 10);
      if (isNaN(value)) {
        calculatedTime = null;
      } else {
        switch (relativeUnit) {
          case "seconds":
            milliseconds = value * 1000;
            break;
          case "minutes":
            milliseconds = value * 60 * 1000;
            break;
          case "hours":
            milliseconds = value * 60 * 60 * 1000;
            break;
          case "days":
            milliseconds = value * 24 * 60 * 60 * 1000;
            break;
          default:
            break;
        }
        calculatedTime = now.getTime() + milliseconds;
      }
    }
    
    // Pass both time and repeat options to the parent
    const repeatOptions = isRepeating ? { interval: repeatInterval, unit: repeatUnit } : null;
    onSetReminder(calculatedTime, repeatOptions);
  }, [reminderType, specificDateTime, relativeValue, relativeUnit, isRepeating, repeatInterval, repeatUnit, onSetReminder]);

  return (
    <div className="mt-4 p-4 border border-gray-200 dark:border-zinc-600 rounded-lg bg-gray-50 dark:bg-zinc-800/50 shadow-sm">
      <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100 flex items-center">
        <span className="mr-2">⏰</span>
        Set Reminder
      </h3>
      
      <div className="flex items-center mb-4 space-x-6">
        <label className="flex items-center cursor-pointer">
          <input
            type="radio"
            value="specific"
            checked={reminderType === "specific"}
            onChange={() => setReminderType("specific")}
            className="mr-2 text-blue-600 focus:ring-blue-500 focus:ring-2"
          />
          <span className="text-gray-700 dark:text-gray-300 font-medium">Specific Date & Time</span>
        </label>
        <label className="flex items-center cursor-pointer">
          <input
            type="radio"
            value="relative"
            checked={reminderType === "relative"}
            onChange={() => setReminderType("relative")}
            className="mr-2 text-blue-600 focus:ring-blue-500 focus:ring-2"
          />
          <span className="text-gray-700 dark:text-gray-300 font-medium">Relative Time</span>
        </label>
      </div>

      {reminderType === "specific" && (
        <div className="mb-4">
          <DatePicker
            selected={specificDateTime}
            onChange={(date) => setSpecificDateTime(date)}
            showTimeSelect
            dateFormat="Pp"
            className="w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-md text-gray-900 dark:text-gray-100 bg-white dark:bg-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholderText="Select date and time"
          />
        </div>
      )}

      {reminderType === "relative" && (
        <div className="flex space-x-3 mb-4">
          <input
            type="number"
            value={relativeValue}
            onChange={(e) => setRelativeValue(e.target.value)}
            placeholder="e.g., 15"
            className="flex-1 p-3 border border-gray-300 dark:border-zinc-600 rounded-md text-gray-900 dark:text-gray-100 bg-white dark:bg-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <select
            value={relativeUnit}
            onChange={(e) => setRelativeUnit(e.target.value)}
            className="flex-1 p-3 border border-gray-300 dark:border-zinc-600 rounded-md text-gray-900 dark:text-gray-100 bg-white dark:bg-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="seconds">Seconds</option>
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
      )}

      <div className="mb-4">
        <label className="flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={isRepeating}
            onChange={() => setIsRepeating(!isRepeating)}
            className="mr-3 text-blue-600 focus:ring-blue-500 focus:ring-2 rounded"
          />
          <span className="text-gray-700 dark:text-gray-300 font-medium">Repeat Reminder</span>
        </label>
      </div>

      {isRepeating && (
        <div className="flex space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <input
            type="number"
            value={repeatInterval}
            onChange={(e) => setRepeatInterval(parseInt(e.target.value) || 1)}
            placeholder="e.g., 1"
            min="1"
            className="flex-1 p-2 border border-gray-300 dark:border-zinc-600 rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <select
            value={repeatUnit}
            onChange={(e) => setRepeatUnit(e.target.value)}
            className="flex-1 p-2 border border-gray-300 dark:border-zinc-600 rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="seconds">Seconds</option>
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
          </select>
        </div>
      )}
    </div>
  );
};

export default ReminderSetter;
