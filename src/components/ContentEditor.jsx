// src/components/ContentEditor.jsx
import React, { useState, useEffect, useCallback } from "react";
import TipTapEditor from "./TipTapEditor";

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
    // The TipTapEditor will use its own state for direction, initialized by item.direction
  }, [item.id, item.content, item.direction]);

  // Debounced function now takes an updates object
  const debouncedSave = useCallback(
    debounce((itemId, updatesToSave) => {
      onSaveItemData(itemId, updatesToSave);
    }, 1000),
    [onSaveItemData]
  );

  // Called by TipTapEditor when content OR direction changes
  const handleEditorUpdates = useCallback(
    (newHtml, newDirection) => {
      // Prepare updates, only include fields that have changed or are always sent
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
      <h2 className="text-xl font-semibold mb-3 px-4 pt-4 break-words text-zinc-800 dark:text-zinc-100 flex-shrink-0">
        {item.label}
      </h2>

      <TipTapEditor
        key={item.id} // Re-mounts when item changes
        content={initialEditorContent} // Initial content for this item
        initialDirection={item.direction || "ltr"} // Pass initial direction
        onUpdate={handleEditorUpdates} // Unified callback for content & direction
        defaultFontFamily={defaultFontFamily}
      />
    </div>
  );
};

export default ContentEditor;
