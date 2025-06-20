import React, { useEffect, useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export default function Modal({ isOpen, onClose, title, children, actions = [] }) {
  const modalRef = useRef(null);
  useFocusTrap(modalRef, isOpen);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg overflow-hidden shadow-xl w-full max-w-lg"
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-lg font-semibold">{title}</h2>
          </div>
        )}
        <div className="p-4">{children}</div>
        <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-2">
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={action.onClick}
              className={`
                px-4 py-2 rounded
                ${action.variant === 'primary'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200'}
              `}
              autoFocus={action.autoFocus}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
