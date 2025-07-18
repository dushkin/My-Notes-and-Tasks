// SetReminderDialog.jsx
import React, { useState, useRef, useEffect } from "react";
import Modal from "../dialogs/Modal";
import ReminderSetter from "./ReminderSetter";
import { useFocusTrap } from "../../hooks/useFocusTrap";

const SetReminderDialog = ({ isOpen, onClose, onSetReminder, item }) => {
  const [reminderTime, setReminderTime] = useState(null);
  const [repeatOptions, setRepeatOptions] = useState(null);
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, isOpen);

  const handleReminderSet = (time, repeat) => {
    setReminderTime(time);
    setRepeatOptions(repeat);
  };

  const handleConfirm = () => {
    let finalReminderTime = null;

    if (typeof reminderTime === 'string' && reminderTime.startsWith('relative:')) {
      const offset = parseInt(reminderTime.split(':')[1], 10);
      if (!isNaN(offset)) {
        finalReminderTime = Date.now() + offset;
      }
    } else if (typeof reminderTime === 'number') {
      finalReminderTime = reminderTime;
    }

    if (finalReminderTime) {
      onSetReminder(item.id, finalReminderTime, repeatOptions);
    }
    onClose();
  };

  const actions = [
    { label: "Cancel", onClick: onClose, variant: "secondary"},
    {
      label: "Set Reminder",
      onClick: handleConfirm,
      variant: "primary",
      autoFocus: true,
      className: "ml-5"
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