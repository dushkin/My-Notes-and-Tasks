import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  memo,
  useMemo,
} from "react";
import TipTapEditor from "./TipTapEditor";
import LoadingSpinner from "./LoadingSpinner";
import { formatRemainingTime } from "../utils/reminderUtils";
import { useLiveCountdown } from "../hooks/useLiveCountdown";
import SetReminderDialog from "./reminders/SetReminderDialog"; // Import the dialog
import { setReminder, getReminder } from "../utils/reminderUtils"; // Import utilities

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
  const rtlChars =
    /[\u0590-\u083F]|[\u08A0-\u08FF]|[\uFB1D-\uFDFF]|[\uFE70-\uFEFF]/;
  const rtlMatches = text.match(rtlChars) || [];
  const textWithoutSpaces = text.replace(/\s/g, "");
  return rtlMatches.length / textWithoutSpaces.length > 0.75;
};

const ContentEditor = memo(
  ({
    item,
    defaultFontFamily,
    onSaveItemData,
    renderToolbarToggle,
    reminder,
  }) => {
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);
    const [isMobile, setIsMobile] = useState(
      window.innerWidth < MOBILE_BREAKPOINT
    );
    const [showToolbar, setShowToolbar] = useState(false); // State for toolbar visibility
    const [dir, setDir] = useState("ltr"); // RTL/LTR state
    const [isReminderDialogOpen, setIsReminderDialogOpen] = useState(false); // State for dialog visibility

    // FIX: Use the reminder prop for the live countdown
    const liveCountdown = useLiveCountdown(reminder?.timestamp);

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
      // Trigger save on unmount
      return () => {
        // Save logic if needed
      };
    }, []);

    // Toggle toolbar
    const toggleToolbar = () => setShowToolbar((prev) => !prev);

    const finalShowToolbar = !isMobile || showToolbar;

    // Set direction based on content
    const updateDir = (content) => {
      setDir(isRTLText(content) ? "rtl" : "ltr");
    };

    if (!item) {
      return (
        <p className="text-zinc-500 dark:text-zinc-400 italic p-3">
          No item selected.
        </p>
      );
    }

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
                className="text-green-500 hover:underline flex items-center"
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
                  <span className="ml-2 text-green-600 dark:text-green-400 text-xs">
                    ({liveCountdown || formatRemainingTime(reminder.timestamp)})
                  </span>
                )}
              </a>
            )}
          </div>
          {isSaving && <LoadingSpinner size="small" />}
          {lastSaved && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              Saved {formatTimestamp(lastSaved.toISOString())}
            </span>
          )}
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 space-y-0.5">
          {/* Additional content */}
        </div>
        {/* TipTapEditor */}
        <TipTapEditor
          key={`editor-${item.id}`}
          content={item.content || ""}
          onUpdate={(content) => {
            updateDir(content);
            onSaveItemData(item.id, content);
          }}
          dir={dir}
          defaultFontFamily={defaultFontFamily}
          showToolbar={finalShowToolbar}
        />
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