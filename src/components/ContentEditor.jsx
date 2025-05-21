// src/components/ContentEditor.jsx
import React, { useState, useEffect, useCallback } from "react";
import TipTapEditor from "./TipTapEditor"; // Assuming TipTapEditor is your new editor component

function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

const ContentEditor = ({
  item,
  onSaveContent,
  defaultFontFamily,
  // defaultFontSize, // TipTap handles font sizes differently
}) => {
  if (!item) {
    console.error(
      "ContentEditor RENDER ERROR: Received null or undefined 'item' prop."
    );
    return (
      <div className="p-4 text-red-500 dark:text-red-400">
        Error: Item data is missing. Cannot display editor.
      </div>
    );
  }

  // Local state for TipTap's initial content.
  // It only updates when item.id changes (i.e., a new note is selected).
  // This prevents prop-driven re-renders of TipTap with stale content during active editing.
  const [initialEditorContent, setInitialEditorContent] = useState(
    item.content ?? ""
  );

  useEffect(() => {
    // When a new item is selected (item.id changes), reset TipTap's initial content.
    setInitialEditorContent(item.content ?? "");
  }, [item.id, item.content]); // Also update if item.content changes due to external source (e.g. undo from app state)

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSaveContent = useCallback(
    debounce((itemId, newHtml) => {
      onSaveContent(itemId, newHtml);
    }, 1000),
    [onSaveContent] // onSaveContent from App.jsx should be stable
  );

  const handleEditorChange = (newHtml) => {
    // This function is called by TipTapEditor's onUpdate
    debouncedSaveContent(item.id, newHtml);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <h2 className="text-xl font-semibold mb-3 px-4 pt-4 break-words text-zinc-800 dark:text-zinc-100 flex-shrink-0">
        {item.label}
      </h2>

      <TipTapEditor
        // The key is crucial: when item.id changes, TipTapEditor will re-mount,
        // ensuring it initializes with the new initialEditorContent.
        key={item.id}
        content={initialEditorContent} // Pass the initial content for this item
        onChange={handleEditorChange} // Callback for when content changes within TipTap
        defaultFontFamily={defaultFontFamily}
      />
    </div>
  );
};

export default ContentEditor;
