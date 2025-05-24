// src/components/ContentEditor.jsx
import React, { useState, useEffect, useCallback } from "react";
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
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
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

  useEffect(() => {
    setInitialEditorContent(item.content ?? "");
  }, [item.id, item.content, item.direction]);

  const debouncedSave = useCallback(
    debounce((itemId, updatesToSave) => {
      onSaveItemData(itemId, updatesToSave);
    }, 1000),
    [onSaveItemData]
  );

  const handleEditorUpdates = useCallback(
    (newHtml, newDirection) => {
      const updates = {
        content: newHtml,
        direction: newDirection,
      };
      debouncedSave(item.id, updates);
    },
    [item.id, debouncedSave]
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-4 pt-4 flex-shrink-0">
        <h2 className="text-xl font-semibold mb-1 break-words text-zinc-800 dark:text-zinc-100">
          {item.label}
        </h2>
        <div className="text-xs text-zinc-500 dark:text-zinc-400 mb-3 space-y-0.5">
          {item.createdAt && (
            <p title={new Date(item.createdAt).toISOString()}>
              נוצר: {formatTimestamp(item.createdAt)}
            </p>
          )}
          {item.updatedAt && (
            <p title={new Date(item.updatedAt).toISOString()}>
              עודכן לאחרונה: {formatTimestamp(item.updatedAt)}
            </p>
          )}
        </div>
      </div>

      <TipTapEditor
        key={item.id}
        content={initialEditorContent}
        initialDirection={item.direction || "ltr"}
        onUpdate={handleEditorUpdates}
        defaultFontFamily={defaultFontFamily}
      />
    </div>
  );
};

export default ContentEditor;
