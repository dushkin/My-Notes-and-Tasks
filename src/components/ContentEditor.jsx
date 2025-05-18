// src/components/ContentEditor.jsx
import React, { useState, useEffect, useCallback } from "react";
import EditorPane from "./EditorPane";

// Debounce function (from previous step)
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
  defaultFontSize,
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

  const [body, setBody] = useState(item.content ?? "");

  useEffect(() => {
    setBody(item.content ?? "");
  }, [item.content, item.id]);

  const debouncedSaveContent = useCallback(
    debounce((itemId, newHtml) => {
      onSaveContent(itemId, newHtml);
    }, 1000),
    [onSaveContent]
  );

  const handleChange = (html) => {
    setBody(html);
    debouncedSaveContent(item.id, html);
  };

  return (
    // This div defines the overall structure for the content view area.
    // - flex flex-col: Stacks children (title, editor pane) vertically.
    // - h-full: Takes the full height available from its parent Panel in App.jsx.
    // - overflow-hidden: Crucial. Ensures that this container doesn't scroll.
    //                    Instead, EditorPane's internal scrollable area will handle it.
    <div className="flex flex-col h-full overflow-hidden">
      {/* Item Title */}
      {/* - flex-shrink-0: Prevents this title area from shrinking if space is scarce. */}
      {/* - Styling classes for padding, font, color, etc. */}
      <h2 className="text-xl font-semibold mb-3 px-4 pt-4 break-words text-zinc-800 dark:text-zinc-100 flex-shrink-0">
        {item.label}
      </h2>

      {/* Editor Pane */}
      {/* - EditorPane itself is now responsible for its internal layout:
            - Toolbar fixed at its top.
            - Content area below toolbar scrollable.
          - It will grow to fill the remaining vertical space in this flex container (due to flex-grow in its own root).
      */}
      <EditorPane
        html={body}
        onChange={handleChange}
        defaultFontFamily={defaultFontFamily}
        defaultFontSize={defaultFontSize}
      />
    </div>
  );
};

export default ContentEditor;
