import React, { useState, useEffect, useCallback, useRef } from "react";
import TipTapEditor from "./TipTapEditor";
import LoadingSpinner from "./LoadingSpinner";

const MOBILE_BREAKPOINT = 768; // px threshold for mobile

const formatTimestamp = (isoString) => {
  if (!isoString) return "N/A";
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) {
      return "Invalid Date";
    }
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
  const debouncedFunction = function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };

  debouncedFunction.cancel = function() {
    clearTimeout(timeoutId);
  };

  return debouncedFunction;
}

// helper to turn HTML-entities back into tags
function decodeHtml(str) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(str, "text/html");
  return doc.documentElement.textContent;
}

const ContentEditor = ({ item, onSaveItemData, defaultFontFamily }) => {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);

  // Mobile detection and toolbar toggle state
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" && window.innerWidth <= MOBILE_BREAKPOINT
  );
  const [showToolbar, setShowToolbar] = useState(!isMobile);

  if (!item) {
    return (
      <div className="p-4 text-red-500 dark:text-red-400">
        Error: Item data is missing. Cannot display editor.
      </div>
    );
  }

  const [initialEditorContent, setInitialEditorContent] = useState(
    item.content ? decodeHtml(item.content) : ""
  );

  const lastItemIdRef = useRef(item.id);
  const isUpdatingContentRef = useRef(false);
  const editorHasFocusRef = useRef(false);
  const pendingContentRef = useRef(null);
  const currentEditorContentRef = useRef(
    item.content ? decodeHtml(item.content) : ""
  );

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    // This effect runs whenever `isMobile` changes.
    // It resets the toolbar visibility to the default for the new mode.
    setShowToolbar(!isMobile);
  }, [isMobile]);

  useEffect(() => {
    if (item.id !== lastItemIdRef.current && !isUpdatingContentRef.current) {
      console.log('[ContentEditor] Item switched from', lastItemIdRef.current, 'to', item.id);
      const decoded = item.content ? decodeHtml(item.content) : "";
      setInitialEditorContent(decoded);
      currentEditorContentRef.current = decoded;
      lastItemIdRef.current = item.id;
      pendingContentRef.current = null;
      setIsSaving(false);
      setLastSaved(null);
    }
  }, [item.id, item.content]);

  const saveContent = useCallback(async (itemId, content, direction = "ltr") => {
    if (isUpdatingContentRef.current) {
      console.log('[ContentEditor] Save already in progress, skipping');
      return;
    }

    console.log('[ContentEditor] Saving content for item', itemId);
    isUpdatingContentRef.current = true;
    setIsSaving(true);

    try {
      const updates = { content, direction };
      await onSaveItemData(itemId, updates);
      console.log('[ContentEditor] Save successful for item', itemId);
      pendingContentRef.current = null;
      setLastSaved(new Date());
    } catch (error) {
      console.error('[ContentEditor] Save failed for item', itemId, error);
    } finally {
      setTimeout(() => {
        isUpdatingContentRef.current = false;
        setIsSaving(false);
      }, 100);
    }
  }, [onSaveItemData]);

  const debouncedSave = useCallback(
    debounce((itemId, content, direction) => {
      saveContent(itemId, content, direction);
    }, 1500),
    [saveContent]
  );

  const handleEditorUpdates = useCallback(
    (newHtml, newDirection) => {
      console.log('[ContentEditor] Editor content updated', {
        itemId: item.id,
        contentLength: newHtml?.length
      });

      currentEditorContentRef.current = newHtml;
      pendingContentRef.current = { content: newHtml, direction: newDirection };

      debouncedSave(item.id, newHtml, newDirection);
    },
    [item.id, debouncedSave]
  );

  const handleEditorFocus = useCallback(() => {
    editorHasFocusRef.current = true;
  }, []);

  const handleEditorBlur = useCallback(() => {
    editorHasFocusRef.current = false;

    if (pendingContentRef.current && !isUpdatingContentRef.current) {
      console.log('[ContentEditor] Pending content detected on blur, saving immediately');
      const { content, direction } = pendingContentRef.current;

      debouncedSave.cancel();
      saveContent(item.id, content, direction);
    }
  }, [item.id, saveContent, debouncedSave]);

  const toggleToolbar = () => {
    setShowToolbar(prev => !prev);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 pt-4 flex-shrink-0">
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-xl font-semibold break-words text-zinc-800 dark:text-zinc-100 flex-1 mr-4">
            {item.label}
          </h2>
          <div className="flex items-center space-x-2">
            {isSaving && (
              <LoadingSpinner
                size="small"
                variant="inline"
                text="Saving..."
              />
            )}
            {!isSaving && lastSaved && (
              <span className="text-xs text-green-600 dark:text-green-400">
                Saved {formatTimestamp(lastSaved.toISOString())}
              </span>
            )}
          </div>
        </div>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 space-y-0.5">
          <p
            title={item.createdAt && !isNaN(new Date(item.createdAt).getTime())
              ? new Date(item.createdAt).toISOString()
              : "Invalid or missing date"}
          >
            Created: {formatTimestamp(item.createdAt)}
          </p>
          <p
            title={item.updatedAt && !isNaN(new Date(item.updatedAt).getTime())
              ? new Date(item.updatedAt).toISOString()
              : "Invalid or missing date"}
          >
            Last Modified: {formatTimestamp(item.updatedAt)}
          </p>
        </div>
      </div>

      {/* Toolbar toggle on mobile */}
      {isMobile && (
        <div className="px-4 pb-2">
          <button
            className="toolbar-toggle-button px-3 py-1 border rounded"
            onClick={toggleToolbar}
          >
            {showToolbar ? "Hide Tools" : "Show Tools"}
          </button>
        </div>
      )}

      <TipTapEditor
        key={`editor-${item.id}`}
        content={initialEditorContent}
        initialDirection={item.direction || "ltr"}
        onUpdate={handleEditorUpdates}
        onFocus={handleEditorFocus}
        onBlur={handleEditorBlur}
        defaultFontFamily={defaultFontFamily}
        showToolbar={showToolbar}
      />
    </div>
  );
};

export default ContentEditor;