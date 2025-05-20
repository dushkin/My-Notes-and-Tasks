// src/components/ContentEditor.jsx
import React, { useCallback } from "react";
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

const ContentEditor = ({
  item,
  onSaveContent,
  defaultFontFamily,
  // defaultFontSize, // TipTap handles font sizes via CSS/headings primarily
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

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debouncedSaveContent = useCallback(
    debounce((itemId, newHtml) => {
      onSaveContent(itemId, newHtml);
    }, 1000),
    [onSaveContent] // Assuming onSaveContent from App.jsx is stable
  );

  const handleChange = (newHtml) => {
    debouncedSaveContent(item.id, newHtml);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <h2 className="text-xl font-semibold mb-3 px-4 pt-4 break-words text-zinc-800 dark:text-zinc-100 flex-shrink-0">
        {item.label}
      </h2>

      <TipTapEditor
        key={item.id}
        content={item.content ?? ""}
        onChange={handleChange}
        defaultFontFamily={defaultFontFamily}
      />
    </div>
  );
};

export default ContentEditor;
