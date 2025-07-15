import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ isOpen, onClose, title, children, actions, dialogRef }) {
  if (!isOpen) return null;

  useEffect(() => {
    function onKeyDown(e) {
      if (e.key === 'Escape') {
        onClose();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 flex items-center justify-center z-50">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 dark:bg-black dark:bg-opacity-70"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="bg-white dark:bg-zinc-800 rounded-lg shadow-lg overflow-hidden max-w-md w-full z-10 mx-4"
      >
        <header className="px-4 py-3 border-b border-gray-200 dark:border-zinc-700">
          <h2 id="modal-title" className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {title}
          </h2>
        </header>
        <div className="p-4">{children}</div>
        <footer className="px-4 py-3 border-t border-gray-200 dark:border-zinc-700 flex justify-end space-x-2">
          {actions.map((action, index) => (
            <button
              key={action.label}
              onClick={action.onClick}
              autoFocus={action.autoFocus}
              className={
                action.variant === 'primary'
                  ? 'px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-800'
                  : 'px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-800'
              }
            >
              {action.label}
            </button>
          ))}
        </footer>
      </div>
    </div>,
    document.body
  );
}
