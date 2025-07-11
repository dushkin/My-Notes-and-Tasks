import React, { useState, useEffect, useCallback, useRef } from "react";
import { X, Bell, Calendar, Clock, Repeat } from "lucide-react";
import { useFocusTrap } from "../hooks/useFocusTrap";
import LoadingButton from "./LoadingButton";

const ReminderDialog = ({ isOpen, onClose, onSave, task }) => {
  const [reminderType, setReminderType] = useState("datetime");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [relativeValue, setRelativeValue] = useState(30);
  const [relativeUnit, setRelativeUnit] = useState("minutes");
  const [repeatFrequency, setRepeatFrequency] = useState("none");
  const [isSaving, setIsSaving] = useState(false);

  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, isOpen);

  const getLocalDateForInput = (isoDate) => {
    if (!isoDate) return "";
    const d = new Date(isoDate);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  };

  const getLocalTimeForInput = (isoDate) => {
    if (!isoDate) return "";
    const d = new Date(isoDate);
    return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    if (isOpen && task?.reminder?.dueAt) {
      const reminder = task.reminder;
      setDate(getLocalDateForInput(reminder.dueAt));
      setTime(getLocalTimeForInput(reminder.dueAt));
      setRepeatFrequency(reminder.repeat?.frequency || "none");
      setReminderType("datetime");
    } else if (isOpen) {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 30); // Default to 30 mins from now

      const year = now.getFullYear();
      const month = (now.getMonth() + 1).toString().padStart(2, "0");
      const day = now.getDate().toString().padStart(2, "0");
      const hours = now.getHours().toString().padStart(2, "0");
      const minutes = now.getMinutes().toString().padStart(2, "0");
      
      setDate(`${year}-${month}-${day}`);
      setTime(`${hours}:${minutes}`);
      setRepeatFrequency("none");
      setReminderType("datetime");
    }
  }, [isOpen, task]);

  const handleSave = async () => {
    setIsSaving(true);
    let dueAt;
    if (reminderType === "datetime") {
      if (!date || !time) {
        alert("Please select a valid date and time.");
        setIsSaving(false);
        return;
      }
      dueAt = new Date(`${date}T${time}:00`).toISOString();
    } else {
      const now = new Date();
      switch (relativeUnit) {
        case "seconds": now.setSeconds(now.getSeconds() + relativeValue); break;
        case "minutes": now.setMinutes(now.getMinutes() + relativeValue); break;
        case "hours": now.setHours(now.getHours() + relativeValue); break;
        case "days": now.setDate(now.getDate() + relativeValue); break;
        case "weeks": now.setDate(now.getDate() + relativeValue * 7); break;
        default: break;
      }
      dueAt = now.toISOString();
    }

    const reminderData = {
      isActive: true,
      dueAt,
      repeat: repeatFrequency !== "none" ? { frequency: repeatFrequency, interval: 1 } : null,
    };
    
    await onSave(task.id, reminderData);
    setIsSaving(false);
    onClose();
  };

  const handleRemoveReminder = async () => {
    setIsSaving(true);
    await onSave(task.id, { isActive: false, dueAt: null, repeat: null });
    setIsSaving(false);
    onClose();
  };
  
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
      <div ref={dialogRef} className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-xl w-full max-w-md border border-zinc-200 dark:border-zinc-700">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="w-5 h-5 text-blue-500" />
            Set Reminder
          </h2>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-700">
            <X className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
          </button>
        </div>

        <div className="space-y-4">
            {/* Reminder Type */}
            <div className="flex gap-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 p-1">
                <button onClick={() => setReminderType('datetime')} className={`flex-1 p-2 text-sm font-medium rounded-md transition-colors ${reminderType === 'datetime' ? 'bg-white dark:bg-zinc-700 shadow text-blue-600 dark:text-blue-300' : 'text-zinc-600 dark:text-zinc-300 hover:bg-white/50 dark:hover:bg-zinc-700/50'}`}>
                    Date & Time
                </button>
                <button onClick={() => setReminderType('relative')} className={`flex-1 p-2 text-sm font-medium rounded-md transition-colors ${reminderType === 'relative' ? 'bg-white dark:bg-zinc-700 shadow text-blue-600 dark:text-blue-300' : 'text-zinc-600 dark:text-zinc-300 hover:bg-white/50 dark:hover:bg-zinc-700/50'}`}>
                    Relative
                </button>
            </div>

            {/* Datetime Inputs */}
            {reminderType === 'datetime' && (
                <div className="grid grid-cols-2 gap-4">
                    <div className="relative">
                        <label htmlFor="reminder-date" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 absolute -top-2 left-2 bg-white dark:bg-zinc-800 px-1">Date</label>
                        <input id="reminder-date" type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full p-2 border rounded-md bg-white dark:bg-zinc-700 dark:border-zinc-600 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                    </div>
                    <div className="relative">
                        <label htmlFor="reminder-time" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 absolute -top-2 left-2 bg-white dark:bg-zinc-800 px-1">Time</label>
                        <input id="reminder-time" type="time" value={time} onChange={e => setTime(e.target.value)} className="w-full p-2 border rounded-md bg-white dark:bg-zinc-700 dark:border-zinc-600 focus:ring-2 focus:ring-blue-500 focus:outline-none" />
                    </div>
                </div>
            )}

            {/* Relative Time Inputs */}
            {reminderType === 'relative' && (
                <div className="flex items-center gap-4">
                    <span className="text-sm">Remind me in:</span>
                    <input type="number" value={relativeValue} onChange={e => setRelativeValue(parseInt(e.target.value, 10))} className="w-20 p-2 border rounded-md bg-white dark:bg-zinc-700 dark:border-zinc-600 focus:ring-2 focus:ring-blue-500 focus:outline-none text-center" />
                    <select value={relativeUnit} onChange={e => setRelativeUnit(e.target.value)} className="flex-1 p-2 border rounded-md bg-white dark:bg-zinc-700 dark:border-zinc-600 focus:ring-2 focus:ring-blue-500 focus:outline-none">
                        <option value="seconds">Seconds</option>
                        <option value="minutes">Minutes</option>
                        <option value="hours">Hours</option>
                        <option value="days">Days</option>
                        <option value="weeks">Weeks</option>
                    </select>
                </div>
            )}

            {/* Repeat Options */}
            <div className="relative">
                <label htmlFor="repeat-frequency" className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 absolute -top-2 left-2 bg-white dark:bg-zinc-800 px-1">Repeat</label>
                <select id="repeat-frequency" value={repeatFrequency} onChange={e => setRepeatFrequency(e.target.value)} className="w-full p-2 border rounded-md bg-white dark:bg-zinc-700 dark:border-zinc-600 focus:ring-2 focus:ring-blue-500 focus:outline-none">
                    <option value="none">Does not repeat</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                </select>
            </div>
        </div>

        <div className="mt-6 flex justify-between items-center gap-3">
            <div>
            {task?.reminder?.isActive && (
                <LoadingButton onClick={handleRemoveReminder} isLoading={isSaving} variant="danger" size="small">
                    Remove Reminder
                </LoadingButton>
            )}
            </div>
            <div className="flex gap-3">
                <button onClick={onClose} className="px-4 py-2 border rounded dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700">
                    Cancel
                </button>
                <LoadingButton onClick={handleSave} isLoading={isSaving} loadingText="Saving..." variant="primary">
                    Save
                </LoadingButton>
            </div>
        </div>
      </div>
    </div>
  );
};

export default ReminderDialog;