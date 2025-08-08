import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Enhanced auto-save hook optimized for large content with better error handling
 * @param {Function} saveFunction - Function to call when saving (should return a promise)
 * @param {number} delay - Debounce delay in milliseconds (default: 2000ms for large content)
 * @param {boolean} enabled - Whether auto-save is enabled (default: true)
 */
export const useAutoSave = (saveFunction, delay = 2000, enabled = true) => {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveAttempts, setSaveAttempts] = useState(0);

  const timeoutRef = useRef(null);
  const saveFunctionRef = useRef(saveFunction);
  const pendingDataRef = useRef(null);
  const currentSaveRef = useRef(null); // Track current save operation
  const lastSaveTimeRef = useRef(0); // Track last successful save time

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
      // Cancel any ongoing save operation
      if (currentSaveRef.current) {
        currentSaveRef.current.cancelled = true;
      }
    };
  }, []);

  // Enhanced save function with better error handling and duplicate prevention
  const performSave = useCallback(async (data) => {
    if (!enabled || !saveFunctionRef.current) return;

    // Prevent multiple simultaneous saves
    if (currentSaveRef.current && !currentSaveRef.current.cancelled) {
      console.log('🔄 Save already in progress, skipping duplicate save');
      return;
    }

    // Rate limiting: prevent saves within 500ms of each other
    const now = Date.now();
    if (now - lastSaveTimeRef.current < 500) {
      console.log('🔄 Rate limiting: save too recent, deferring');
      // Defer the save by the minimum interval
      setTimeout(() => performSave(data), 500 - (now - lastSaveTimeRef.current));
      return;
    }

    // Create cancellation token for this save operation
    const saveOperation = { cancelled: false, startTime: now };
    currentSaveRef.current = saveOperation;

    setIsSaving(true);
    setSaveError(null);
    
    try {
      console.log('💾 Starting save operation for item:', data?.id, 'Content length:', data?.content?.length || 0);
      
      // Add timeout for large content saves (30 seconds)
      const savePromise = saveFunctionRef.current(data);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Save operation timed out')), 30000)
      );
      
      await Promise.race([savePromise, timeoutPromise]);
      
      // Check if operation was cancelled while saving
      if (saveOperation.cancelled) {
        console.log('💾 Save operation was cancelled');
        return;
      }
      
      const saveTime = new Date();
      setLastSaved(saveTime);
      setHasUnsavedChanges(false);
      setSaveAttempts(0);
      pendingDataRef.current = null;
      lastSaveTimeRef.current = saveTime.getTime();
      
      console.log('✅ Save completed successfully for item:', data?.id);
      
    } catch (error) {
      // Check if operation was cancelled
      if (saveOperation.cancelled) {
        console.log('💾 Save operation was cancelled during error handling');
        return;
      }
      
      console.error('❌ Auto-save failed:', error);
      setSaveError(error.message || 'Save failed');
      setSaveAttempts(prev => prev + 1);
      
      // Enhanced retry logic with exponential backoff
      if (saveAttempts < 3) {
        const retryDelay = Math.min(1000 * Math.pow(2, saveAttempts), 10000); // Max 10s
        console.log(`🔄 Retrying save in ${retryDelay}ms (attempt ${saveAttempts + 1}/3)`);
        
        setTimeout(() => {
          if (!saveOperation.cancelled && pendingDataRef.current) {
            performSave(pendingDataRef.current);
          }
        }, retryDelay);
      } else {
        // After 3 failed attempts, queue for offline sync if available
        if (window.MyNotesApp?.syncManager) {
          try {
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
            console.log('📝 Added failed save to sync queue after 3 attempts:', data.id);
            setSaveError('Save failed. Changes queued for when connection improves.');
          } catch (syncError) {
            console.error('Failed to add to sync queue:', syncError);
            setSaveError('Save failed. Please try again or copy your content as backup.');
          }
        } else {
          setSaveError('Save failed multiple times. Please check your connection and try again.');
        }
      }
    } finally {
      // Only clear saving state if this operation wasn't cancelled
      if (!saveOperation.cancelled) {
        setIsSaving(false);
      }
      
      // Clear the current save reference if this is the current operation
      if (currentSaveRef.current === saveOperation) {
        currentSaveRef.current = null;
      }
    }
  }, [enabled, saveAttempts]);

  // Enhanced debounced save with content size adaptation
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

    // Adaptive delay based on content size
    const contentLength = data.content?.length || 0;
    let adaptiveDelay = delay;
    
    if (contentLength > 50000) { // Large content (>50KB)
      adaptiveDelay = Math.max(delay, 3000); // Minimum 3s delay
    } else if (contentLength > 20000) { // Medium content (>20KB)
      adaptiveDelay = Math.max(delay, 2500); // Minimum 2.5s delay
    }

    console.log('⏱️ Setting save timeout:', adaptiveDelay + 'ms for content length:', contentLength);

    // Set new timeout with adaptive delay
    timeoutRef.current = setTimeout(() => {
      if (pendingDataRef.current && !currentSaveRef.current) {
        performSave(pendingDataRef.current);
      }
    }, adaptiveDelay);
  }, [delay, enabled, performSave]);

  // Enhanced force save with cancellation of pending operations
  const forceSave = useCallback(async () => {
    // Clear any pending debounced save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Cancel any ongoing save to prevent conflicts
    if (currentSaveRef.current) {
      currentSaveRef.current.cancelled = true;
      currentSaveRef.current = null;
    }

    if (pendingDataRef.current && enabled) {
      console.log('🚀 Force saving content immediately');
      await performSave(pendingDataRef.current);
    }
  }, [enabled, performSave]);

  // Enhanced reset with proper cleanup
  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    if (currentSaveRef.current) {
      currentSaveRef.current.cancelled = true;
      currentSaveRef.current = null;
    }
    
    pendingDataRef.current = null;
    setHasUnsavedChanges(false);
    setSaveError(null);
    setIsSaving(false);
    setLastSaved(null);
    setSaveAttempts(0);
    lastSaveTimeRef.current = 0;
  }, []);

  // Enhanced status reporting
  const getSaveStatus = useCallback(() => {
    if (isSaving) return 'saving';
    if (saveError) return 'error';
    if (hasUnsavedChanges) return 'pending';
    if (lastSaved) return 'saved';
    return 'idle';
  }, [isSaving, saveError, hasUnsavedChanges, lastSaved]);

  return {
    // State
    isSaving,
    lastSaved,
    hasUnsavedChanges,
    saveError,
    saveAttempts,
    
    // Functions
    debouncedSave,
    forceSave,
    reset,
    getSaveStatus,
    
    // Utils
    isOnline: navigator.onLine,
    
    // Debug info
    contentLength: pendingDataRef.current?.content?.length || 0,
    isLargeContent: (pendingDataRef.current?.content?.length || 0) > 20000
  };
};

export default useAutoSave;