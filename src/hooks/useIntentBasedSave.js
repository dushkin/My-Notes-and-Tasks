import { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';

/**
 * Intent-based save hook that saves only on specific user intent events
 * This eliminates conflicts during active editing
 * @param {Function} saveFunction - Function to call when saving
 * @param {boolean} enabled - Whether saving is enabled
 */
export const useIntentBasedSave = (saveFunction, enabled = true) => {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [versionConflict, setVersionConflict] = useState(null);

  const saveFunctionRef = useRef(saveFunction);
  const pendingDataRef = useRef(null);
  const currentSaveRef = useRef(null);
  const safetyTimerRef = useRef(null);
  const inactivityTimerRef = useRef(null);
  const itemIdRef = useRef(null);

  // Update save function ref when it changes
  useEffect(() => {
    saveFunctionRef.current = saveFunction;
  }, [saveFunction]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (currentSaveRef.current) {
        currentSaveRef.current.cancelled = true;
      }
      if (safetyTimerRef.current) {
        clearTimeout(safetyTimerRef.current);
      }
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
    };
  }, []);

  // Enhanced save function with version conflict handling
  const performSave = useCallback(async (data, reason = 'manual') => {
    if (!enabled || !saveFunctionRef.current || !data) return;

    // Prevent multiple simultaneous saves
    if (currentSaveRef.current && !currentSaveRef.current.cancelled) {
      console.log('🔄 Save already in progress, skipping duplicate save');
      return;
    }

    const saveOperation = { cancelled: false, startTime: Date.now() };
    currentSaveRef.current = saveOperation;

    setIsSaving(true);
    setSaveError(null);
    
    try {
      console.log(`💾 Intent-based save triggered by: ${reason} for item:`, data?.id);
      
      await saveFunctionRef.current(data);
      
      if (saveOperation.cancelled) {
        console.log('💾 Save operation was cancelled');
        return;
      }
      
      const saveTime = new Date();
      setLastSaved(saveTime);
      setHasUnsavedChanges(false);
      pendingDataRef.current = null;
      
      // Reset safety and inactivity timers since we successfully saved
      if (safetyTimerRef.current) {
        clearTimeout(safetyTimerRef.current);
        safetyTimerRef.current = null;
      }
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      
      console.log('✅ Intent-based save completed successfully for item:', data?.id);
      
    } catch (error) {
      if (saveOperation.cancelled) {
        console.log('💾 Save operation was cancelled during error handling');
        return;
      }
      
      // Handle version conflicts
      if (error.status === 409 && error.conflict) {
        console.warn('🔄 Version conflict detected:', error.conflict);
        setVersionConflict(error.conflict);
        setSaveError('Content has been modified by another client. Please resolve the conflict.');
        return;
      }
      
      console.error('❌ Intent-based save failed:', error);
      setSaveError(error.message || 'Save failed');
      
    } finally {
      if (!saveOperation.cancelled) {
        setIsSaving(false);
      }
      
      if (currentSaveRef.current === saveOperation) {
        currentSaveRef.current = null;
      }
    }
  }, [enabled]);

  // Record content change (no immediate save)
  const recordContentChange = useCallback((data) => {
    if (!enabled || !data) return;

    const previousData = pendingDataRef.current;
    pendingDataRef.current = data;
    
    // Only mark as unsaved if content actually changed
    const hasChanged = !previousData || 
                      previousData.content !== data.content ||
                      previousData.direction !== data.direction;
    
    if (hasChanged) {
      setHasUnsavedChanges(true);
      setSaveError(null);
      
      // Track item ID changes
      if (itemIdRef.current !== data.id) {
        itemIdRef.current = data.id;
      }
      
      // Set/reset safety backup timer (2 minutes)
      if (safetyTimerRef.current) {
        clearTimeout(safetyTimerRef.current);
      }
      
      safetyTimerRef.current = setTimeout(() => {
        if (pendingDataRef.current && hasUnsavedChanges) {
          console.log('⚠️ Safety backup save triggered (2 minutes of unsaved changes)');
          performSave(pendingDataRef.current, 'safety-backup');
        }
      }, 2 * 60 * 1000); // 2 minutes

      // Set/reset inactivity timer (30 seconds of no typing)
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
      }
      
      inactivityTimerRef.current = setTimeout(() => {
        if (pendingDataRef.current && hasUnsavedChanges) {
          console.log('💤 Inactivity save triggered (30 seconds of no typing)');
          performSave(pendingDataRef.current, 'inactivity');
        }
      }, 30 * 1000); // 30 seconds
      
      console.log('📝 Content change recorded for item:', data.id, 'Length:', data.content?.length || 0);
    }
  }, [enabled, hasUnsavedChanges, performSave]);

  // Save on specific intent events
  const saveOnIntent = useCallback(async (reason = 'intent') => {
    if (pendingDataRef.current && hasUnsavedChanges) {
      await performSave(pendingDataRef.current, reason);
    }
  }, [hasUnsavedChanges, performSave]);

  // Force immediate save
  const forceSave = useCallback(async (reason = 'forced') => {
    if (currentSaveRef.current) {
      currentSaveRef.current.cancelled = true;
      currentSaveRef.current = null;
    }

    if (pendingDataRef.current && enabled) {
      await performSave(pendingDataRef.current, reason);
    }
  }, [enabled, performSave]);

  // Setup browser/app event listeners (cross-platform)
  useEffect(() => {
    if (!enabled) return;

    let capacitorListeners = [];
    const isNative = Capacitor?.isNativePlatform?.();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        console.log('🌐 Tab becoming hidden - saving on intent');
        saveOnIntent('tab-hidden');
      }
    };

    const handleWindowBlur = () => {
      console.log('🪟 Window lost focus - saving on intent');
      saveOnIntent('window-blur');
    };

    const handleBeforeUnload = (event) => {
      if (hasUnsavedChanges) {
        console.log('🚪 Page unloading with unsaved changes - attempting save');
        // For immediate save on page unload, we need synchronous approach
        const data = pendingDataRef.current;
        if (data && saveFunctionRef.current) {
          // Use sendBeacon or synchronous request for page unload
          event.preventDefault();
          event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
          
          // Attempt immediate save
          forceSave('page-unload');
        }
      }
    };

    const handlePageHide = () => {
      console.log('📱 Page hiding (mobile background) - saving on intent');
      saveOnIntent('page-hide');
    };

    const handleAppStateChange = () => {
      // Additional mobile app state change handling
      if (document.visibilityState === 'hidden') {
        console.log('📱 App going to background - saving on intent');
        saveOnIntent('app-background');
      }
    };

    const handleOrientationChange = () => {
      // Save on orientation change (common mobile interaction)
      console.log('📱 Orientation changed - saving on intent');
      saveOnIntent('orientation-change');
    };

    const handleTouchEnd = (event) => {
      // Save when user taps outside editor (mobile equivalent of blur)
      if (!event.target.closest('[contenteditable="true"]') && 
          !event.target.closest('.ProseMirror') &&
          hasUnsavedChanges) {
        console.log('📱 Touch outside editor - saving on intent');
        saveOnIntent('mobile-touch-outside');
      }
    };

    const handleKeyDown = (event) => {
      // Ctrl+S / Cmd+S
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        console.log('⌨️ Ctrl+S pressed - saving on intent');
        saveOnIntent('keyboard-shortcut');
      }
    };

    // Add event listeners for both desktop and mobile
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);
    document.addEventListener('keydown', handleKeyDown);
    
    // Mobile-specific event listeners
    screen.orientation?.addEventListener('change', handleOrientationChange);
    document.addEventListener('touchend', handleTouchEnd);
    
    // Additional mobile app lifecycle events
    document.addEventListener('resume', handleAppStateChange);
    document.addEventListener('pause', handleAppStateChange);

    // Capacitor native app lifecycle events
    if (isNative && CapacitorApp) {
      // App state change listeners for mobile apps
      const appStateListener = CapacitorApp.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          console.log('📱 Capacitor app going to background - saving on intent');
          saveOnIntent('capacitor-background');
        }
      });
      capacitorListeners.push(appStateListener);

      // Back button listener (save before navigation)
      const backButtonListener = CapacitorApp.addListener('backButton', () => {
        if (hasUnsavedChanges) {
          console.log('🔙 Android back button - saving on intent');
          saveOnIntent('android-back');
        }
      });
      capacitorListeners.push(backButtonListener);

      // App URL open (save before handling URL)
      const urlOpenListener = CapacitorApp.addListener('appUrlOpen', () => {
        if (hasUnsavedChanges) {
          console.log('🔗 App URL open - saving on intent');
          saveOnIntent('app-url-open');
        }
      });
      capacitorListeners.push(urlOpenListener);
    }

    return () => {
      // Cleanup event listeners
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
      document.removeEventListener('keydown', handleKeyDown);
      
      // Mobile cleanup
      screen.orientation?.removeEventListener('change', handleOrientationChange);
      document.removeEventListener('touchend', handleTouchEnd);
      document.removeEventListener('resume', handleAppStateChange);
      document.removeEventListener('pause', handleAppStateChange);

      // Cleanup Capacitor listeners
      capacitorListeners.forEach(listener => {
        if (listener?.remove) {
          listener.remove();
        }
      });
    };
  }, [enabled, hasUnsavedChanges, saveOnIntent, forceSave]);

  // Version conflict resolution functions
  const acceptServerVersion = useCallback(async () => {
    if (!versionConflict) return;
    
    console.log('🔄 Accepting server version for conflict resolution');
    setVersionConflict(null);
    setSaveError(null);
    setHasUnsavedChanges(false);
    pendingDataRef.current = null;
    
    // Dispatch event to notify UI to refresh the item
    window.dispatchEvent(new CustomEvent('versionConflictResolved', {
      detail: { 
        itemId: versionConflict.itemId,
        resolution: 'server',
        serverItem: versionConflict.serverItem
      }
    }));
  }, [versionConflict]);

  const forceClientVersion = useCallback(async () => {
    if (!versionConflict || !pendingDataRef.current) return;
    
    console.log('🔄 Forcing client version for conflict resolution');
    
    try {
      const dataWithCorrectVersion = {
        ...pendingDataRef.current,
        expectedVersion: versionConflict.serverVersion
      };
      
      await performSave(dataWithCorrectVersion, 'conflict-resolution');
      setVersionConflict(null);
    } catch (error) {
      console.error('❌ Failed to force client version:', error);
      setSaveError('Failed to resolve conflict. Please try again.');
    }
  }, [versionConflict, performSave]);

  // Reset state
  const reset = useCallback(() => {
    if (currentSaveRef.current) {
      currentSaveRef.current.cancelled = true;
      currentSaveRef.current = null;
    }
    
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
    
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }
    
    pendingDataRef.current = null;
    itemIdRef.current = null;
    setHasUnsavedChanges(false);
    setSaveError(null);
    setIsSaving(false);
    setLastSaved(null);
    setVersionConflict(null);
  }, []);

  // Get save status
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
    versionConflict,
    hasVersionConflict: !!versionConflict,
    
    // Functions
    recordContentChange,    // Call this when content changes (no save)
    saveOnIntent,          // Call this for explicit save events
    forceSave,             // Force immediate save
    reset,
    getSaveStatus,
    acceptServerVersion,
    forceClientVersion,
    
    // Utils
    isOnline: navigator.onLine,
    contentLength: pendingDataRef.current?.content?.length || 0
  };
};

export default useIntentBasedSave;