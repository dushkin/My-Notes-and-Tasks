import React, { useState, useRef, useEffect } from "react";
import Modal from "./Modal";
import ReminderSetter from "./ReminderSetter";
import { useFocusTrap } from "../hooks/useFocusTrap";

const SetReminderDialog = ({ isOpen, onClose, onSetReminder, item }) => {
  const [reminderTime, setReminderTime] = useState(null);
  const [repeatOptions, setRepeatOptions] = useState(null); // State for repeat options
  const dialogRef = useRef(null);
  useFocusTrap(dialogRef, isOpen);

  const handleReminderSet = (time, repeat) => {
    setReminderTime(time);
    setRepeatOptions(repeat);
  };

  const handleConfirm = () => {
    if (reminderTime) {
      onSetReminder(item.id, reminderTime, repeatOptions); // Pass repeat options
      onClose();
    }
  };

  const actions = [
    { label: "Cancel", onClick: onClose, variant: "secondary" },
    { label: "Set Reminder", onClick: handleConfirm, variant: "primary", autoFocus: true },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Set Reminder for "${item?.label}"`}
      actions={actions}
      dialogRef={dialogRef}
    >
      <ReminderSetter onSetReminder={handleReminderSet} />
    </Modal>
  );
};

export default SetReminderDialog;
