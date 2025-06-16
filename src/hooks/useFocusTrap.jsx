import { useEffect, useCallback } from 'react';

const FOCUSABLE_ELEMENTS_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * A custom React hook to trap focus within a specified DOM element.
 * @param {React.RefObject<HTMLElement>} ref - A ref attached to the container element that should trap focus.
 * @param {boolean} isOpen - A boolean state indicating if the trap should be active (e.g., if a modal is open).
 */
export const useFocusTrap = (ref, isOpen) => {
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key !== 'Tab' || !isOpen || !ref.current) {
        return;
      }

      const focusableElements = Array.from(
        ref.current.querySelectorAll(FOCUSABLE_ELEMENTS_SELECTOR)
      ).filter(el => el.offsetParent !== null); // Ensure element is visible

      if (focusableElements.length === 0) {
        e.preventDefault();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      const currentActiveElement = document.activeElement;

      if (e.shiftKey) {
        // Shift + Tab
        if (currentActiveElement === firstElement) {
          e.preventDefault();
          lastElement.focus();
        }
      } else {
        // Tab
        if (currentActiveElement === lastElement) {
          e.preventDefault();
          firstElement.focus();
        }
      }
    },
    [isOpen, ref]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);
};