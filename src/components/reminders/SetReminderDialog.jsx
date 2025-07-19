// SetReminderDialog.jsx
import React, { useState, useRef, useEffect } from "react";
import Modal from "../dialogs/Modal";
import ReminderSetter from "./ReminderSetter";
import { useFocusTrap } from "../../hooks/useFocusTrap";

const SetReminderDialog = ({ isOpen, onClose, onSetReminder, item }) => {
  const [reminderTime, setReminderTime] = useState(null);
  const [repeatOptions, setRepeatOptions] = useState(null);
  const [error, setError] = useState("");
  const [isValidReminder, setIsValidReminder] = useState(false);
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, isOpen);

  const handleReminderSet = (time, repeat) => {
    setReminderTime(time);
    setRepeatOptions(repeat);
    setError(""); // Clear any previous errors
    
    // Check if reminder is valid (not null means valid)
    setIsValidReminder(time !== null);
  };

  const handleConfirm = () => {
    let finalReminderTime = null;

    if (typeof reminderTime === 'string' && reminderTime.startsWith('relative:')) {
      const offset = parseInt(reminderTime.split(':')[1], 10);
      if (!isNaN(offset) && offset > 0) { // Prevent negative wait time
        finalReminderTime = Date.now() + offset;
      } else {
        // Handle invalid or negative offset - could show error message
        console.warn('Invalid or negative reminder time offset');
        return;
      }
    } else if (typeof reminderTime === 'number' && reminderTime > Date.now()) { // Ensure future time
      finalReminderTime = reminderTime;
    } else if (typeof reminderTime === 'number') {
      console.warn('Reminder time cannot be in the past');
      return;
    }

    if (finalReminderTime) {
      setError("");
      onSetReminder(item.id, finalReminderTime, repeatOptions);
      onClose();
    } else {
      setError("Please set a valid reminder time.");
    }
  };

  const actions = [
    { 
      label: "Cancel", 
      onClick: onClose, 
      variant: "secondary",
      className: "flex-1 mx-1" // Equal width, consistent spacing
    },
    {
      label: "Set Reminder",
      onClick: handleConfirm,
      variant: "primary",
      autoFocus: true,
      disabled: !isValidReminder, // Disable button when reminder is invalid
      className: `flex-1 mx-1 ${!isValidReminder ? 'opacity-50 cursor-not-allowed' : ''}`
    }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Set Reminder for "${item?.label}"`}
      actions={actions}
      dialogRef={dialogRef}
    >
      <ReminderSetter 
        onSetReminder={handleReminderSet} 
        showEnableToggle={false} 
      />
    </Modal>
  );
};

export default SetReminderDialog;