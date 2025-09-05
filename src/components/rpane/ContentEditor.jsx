import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  memo,
  useMemo,
} from "react";
import TipTapEditor from "./TipTapEditor";
import LoadingSpinner from "../ui/LoadingSpinner";
import { formatRemainingTime } from "../../utils/reminderUtils";
import { useLiveCountdown } from "../../hooks/useLiveCountdown";
import SetReminderDialog from "../reminders/SetReminderDialog"; // Import the dialog
import { setReminder, getReminder } from "../../utils/reminderUtils"; // Import utilities
import { useIntentBasedSave } from "../../hooks/useIntentBasedSave";
import VersionConflictDialog from "../ui/VersionConflictDialog";
import { isRTLText } from "../../utils/rtlUtils";

// Safe content conversion that prevents [object Object]
const safeStringify = (value) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    // Handle the specific case where content data is passed as an object
    if (value.content && typeof value.content === 'string') {
      console.warn('⚠️ Extracting content from object:', value);
      return value.content;
    }
    console.warn('⚠️ Attempted to stringify object as content:', value);
    return '';
  }
  return String(value);
};

const MOBILE_BREAKPOINT = 768;
const formatTimestamp = (isoString) => {
  const date = new Date(isoString);
  return new Intl.DateTimeFormat("default", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: true,
  }).format(date);
};


