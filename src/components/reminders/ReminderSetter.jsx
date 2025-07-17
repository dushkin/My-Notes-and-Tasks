import React, { useState, useEffect, useRef } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

const ReminderSetter = ({ onSetReminder, showEnableToggle = true }) => {
  const [reminderType, setReminderType] = useState("specific"); // 'specific' or 'relative'
  const [specificDateTime, setSpecificDateTime] = useState(null);
  const [relativeValue, setRelativeValue] = useState("");
  const [relativeUnit, setRelativeUnit] = useState("minutes");
  const [isRepeating, setIsRepeating] = useState(false); // State for repeating reminders
  const [repeatInterval, setRepeatInterval] = useState(1); // Default repeat interval
  const [repeatUnit, setRepeatUnit] = useState("days"); // Default repeat unit
  const [enableReminder, setEnableReminder] = useState(!showEnableToggle);

  // Ref for debouncing
  const debounceRef = useRef(null);

  useEffect(() => {
    // Only calculate and set reminder when user has enabled reminder and made explicit choices
    let calculatedTime = null;

    if (enableReminder) {
      if (reminderType === "specific" && specificDateTime) {
        calculatedTime = specificDateTime.getTime();
      } else if (reminderType === "relative" && relativeValue) {
        // Use high precision timing for better accuracy
        const now = Date.now(); // Use Date.now() for better precision
        let milliseconds = 0;
        const value = parseInt(relativeValue, 10);
        if (isNaN(value) || value <= 0) {
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
            case "weeks":
              milliseconds = value * 7 * 24 * 60 * 60 * 1000;
              break;
            case "months":
              milliseconds = value * 30 * 24 * 60 * 60 * 1000;
              break;
            case "years":
              milliseconds = value * 365 * 24 * 60 * 60 * 1000;
              break;
            default:
              break;
          }
          calculatedTime = `relative:${milliseconds}`;
        }
      }
    }

    // Only call onSetReminder if we have a valid calculated time
    if (calculatedTime !== null) {
      const repeatOptions = isRepeating ? {
        interval: repeatInterval,
        unit: repeatUnit
      } : null;
      onSetReminder(calculatedTime, repeatOptions);
    } else {
      // Clear reminder if disabled or invalid
      onSetReminder(null);
    }
  }, [enableReminder, reminderType, specificDateTime, relativeValue, relativeUnit, isRepeating, repeatInterval, repeatUnit, onSetReminder]);

  return ( <
    div className = "mt-4 p-4 border border-gray-200 dark:border-zinc-600 rounded-lg bg-gray-50 dark:bg-zinc-800/50 shadow-sm overflow-hidden" > {
      showEnableToggle && ( <
        div className = "mb-4" >
        <
        label className = "flex items-center cursor-pointer" >
        <
        input type = "checkbox"
        checked = {
          enableReminder
        }
        onChange = {
          (e) => {
            e.stopPropagation(); // Prevent event bubbling
            setEnableReminder(!enableReminder);
          }
        }
        onClick = {
          (e) => e.stopPropagation()
        } // Prevent click from bubbling to form
        className = "mr-3 text-blue-600 focus:ring-blue-500 focus:ring-2 rounded" /
        >
        <
        span className = "text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center" >
        <
        span className = "mr-2" > ⏰ < /span>
        Set Reminder <
        /span> <
        /label> <
        /div>
      )
    }

    {
      enableReminder && ( <
        >
        <
        div className = "flex flex-wrap items-center mb-4 gap-4" >
        <
        label className = "flex items-center cursor-pointer whitespace-nowrap" >
        <
        input type = "radio"
        value = "specific"
        checked = {
          reminderType === "specific"
        }
        onChange = {
          (e) => {
            e.stopPropagation(); // Prevent event bubbling
            setReminderType("specific");
          }
        }
        onClick = {
          (e) => e.stopPropagation()
        } // Prevent click from bubbling to form
        className = "mr-2 text-blue-600 focus:ring-blue-500 focus:ring-2" /
        >
        <
        span className = "text-gray-700 dark:text-gray-300 font-medium" > Specific Date & Time < /span> <
        /label> <
        label className = "flex items-center cursor-pointer whitespace-nowrap" >
        <
        input type = "radio"
        value = "relative"
        checked = {
          reminderType === "relative"
        }
        onChange = {
          (e) => {
            e.stopPropagation(); // Prevent event bubbling
            setReminderType("relative");
          }
        }
        onClick = {
          (e) => e.stopPropagation()
        } // Prevent click from bubbling to form
        className = "mr-2 text-blue-600 focus:ring-blue-500 focus:ring-2" /
        >
        <
        span className = "text-gray-700 dark:text-gray-300 font-medium" > Relative Time < /span> <
        /label> <
        /div>

        {
          reminderType === "specific" && ( <
            div className = "mb-4" >
            <
            DatePicker selected = {
              specificDateTime
            }
            onChange = {
              (date) => setSpecificDateTime(date)
            }
            showTimeSelect
        showTimeSelectMinutes
        timeIntervals={1} dateFormat = "Pp"
            className = "w-full p-3 border border-gray-300 dark:border-zinc-600 rounded-md text-gray-900 dark:text-gray-100 bg-white dark:bg-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholderText = "Select date and time" /
            >
            <
            /div>
          )
        }

        {
          reminderType === "relative" && ( <
            div className = "flex space-x-3 mb-4 max-w-full" >
            <
            input type = "number"
            value = {
              relativeValue
            }
            onChange = {
              (e) => setRelativeValue(e.target.value)
            }
            placeholder = "e.g., 15"
            className = "flex-1 min-w-0 p-3 border border-gray-300 dark:border-zinc-600 rounded-md text-gray-900 dark:text-gray-100 bg-white dark:bg-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" /
            >
            <
            select value = {
              relativeUnit
            }
            onChange = {
              (e) => setRelativeUnit(e.target.value)
            }
            className = "flex-1 min-w-0 max-w-[120px] p-3 border border-gray-300 dark:border-zinc-600 rounded-md text-gray-900 dark:text-gray-100 bg-white dark:bg-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" >
            <
            option value = "seconds" > Seconds < /option> <
            option value = "minutes" > Minutes < /option> <
            option value = "hours" > Hours < /option> <
            option value = "days" > Days < /option> <
            option value = "weeks" > Weeks < /option> <
            option value = "months" > Months < /option> <
            option value = "years" > Years < /option> <
            /select> <
            /div>
          )
        }

        <
        div className = "mb-4" >
        <
        label className = "flex items-center cursor-pointer" >
        <
        input type = "checkbox"
        checked = {
          isRepeating
        }
        onChange = {
          (e) => {
            e.stopPropagation(); // Prevent event bubbling
            setIsRepeating(!isRepeating);
          }
        }
        onClick = {
          (e) => e.stopPropagation()
        } // Prevent click from bubbling to form
        className = "mr-3 text-blue-600 focus:ring-blue-500 focus:ring-2 rounded" /
        >
        <
        span className = "text-gray-700 dark:text-gray-300 font-medium" > Repeat Reminder < /span> <
        /label> <
        /div>

        {
          isRepeating && ( <
            div className = "flex space-x-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md max-w-full overflow-hidden" >
            <
            input type = "number"
            value = {
              repeatInterval
            }
            onChange = {
              (e) => setRepeatInterval(parseInt(e.target.value) || 1)
            }
            placeholder = "e.g., 1"
            min = "1"
            className = "flex-1 min-w-0 p-2 border border-gray-300 dark:border-zinc-600 rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" /
            >
            <
            select value = {
              repeatUnit
            }
            onChange = {
              (e) => setRepeatUnit(e.target.value)
            }
            className = "flex-1 min-w-0 max-w-[120px] p-2 border border-gray-300 dark:border-zinc-600 rounded text-gray-900 dark:text-gray-100 bg-white dark:bg-zinc-700 focus:ring-2 focus:ring-blue-500 focus:border-blue-500" >
            <
            option value = "seconds" > Seconds < /option> <
            option value = "minutes" > Minutes < /option> <
            option value = "hours" > Hours < /option> <
            option value = "days" > Days < /option> <
            option value = "weeks" > Weeks < /option> <
            option value = "months" > Months < /option> <
            option value = "years" > Years < /option> <
            /select> <
            /div>
          )
        } <
        />
      )
    } <
    /div>
  );
};

export default ReminderSetter;