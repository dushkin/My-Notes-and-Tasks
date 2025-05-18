import React, { useState, useEffect, useCallback } from "react"; // [!] Added useCallback
import EditorPane from "./EditorPane";

// Debounce function
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

  // Create a debounced version of onSaveContent
  // We use useCallback to ensure the debounced function is not recreated on every render
  // unless item.id or onSaveContent changes.
  const debouncedSaveContent = useCallback(
    debounce((itemId, newHtml) => {
      onSaveContent(itemId, newHtml);
    }, 1000), // Delay of 1000ms (1 second) - adjust as needed
    [onSaveContent] // onSaveContent should be stable if passed from App.jsx correctly
  );

  const handleChange = (html) => {
    setBody(html); // Update internal state for responsiveness
    // Call the debounced save function instead of the original
    debouncedSaveContent(item.id, html);
  };

  return (
    <div className="p-0 flex flex-col flex-grow h-full">
      {" "}
      {/* Changed p-4 to p-0, EditorPane has p-3 */}
      <h2 className="text-xl font-semibold mb-3 px-4 pt-4 break-words text-zinc-800 dark:text-zinc-100">
        {" "}
        {/* Added explicit text colors */}
        {item.label}
      </h2>
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
