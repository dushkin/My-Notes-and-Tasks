import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Custom hook for debounced auto-save functionality with SyncManager integration
 * @param {Function} saveFunction - Function to call when saving (should return a promise)
 * @param {number} delay - Debounce delay in milliseconds (default: 1500ms)
 * @param {boolean} enabled - Whether auto-save is enabled (default: true)
 */
export const useAutoSave = (saveFunction, delay = 1500, enabled = true) => {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveError, setSaveError] = useState(null);

  const timeoutRef = useRef(null);
  const saveFunctionRef = useRef(saveFunction);
  const pendingDataRef = useRef(null);

  // Update save function ref when it changes
  useEffect(() => {
    saveFunctionRef.current = saveFunction;
  }, [saveFunction]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Handle saving with error handling and status updates
  const performSave = useCallback(async (data) => {
    if (!enabled || !saveFunctionRef.current) return;

    setIsSaving(true);
    setSaveError(null);

    try {
      await saveFunctionRef.current(data);
      setLastSaved(new Date());
      setHasUnsavedChanges(false);
      pendingDataRef.current = null;
    } catch (error) {
      console.error('Auto-save failed:', error);
      setSaveError(error.message || 'Save failed');
      
      // For sync integration: if save fails, we should queue it
      if (window.MyNotesApp?.syncManager) {
        try {
          // Add to sync queue for retry when online
          const operation = {
            type: 'UPDATE_CONTENT',
            data: {
              id: data.id,
              content: data.content,
              direction: data.direction,
              timestamp: Date.now()
            }
          };
          window.MyNotesApp.syncManager.addToSyncQueue(operation);
          console.log('📝 Added failed save to sync queue:', data.id);
        } catch (syncError) {
          console.error('Failed to add to sync queue:', syncError);
        }
      }
    } finally {
      setIsSaving(false);
    }
  }, [enabled]);

  // Debounced save function
  const debouncedSave = useCallback((data) => {
    if (!enabled || !data) return;

    // Store the latest data for saving
    pendingDataRef.current = data;
    setHasUnsavedChanges(true);
    setSaveError(null);

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new timeout
    timeoutRef.current = setTimeout(() => {
      if (pendingDataRef.current) {
        performSave(pendingDataRef.current);
      }
    }, delay);
  }, [delay, enabled, performSave]);

  // Force save immediately (useful for blur events, etc.)
  const forceSave = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (pendingDataRef.current && enabled) {
      await performSave(pendingDataRef.current);
    }
  }, [enabled, performSave]);

  // Reset auto-save state
  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingDataRef.current = null;
    setHasUnsavedChanges(false);
    setSaveError(null);
    setIsSaving(false);
    setLastSaved(null);
  }, []);

  return {
    // State
    isSaving,
    lastSaved,
    hasUnsavedChanges,
    saveError,
    
    // Functions
    debouncedSave,
    forceSave,
    reset,
    
    // Utils
    isOnline: navigator.onLine
  };
};

export default useAutoSave;