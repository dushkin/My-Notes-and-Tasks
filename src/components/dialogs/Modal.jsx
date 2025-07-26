import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import LoadingButton from "../ui/LoadingButton";

const Modal = ({ isOpen, onClose, title, children, actions, dialogRef }) => {
  if (!isOpen) return null;

  // Effect to handle the Escape key to close the modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Auto-focus first input when modal opens
  useEffect(() => {
    if (isOpen && dialogRef?.current) {
      setTimeout(() => {
        const firstInput = dialogRef.current.querySelector('input, select, textarea, button[autofocus]');
        if (firstInput && !firstInput.disabled) {
          firstInput.focus();
          if (firstInput.type === 'text' || firstInput.type === 'number') {
            firstInput.select();
          }
        }
      }, 100);
    }
  }, [isOpen]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 backdrop-blur-sm"
      onClick={onClose} // Close when clicking the overlay
      aria-modal="true"
      role="dialog"
    >
      <div
        ref={dialogRef}
        className="bg-white dark:bg-zinc-800 p-6 rounded-lg shadow-xl w-full max-w-md border border-zinc-200 dark:border-zinc-700"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside the modal
        tabIndex={-1}
      >
        {/* Modal Header */}
        <div className="flex justify-between items-center mb-4 pb-3 border-b border-zinc-200 dark:border-zinc-600">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {title}
          </h3>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1 rounded-full text-zinc-500 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="text-zinc-700 dark:text-zinc-300">
          {children}
        </div>

        {/* Modal Footer with Action Buttons */}
        {actions && actions.length > 0 && (
          <div className="mt-6 pt-4 border-t dark:border-zinc-600 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
            {actions.map((action, index) => (
              <LoadingButton
                key={index}
                onClick={action.onClick}
                variant={action.variant || 'secondary'}
                autoFocus={action.autoFocus}
                className={action.className || ''}
                size="default"
              >
                {action.label}
              </LoadingButton>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

Modal.displayName = "Modal";
export default Modal;