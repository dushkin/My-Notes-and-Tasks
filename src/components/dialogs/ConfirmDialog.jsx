import React from 'react';
import Modal from '../Modal';
import { AlertTriangle, Trash2, AlertCircle } from 'lucide-react';

const iconMap = {
  default: <AlertCircle className="mr-2" />,
  danger: <Trash2 className="mr-2" />,
  warning: <AlertTriangle className="mr-2" />,
};

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  variant = 'default',
}) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onCancel}
      title={title}
      actions={[
        { label: cancelText, onClick: onCancel, variant: 'secondary' },
        { label: confirmText, onClick: onConfirm, variant: 'primary', autoFocus: true },
      ]}
    >
      <div className="flex items-center">
        {iconMap[variant]}
        <p>{message}</p>
      </div>
    </Modal>
  );
}
