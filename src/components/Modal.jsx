// Modal.jsx
import React, { forwardRef } from "react";

const Modal = forwardRef(
  ({ isOpen, onClose, title, children, actions, dialogRef }, ref) => {
    if (!isOpen) return null;
    return (
      <div ref={dialogRef} className="modal-overlay">
        <div className="modal-content">
          {title && <h2>{title}</h2>}
          {children}
          <div className="modal-actions">
            {actions.map((action, index) => (
              <button
                key={index}
                onClick={action.onClick}
                className={`modal-button ${action.variant || ""} ${action.className || ""}`}
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
);

Modal.displayName = "Modal";
export default Modal;