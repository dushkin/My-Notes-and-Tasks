import React, { useEffect, useRef } from 'react';

const KeyboardAware = ({ children, className = '' }) => {
  const containerRef = useRef(null);

  useEffect(() => {
    const handleFocusIn = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        setTimeout(() => {
          // For password fields (usually the last input), scroll to show the button area
          if (e.target.type === 'password') {
            // Find the form and scroll to show both the input and the button
            const form = e.target.closest('form');
            if (form) {
              const formRect = form.getBoundingClientRect();
              const viewportHeight = window.innerHeight;
              
              // If the form bottom would be below the viewport, scroll the form into view
              if (formRect.bottom > viewportHeight) {
                form.scrollIntoView({
                  behavior: 'smooth',
                  block: 'end',
                  inline: 'nearest'
                });
              } else {
                // Otherwise just center the input
                e.target.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center',
                  inline: 'nearest'
                });
              }
            }
          } else {
            // For other inputs, just center them
            e.target.scrollIntoView({
              behavior: 'smooth',
              block: 'center',
              inline: 'nearest'
            });
          }
        }, 300); // Delay to allow keyboard to appear
      }
    };

    document.addEventListener('focusin', handleFocusIn);
    
    return () => {
      document.removeEventListener('focusin', handleFocusIn);
    };
  }, []);

  return (
    <div 
      ref={containerRef}
      className={`keyboard-aware-container ${className}`}
    >
      {children}
    </div>
  );
};

export default KeyboardAware;