const ContentEditor = memo(
  ({
    item,
    defaultFontFamily,
    onSaveItemData,
    renderToolbarToggle,
    reminder,
  }) => {
    const [isMobile, setIsMobile] = useState(
      window.innerWidth < MOBILE_BREAKPOINT
    );
    const [showToolbar, setShowToolbar] = useState(false); // State for toolbar visibility - default to false on mobile for better UX
    const [dir, setDir] = useState("ltr"); // RTL/LTR state
    const [isReminderDialogOpen, setIsReminderDialogOpen] = useState(false); // State for dialog visibility
    const [showConflictDialog, setShowConflictDialog] = useState(false);

    // FIX: Use the reminder prop for the live countdown
    const liveCountdown = useLiveCountdown(reminder?.timestamp);
    
    // Debug logging for reminder
    useEffect(() => {
      if (reminder) {
        console.log('📱 ContentEditor reminder debug:', {
          reminder,
          timestamp: reminder.timestamp,
          timestampType: typeof reminder.timestamp,
          liveCountdown,
          formatRemainingTime: formatRemainingTime(reminder.timestamp)
        });
      }
    }, [reminder, liveCountdown]);

    // Auto-save implementation with proper integration
    const saveFunction = useCallback(async (data) => {
      if (!data || !data.id) return;
      
      // Ensure content is always a string
      const safeContent = safeStringify(data.content);
      
      // Call the original save function from props with proper object structure
      const dataToSave = { content: safeContent };
      if (data.direction) {
        dataToSave.direction = data.direction;
      }
      await onSaveItemData(data.id, dataToSave);
    }, [onSaveItemData]);

    const {
      isSaving,
      lastSaved,
      hasUnsavedChanges,
      saveError,
      versionConflict,
      recordContentChange,
      saveOnIntent,
      forceSave,
      reset: resetSave,
      acceptServerVersion,
      forceClientVersion,
      hasVersionConflict,
      getSaveStatus
    } = useIntentBasedSave(saveFunction, !!item);

    // Save previous item and reset when item changes
    useEffect(() => {
      if (item) {
        console.log('🔄 ContentEditor received new item:', {
          id: item.id,
          contentType: typeof item.content,
          contentValue: item.content,
          contentPreview: typeof item.content === 'string' ? item.content.substring(0, 100) : 'NON-STRING'
        });
        resetSave();
      }
    }, [item?.id, resetSave]);

    // Save when switching away from an item with unsaved changes
    const previousItemIdRef = useRef();
    useEffect(() => {
      const currentItemId = item?.id;
      const previousItemId = previousItemIdRef.current;
      
      console.log('🔄 Item switch check:', { 
        from: previousItemId, 
        to: currentItemId, 
        hasUnsavedChanges, 
        switching: previousItemId && previousItemId !== currentItemId 
      });
      
      // If switching from one item to another (not initial load)
      if (previousItemId && previousItemId !== currentItemId && hasUnsavedChanges) {
        console.log('💾 Saving on item switch (intent-based):', { from: previousItemId, to: currentItemId });
        saveOnIntent('node-switch');
      }
      
      // Update the ref with current item ID
      previousItemIdRef.current = currentItemId;
    }, [item?.id, hasUnsavedChanges, saveOnIntent]);

    // Initialize direction based on title and content
    useEffect(() => {
      if (item) {
        // Check if direction is already set in item data
        if (item.direction) {
          setDir(item.direction);
        } else {
          // Auto-detect direction from title and content
          const titleText = item.title || '';
          const contentText = safeStringify(item.content) || '';
          
          // Prioritize content over title for direction detection
          let detectedDir = "ltr";
          if (isRTLText(contentText)) {
            detectedDir = "rtl";
          } else if (isRTLText(titleText)) {
            detectedDir = "rtl";
          }
          
          // Fallback: check combined text if both title and content are short
          if (!detectedDir || detectedDir === "ltr") {
            const combinedText = titleText + ' ' + contentText;
            if (combinedText.length < 10 && isRTLText(combinedText)) {
              detectedDir = "rtl";
            }
          }
          setDir(detectedDir);
        }
      }
    }, [item?.id, item?.title, item?.content, item?.direction]);

    // Show conflict dialog when version conflict is detected
    useEffect(() => {
      if (hasVersionConflict && versionConflict) {
        setShowConflictDialog(true);
      }
    }, [hasVersionConflict, versionConflict]);

    // Handle version conflict resolution
    const handleConflictResolve = useCallback((resolution) => {
      setShowConflictDialog(false);
      
      if (resolution === 'server') {
        acceptServerVersion();
      } else if (resolution === 'client') {
        forceClientVersion();
      }
    }, [acceptServerVersion, forceClientVersion]);

    const handleSetReminder = (id, timestamp, repeatOptions) => {
      const itemTitle = item?.label || item?.title || 'Untitled';
      setReminder(id, timestamp, repeatOptions, itemTitle);
      // Optionally update local state or trigger re-render
    };

    const resizeListener = useCallback(() => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    }, []);

    useEffect(() => {
      window.addEventListener("resize", resizeListener);
      return () => window.removeEventListener("resize", resizeListener);
    }, [resizeListener]);

    useEffect(() => {
      // Save on unmount to ensure no data loss
      return () => {
        if (hasUnsavedChanges) {
          console.log('🔄 Component unmounting - saving on intent');
          saveOnIntent('component-unmount');
        }
      };
    }, [hasUnsavedChanges, saveOnIntent]);

    // Toggle toolbar
    const toggleToolbar = () => setShowToolbar((prev) => !prev);

    const finalShowToolbar = !isMobile || showToolbar;

    // Handle content updates with intent-based save
    const handleContentUpdate = useCallback((content, direction) => {
      if (!item) return;
      
      // Ensure content is a string
      const safeContent = safeStringify(content);
      if (safeContent !== content) {
        console.warn('⚠️ Content was not a string in handleContentUpdate:', typeof content, content);
      }
      
      // Update direction based on content
      const newDir = direction || (isRTLText(safeContent) ? "rtl" : "ltr");
      setDir(newDir);
      
      // Record content change (no immediate save)
      recordContentChange({
        id: item.id,
        content: safeContent,
        direction: newDir,
        expectedVersion: item.version || 1
      });
    }, [item, recordContentChange]);

    // Handle blur events - save on editor blur (intent-based)
    const handleEditorBlur = useCallback(() => {
      if (hasUnsavedChanges) {
        console.log('📝 Editor blur detected - saving on intent');
        saveOnIntent('editor-blur');
      }
    }, [hasUnsavedChanges, saveOnIntent]);

    if (!item) {
      return (
        <p className="text-zinc-500 dark:text-zinc-400 italic p-3">
          No item selected.
        </p>
      );
    }

    // Enhanced RTL detection for title
    const isRtlTitle = useMemo(() => {
      const titleText = item?.label || item?.title || '';
      return isRTLText(titleText);
    }, [item?.label, item?.title]);

    return (
      <div className="h-full flex flex-col">
        
        {/* Metadata Section */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2 text-xs text-zinc-500 dark:text-zinc-400">
            <span><span className="text-blue-600 dark:text-blue-400">Created</span> {formatTimestamp(item.createdAt)}</span>
            <span><span className="text-orange-600 dark:text-orange-400">Last Modified</span> {formatTimestamp(item.updatedAt)}</span>
            {item.type === 'task' && !item.completed && (
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setIsReminderDialogOpen(true);
                }}
                className="text-purple-500 dark:text-purple-400 hover:underline flex items-center"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mr-1"
                >
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>{" "}
                {/* FIX: Check for reminder existence before showing text */}
                {reminder ? "Reminder" : "Set Reminder"}
                {reminder && (
                  <span className="ml-2 text-purple-600 dark:text-purple-400 text-xs">
                    ({liveCountdown || formatRemainingTime(reminder.timestamp)})
                  </span>
                )}
              </a>
            )}
          </div>
          
          {/* Enhanced Save Status Display */}
          <div className="flex items-center space-x-2">
            {isSaving && (
              <div className="flex items-center space-x-1 text-xs text-green-600 dark:text-green-400">
                <LoadingSpinner size="small" />
                <span>Saving...</span>
              </div>
            )}
            {hasUnsavedChanges && !isSaving && (
              <span className="text-xs text-blue-600 dark:text-blue-400" title="Changes will be saved when you switch items, tabs, or press Ctrl+S">
                ✏️ Draft
              </span>
            )}
            {lastSaved && !hasUnsavedChanges && !isSaving && (
              <span className="text-xs text-green-600 dark:text-green-400">
                ✓ Saved {formatTimestamp(lastSaved.toISOString())}
              </span>
            )}
            {saveError && !hasVersionConflict && (
              <span className="text-xs text-red-600 dark:text-red-400" title={saveError}>
                ⚠ Save failed
              </span>
            )}
            {hasVersionConflict && (
              <span className="text-xs text-yellow-600 dark:text-yellow-400">
                ⚠ Version conflict - needs resolution
              </span>
            )}
            {!navigator.onLine && (
              <span className="text-xs text-yellow-600 dark:text-yellow-400">
                📴 Offline
              </span>
            )}
          </div>
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 space-y-0.5">
          {process.env.NODE_ENV === 'development' && hasUnsavedChanges && (
            <div className="text-xs text-blue-600 dark:text-blue-400 italic">
              💡 Auto-saves on: item switch, tab change, Ctrl+S, window blur, 30s inactivity, or 2min maximum
            </div>
          )}
        </div>
        {/* TipTapEditor */}
        <div className="flex-1 flex flex-col min-h-0">
          <TipTapEditor
          key={`editor-${item.id}`}
          content={item.content || ""}
          onUpdate={handleContentUpdate}
          onBlur={handleEditorBlur}
          dir={dir}
          defaultFontFamily={defaultFontFamily}
          showToolbar={finalShowToolbar}
        />
        </div>
        {/* Toolbar Toggle for Mobile */}
        {isMobile &&
          renderToolbarToggle &&
          renderToolbarToggle(toggleToolbar, showToolbar)}
        {/* Reminder Dialog */}
        <SetReminderDialog
          isOpen={isReminderDialogOpen}
          onClose={() => setIsReminderDialogOpen(false)}
          onSetReminder={handleSetReminder}
          item={item}
        />
        
        {/* Version Conflict Dialog */}
        <VersionConflictDialog
          isOpen={showConflictDialog}
          conflict={versionConflict}
          onResolve={handleConflictResolve}
          onCancel={() => setShowConflictDialog(false)}
        />
        
      </div>
    );
  }
);

export default ContentEditor;