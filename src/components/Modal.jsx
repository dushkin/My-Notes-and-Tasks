import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

export default function Modal({ isOpen, onClose, title, children, actions }) {
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
        className="fixed inset-0 bg-black bg-opacity-50"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="bg-white rounded-lg shadow-lg overflow-hidden max-w-md w-full z-10"
      >
        <header className="px-4 py-2 border-b">
          <h2 id="modal-title" className="text-lg font-semibold">
            {title}
          </h2>
        </header>
        <div className="p-4">{children}</div>
        <footer className="px-4 py-2 border-t flex justify-end space-x-2">
          {actions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              className={\`px-4 py-2 rounded \${action.variant === 'primary' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'} focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2\`}
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
