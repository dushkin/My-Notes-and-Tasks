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
import { useAutoSave } from "../../hooks/useAutoSave";

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

const isRTLText = (text) => {
  if (!text) return false;
  
  // Enhanced RTL character detection - covers Hebrew, Arabic, Persian, etc.
  const rtlChars = /[\u0590-\u08FF]|[\uFB1D-\uFDFF]|[\uFE70-\uFEFF]/g;
  const rtlMatches = text.match(rtlChars) || [];
  
  // Remove spaces, numbers, punctuation, and English letters for better analysis
  const textForAnalysis = text.replace(/[\s\d\p{P}\p{S}a-zA-Z]/gu, "");
  
  if (textForAnalysis.length === 0) return false;
  
  // Lower threshold for better RTL detection (30% instead of 75%)
  const rtlRatio = rtlMatches.length / textForAnalysis.length;
  return rtlRatio > 0.3;
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
    const [showToolbar, setShowToolbar] = useState(true); // State for toolbar visibility - default to true for better UX
    const [dir, setDir] = useState("ltr"); // RTL/LTR state
    const [isReminderDialogOpen, setIsReminderDialogOpen] = useState(false); // State for dialog visibility

    // FIX: Use the reminder prop for the live countdown
    const liveCountdown = useLiveCountdown(reminder?.timestamp);

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
      debouncedSave,
      forceSave,
      reset: resetAutoSave
    } = useAutoSave(saveFunction, 1500, !!item);

    // Reset auto-save when item changes
    useEffect(() => {
      if (item) {
        console.log('🔄 ContentEditor received new item:', {
          id: item.id,
          contentType: typeof item.content,
          contentValue: item.content,
          contentPreview: typeof item.content === 'string' ? item.content.substring(0, 100) : 'NON-STRING'
        });
        resetAutoSave();
      }
    }, [item?.id, resetAutoSave]);

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
          const combinedText = titleText + ' ' + contentText;
          
          const detectedDir = isRTLText(combinedText) ? "rtl" : "ltr";
          setDir(detectedDir);
        }
      }
    }, [item?.id, item?.title, item?.content, item?.direction]);

    const handleSetReminder = (id, timestamp, repeatOptions) => {
      setReminder(id, timestamp, repeatOptions);
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
      // Force save on unmount to ensure no data loss
      return () => {
        if (hasUnsavedChanges) {
          forceSave();
        }
      };
    }, [hasUnsavedChanges, forceSave]);

    // Toggle toolbar
    const toggleToolbar = () => setShowToolbar((prev) => !prev);

    const finalShowToolbar = !isMobile || showToolbar;

    // Handle content updates with auto-save
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
      
      // Trigger debounced auto-save
      debouncedSave({
        id: item.id,
        content: safeContent,
        direction: newDir
      });
    }, [item, debouncedSave]);

    // Handle blur events - force save immediately
    const handleEditorBlur = useCallback(() => {
      if (hasUnsavedChanges) {
        forceSave();
      }
    }, [hasUnsavedChanges, forceSave]);

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
      if (!titleText) return false;
      
      // Enhanced RTL character detection - covers Hebrew, Arabic, Persian, etc.
      const rtlChars = /[\u0590-\u08FF]|[\uFB1D-\uFDFF]|[\uFE70-\uFEFF]/g;
      const rtlMatches = titleText.match(rtlChars) || [];
      
      // Remove spaces, numbers, punctuation, and English letters for better analysis
      const textForAnalysis = titleText.replace(/[\s\d\p{P}\p{S}a-zA-Z]/gu, "");
      
      if (textForAnalysis.length === 0) return false;
      
      // Lower threshold for better RTL detection (30% instead of 75%)
      const rtlRatio = rtlMatches.length / textForAnalysis.length;
      return rtlRatio > 0.3;
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
              <span className="text-xs text-orange-600 dark:text-orange-400">
                Unsaved changes
              </span>
            )}
            {lastSaved && !hasUnsavedChanges && !isSaving && (
              <span className="text-xs text-green-600 dark:text-green-400">
                ✓ Saved {formatTimestamp(lastSaved.toISOString())}
              </span>
            )}
            {saveError && (
              <span className="text-xs text-red-600 dark:text-red-400" title={saveError}>
                ⚠ Save failed
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
          {/* Additional content */}
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
      </div>
    );
  }
);

export default ContentEditor;