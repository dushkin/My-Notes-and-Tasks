// src/components/ContentEditor.jsx - Simplified version with immediate save on blur
import React, { useState, useEffect, useCallback, useRef } from "react";
import TipTapEditor from "./TipTapEditor";

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
  
  // Add cancel method
  debouncedFunction.cancel = function() {
    clearTimeout(timeoutId);
  };
  
  return debouncedFunction;
}

const ContentEditor = ({ item, onSaveItemData, defaultFontFamily }) => {
  if (!item) {
    return (
      <div className="p-4 text-red-500 dark:text-red-400">
        Error: Item data is missing. Cannot display editor.
      </div>
    );
  }

  const [initialEditorContent, setInitialEditorContent] = useState(
    item.content ?? ""
  );

  // Track state
  const lastItemIdRef = useRef(item.id);
  const isUpdatingContentRef = useRef(false);
  const editorHasFocusRef = useRef(false);
  const pendingContentRef = useRef(null); // Store content that needs to be saved
  const currentEditorContentRef = useRef(item.content ?? "");

  useEffect(() => {
    // Only update editor content if we switched to a different item
    if (item.id !== lastItemIdRef.current && !isUpdatingContentRef.current) {
      console.log('[ContentEditor] Item switched from', lastItemIdRef.current, 'to', item.id);
      setInitialEditorContent(item.content ?? "");
      lastItemIdRef.current = item.id;
      currentEditorContentRef.current = item.content ?? "";
      pendingContentRef.current = null; // Clear any pending content
    }
  }, [item.id, item.content]);

  const saveContent = useCallback(async (itemId, content, direction = "ltr") => {
    if (isUpdatingContentRef.current) {
      console.log('[ContentEditor] Save already in progress, skipping');
      return;
    }

    console.log('[ContentEditor] Saving content for item', itemId);
    isUpdatingContentRef.current = true;
    
    try {
      const updates = { content, direction };
      await onSaveItemData(itemId, updates);
      console.log('[ContentEditor] Save successful for item', itemId);
      pendingContentRef.current = null; // Clear pending content after successful save
    } catch (error) {
      console.error('[ContentEditor] Save failed for item', itemId, error);
    } finally {
      setTimeout(() => {
        isUpdatingContentRef.current = false;
      }, 100);
    }
  }, [onSaveItemData]);

  const debouncedSave = useCallback(
    debounce((itemId, content, direction) => {
      saveContent(itemId, content, direction);
    }, 1500), // 1.5 second debounce for auto-save while typing
    [saveContent]
  );

  const handleEditorUpdates = useCallback(
    (newHtml, newDirection) => {
      console.log('[ContentEditor] Editor content updated', {
        itemId: item.id,
        contentLength: newHtml?.length
      });
      
      // Store the current content
      currentEditorContentRef.current = newHtml;
      pendingContentRef.current = { content: newHtml, direction: newDirection };
      
      // Debounced save while typing
      debouncedSave(item.id, newHtml, newDirection);
    },
    [item.id, debouncedSave]
  );

  const handleEditorFocus = useCallback(() => {
    console.log('[ContentEditor] Editor gained focus');
    editorHasFocusRef.current = true;
  }, []);

  const handleEditorBlur = useCallback(() => {
    console.log('[ContentEditor] Editor lost focus');
    editorHasFocusRef.current = false;
    
    // If there's pending content that hasn't been saved, save it immediately
    if (pendingContentRef.current && !isUpdatingContentRef.current) {
      console.log('[ContentEditor] Pending content detected on blur, saving immediately');
      const { content, direction } = pendingContentRef.current;
      
      // Cancel the debounced save since we're saving immediately
      debouncedSave.cancel();
      
      // Save immediately
      saveContent(item.id, content, direction);
    }
  }, [item.id, saveContent, debouncedSave]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 pt-4 flex-shrink-0">
        <h2 className="text-xl font-semibold mb-1 break-words text-zinc-800 dark:text-zinc-100">
          {item.label}
        </h2>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 space-y-0.5">
          <p
            title={
              item.createdAt && !isNaN(new Date(item.createdAt).getTime())
                ? new Date(item.createdAt).toISOString()
                : "Invalid or missing date"
            }
          >
            Created: {formatTimestamp(item.createdAt)}
          </p>
          <p
            title={
              item.updatedAt && !isNaN(new Date(item.updatedAt).getTime())
                ? new Date(item.updatedAt).toISOString()
                : "Invalid or missing date"
            }
          >
            Last Modified: {formatTimestamp(item.updatedAt)}
          </p>
        </div>
      </div>

      <TipTapEditor
        key={`editor-${item.id}`}
        content={initialEditorContent}
        initialDirection={item.direction || "ltr"}
        onUpdate={handleEditorUpdates}
        onFocus={handleEditorFocus}
        onBlur={handleEditorBlur}
        defaultFontFamily={defaultFontFamily}
      />
    </div>
  );
};

export default ContentEditor;