import React, { useState, useEffect, useCallback, useRef, memo, useMemo } from "react";
import TipTapEditor from "./TipTapEditor";
import LoadingSpinner from "./LoadingSpinner";
import { Bell } from "lucide-react";

const MOBILE_BREAKPOINT = 768;
const formatTimestamp = (isoString) => {
  if (!isoString) return "N/A";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "Invalid Date";
    return date.toLocaleString("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (e) {
    console.error("Error formatting timestamp:", e);
    return "Error";
  }
};
function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => func.apply(this, args), delay);
  };
}

function decodeHtml(str) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(str, "text/html");
  return doc.documentElement.textContent;
}

const isPredominantlyRTL = (text) => {
  if (!text) return false;
  // This regex covers Hebrew and Arabic character ranges.
  const rtlRegex = /[\u0590-\u05FF\u0600-\u06FF]/g;
  const rtlMatches = text.match(rtlRegex);

  if (!rtlMatches) {
    return false;
  }

  // Calculate percentage based on non-whitespace characters
  const textWithoutSpaces = text.replace(/\s/g, "");
  if (textWithoutSpaces.length === 0) {
    return false;
  }

  return (rtlMatches.length / textWithoutSpaces.length) > 0.6;
};

const ContentEditor = memo(({ item, defaultFontFamily, onSaveItemData, renderToolbarToggle, onOpenReminderDialog }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth <= MOBILE_BREAKPOINT
  );
  const [showToolbar, setShowToolbar] = useState(false);

  const titleIsRTL = useMemo(() => isPredominantlyRTL(item?.label), [item?.label]);

  useEffect(() => {
    console.log("Initial isMobile:", isMobile);
    const handleResize = () => {
      const newIsMobile = window.innerWidth <= MOBILE_BREAKPOINT;
      if (newIsMobile !== isMobile) {
        setIsMobile(newIsMobile);
        setShowToolbar(!newIsMobile);
        console.log("Mobile state changed to:", newIsMobile, "ShowToolbar set to:", !newIsMobile);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [isMobile]);

  useEffect(() => {
    console.log("Item changed, item:", item?.id, "Current isMobile:", isMobile);
    if (item?.id) {
      const decoded = item.content ? decodeHtml(item.content) : currentEditorContentRef.current || "";
      setInitialEditorContent(decoded);
      currentEditorContentRef.current = decoded;
      pendingContentRef.current = null;
      setIsSaving(false);
      setLastSaved(null);
      if (isMobile) setShowToolbar(false);
    }
  }, [item?.id, isMobile]);
  const [initialEditorContent, setInitialEditorContent] = useState("");

  const isUpdatingContentRef = useRef(false);
  const editorHasFocusRef = useRef(false);
  const pendingContentRef = useRef(null);
  const currentEditorContentRef = useRef("");

  const saveContent = useCallback(
    async (itemId, content, direction = "ltr") => {
      if (isUpdatingContentRef.current || !itemId) return;
      isUpdatingContentRef.current = true;
      setIsSaving(true);
      console.log("[ContentEditor] Saving content for item", itemId);
      try {
        const updates = { content, direction };
        const result = await onSaveItemData(itemId, updates);
        if (result && !result.success) throw new Error(result.error || "Failed to save");
        pendingContentRef.current = null;
        setLastSaved(new Date());
        console.log("[ContentEditor] Saved successfully at", new Date().toISOString());
      } catch (error) {
        console.error("[ContentEditor] Save failed for item", itemId, error);
      } finally {
        setTimeout(() => {
          isUpdatingContentRef.current = false;
          setIsSaving(false);
        }, 100);
      }
    },
    [onSaveItemData]
  );
  const debouncedSave = useCallback(
    debounce((itemId, content, direction) => saveContent(itemId, content, direction), 1500),
    [saveContent]
  );
  const handleEditorUpdates = useCallback(
    (newHtml, newDirection) => {
      currentEditorContentRef.current = newHtml;
      pendingContentRef.current = { content: newHtml, direction: newDirection };
      debouncedSave(item?.id, newHtml, newDirection);
    },
    [item?.id, debouncedSave]
  );
  const handleEditorFocus = useCallback(() => {
    editorHasFocusRef.current = true;
  }, []);
  const handleEditorBlur = useCallback(() => {
    editorHasFocusRef.current = false;
    if (pendingContentRef.current && !isUpdatingContentRef.current && item?.id) {
      const { content, direction } = pendingContentRef.current;
      debouncedSave.cancel();
      saveContent(item.id, content, direction);
    }
  }, [item?.id, saveContent, debouncedSave]);
  const toggleToolbar = useCallback(() => {
    if (isMobile) {
      setShowToolbar((prev) => {
        const newState = !prev;
        console.log("Toggling toolbar on mobile, new state:", newState);
        return newState;
      });
    }
  }, [isMobile]);
  const finalShowToolbar = isMobile ? showToolbar : true;
  console.log(
    "Rendering with isMobile:", isMobile, "showToolbar:", showToolbar, "finalShowToolbar prop to TipTapEditor:", finalShowToolbar
  );
  console.log("Passing to TipTapEditor:", {
    showToolbar: finalShowToolbar,
    key: `editor-${item?.id}`,
  });
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 pt-4 flex-shrink-0">
        <div className="flex items-start justify-between mb-1">
          <h2
            className={`text-xl font-semibold break-words text-zinc-800 dark:text-zinc-100 flex-1 mr-4 ${
              titleIsRTL ? "text-right" : ""
            }`}
            dir={titleIsRTL ? "rtl" : "ltr"}
          >
            {item?.label || "Unnamed Item"}
          </h2>
          <div className="flex items-center space-x-2">
            {isSaving && <LoadingSpinner size="small" variant="inline" text="Saving..." />}
            {!isSaving && lastSaved && (
              <span className="text-xs text-green-600 dark:text-green-400">
                Saved {formatTimestamp(lastSaved.toISOString())}
              </span>
            )}
          </div>
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 space-y-0.5">
          <p title={item?.createdAt ? new Date(item.createdAt).toISOString() : "Invalid or missing date"}>
            Created: {formatTimestamp(item?.createdAt)}
          </p>
          <p title={item?.updatedAt ? new Date(item.updatedAt).toISOString() : "Invalid or missing date"}>
            Last Modified: {formatTimestamp(item?.updatedAt)}
          </p>
          {item?.type === 'task' && (
            <div className="pt-1">
              {item.reminder?.isActive && item.reminder.dueAt ? (
                <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                    <Bell className="w-3.5 h-3.5" />
                    <span className="font-medium">
                        Reminds on {formatTimestamp(item.reminder.dueAt)}
                    </span>
                    <button onClick={() => onOpenReminderDialog(item)} className="text-xs underline hover:text-blue-700 dark:hover:text-blue-300">(edit)</button>
                </div>
              ) : (
                <button onClick={() => onOpenReminderDialog(item)} className="flex items-center gap-2 text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors">
                    <Bell className="w-3.5 h-3.5" />
                    <span>Set Reminder</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <TipTapEditor
        key={`editor-${item?.id}`}
        content={initialEditorContent}
        initialDirection={item?.direction || (titleIsRTL ? "rtl" : "ltr")}
        onUpdate={handleEditorUpdates}
        onFocus={handleEditorFocus}
        onBlur={handleEditorBlur}
        defaultFontFamily={defaultFontFamily}
        showToolbar={finalShowToolbar}
      />
      {renderToolbarToggle && renderToolbarToggle(showToolbar, toggleToolbar)}
    </div>
  );
});

export default ContentEditor;