import { useState, useEffect, useRef, useCallback } from 'react';
import { AdaptiveDebounce } from '../utils/adaptiveDebounce.js';

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
  const [versionConflict, setVersionConflict] = useState(null);

  const timeoutRef = useRef(null);
  const saveFunctionRef = useRef(saveFunction);
  const pendingDataRef = useRef(null);
  const currentSaveRef = useRef(null); // Track current save operation
  const lastSaveTimeRef = useRef(0); // Track last successful save time
  const adaptiveDebounceRef = useRef(null); // Smart debouncing system

  // Initialize adaptive debounce system
  useEffect(() => {
    if (!adaptiveDebounceRef.current) {
      adaptiveDebounceRef.current = new AdaptiveDebounce(delay, {
        minDelay: 500,
        maxDelay: 10000,
        enableLearning: true,
        debugMode: process.env.NODE_ENV === 'development'
      });
    }
  }, [delay]);

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
      // Cancel adaptive debounce
      if (adaptiveDebounceRef.current) {
        adaptiveDebounceRef.current.cancel();
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
      
      // Handle version conflicts differently from other errors
      if (error.status === 409 && error.conflict) {
        console.warn('🔄 Version conflict detected:', error.conflict);
        setVersionConflict(error.conflict);
        setSaveError('Content has been modified by another client. Please resolve the conflict.');
        return; // Don't retry version conflicts automatically
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

  // Enhanced smart debounced save with behavioral analysis
  const debouncedSave = useCallback((data, editInfo = {}) => {
    if (!enabled || !data || !adaptiveDebounceRef.current) return;

    // Store the latest data for saving
    pendingDataRef.current = data;
    setHasUnsavedChanges(true);
    setSaveError(null);

    // Record edit event for behavioral analysis
    const { 
      editType = 'unknown', 
      cursorPosition = 0, 
      changeLength = 0 
    } = editInfo;
    
    adaptiveDebounceRef.current.recordEdit(
      editType, 
      cursorPosition, 
      changeLength, 
      data.content || ''
    );

    // Clear existing timeout (legacy fallback)
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Use smart adaptive debouncing
    adaptiveDebounceRef.current.execute(() => {
      if (pendingDataRef.current && !currentSaveRef.current) {
        const debugInfo = adaptiveDebounceRef.current.getStatus();
        console.log('🧠 Smart save executed:', {
          delay: debugInfo.currentDelay,
          reason: debugInfo.recommendations?.reason,
          pattern: debugInfo.typingPattern,
          confidence: debugInfo.confidence
        });
        
        performSave(pendingDataRef.current);
      }
    });
  }, [enabled, performSave]);

  // Enhanced force save with cancellation of pending operations
  const forceSave = useCallback(async () => {
    // Clear any pending debounced save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    // Cancel adaptive debounce
    if (adaptiveDebounceRef.current) {
      adaptiveDebounceRef.current.cancel();
    }

    // Cancel any ongoing save to prevent conflicts
    if (currentSaveRef.current) {
      currentSaveRef.current.cancelled = true;
      currentSaveRef.current = null;
    }

    if (pendingDataRef.current && enabled) {
      console.log('🚀 Force saving content immediately');
      
      // Record immediate execution for learning
      if (adaptiveDebounceRef.current) {
        adaptiveDebounceRef.current.executeImmediate(() => {
          // This will be executed immediately
        });
      }
      
      await performSave(pendingDataRef.current);
    }
  }, [enabled, performSave]);

  // Enhanced reset with proper cleanup
  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    
    // Reset adaptive debounce system
    if (adaptiveDebounceRef.current) {
      adaptiveDebounceRef.current.reset();
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
    setVersionConflict(null);
    lastSaveTimeRef.current = 0;
  }, []);

  // Resolve version conflict by accepting server version
  const acceptServerVersion = useCallback(async () => {
    if (!versionConflict) return;
    
    console.log('🔄 Accepting server version for conflict resolution');
    setVersionConflict(null);
    setSaveError(null);
    setHasUnsavedChanges(false);
    
    // Dispatch event to notify UI to refresh the item
    window.dispatchEvent(new CustomEvent('versionConflictResolved', {
      detail: { 
        itemId: versionConflict.itemId,
        resolution: 'server',
        serverItem: versionConflict.serverItem
      }
    }));
  }, [versionConflict]);

  // Resolve version conflict by forcing client version
  const forceClientVersion = useCallback(async () => {
    if (!versionConflict || !pendingDataRef.current) return;
    
    console.log('🔄 Forcing client version for conflict resolution');
    
    try {
      // Force save with server version as expected version
      const dataWithCorrectVersion = {
        ...pendingDataRef.current,
        expectedVersion: versionConflict.serverVersion
      };
      
      await performSave(dataWithCorrectVersion);
      setVersionConflict(null);
    } catch (error) {
      console.error('❌ Failed to force client version:', error);
      setSaveError('Failed to resolve conflict. Please try again.');
    }
  }, [versionConflict, performSave]);

  // Enhanced status reporting
  const getSaveStatus = useCallback(() => {
    if (isSaving) return 'saving';
    if (saveError) return 'error';
    if (hasUnsavedChanges) return 'pending';
    if (lastSaved) return 'saved';
    return 'idle';
  }, [isSaving, saveError, hasUnsavedChanges, lastSaved]);

  // Get smart debouncing status and analytics
  const getSmartDebounceStatus = useCallback(() => {
    if (!adaptiveDebounceRef.current) {
      return {
        enabled: false,
        currentDelay: delay,
        pattern: 'unknown',
        confidence: 0
      };
    }

    const status = adaptiveDebounceRef.current.getStatus();
    return {
      enabled: true,
      currentDelay: status.currentDelay,
      baseDelay: status.baseDelay,
      userPattern: status.userPattern,
      typingPattern: status.typingPattern,
      confidence: status.confidence,
      isPending: status.isPending,
      executionCount: status.executionCount,
      recommendations: status.recommendations
    };
  }, [delay]);

  // Manually trigger learning mode for testing
  const toggleDebugMode = useCallback((enabled) => {
    if (adaptiveDebounceRef.current) {
      adaptiveDebounceRef.current.setDebugMode(enabled);
    }
  }, []);

  return {
    // State
    isSaving,
    lastSaved,
    hasUnsavedChanges,
    saveError,
    saveAttempts,
    versionConflict,
    
    // Functions
    debouncedSave,
    forceSave,
    reset,
    getSaveStatus,
    acceptServerVersion,
    forceClientVersion,
    
    // Smart Debouncing
    getSmartDebounceStatus,
    toggleDebugMode,
    
    // Utils
    isOnline: navigator.onLine,
    
    // Debug info
    contentLength: pendingDataRef.current?.content?.length || 0,
    isLargeContent: (pendingDataRef.current?.content?.length || 0) > 20000,
    hasVersionConflict: !!versionConflict,
    smartDebounceEnabled: !!adaptiveDebounceRef.current
  };
};

export default useAutoSave;