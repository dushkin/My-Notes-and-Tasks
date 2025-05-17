import React, { useState, useEffect } from "react"; // Removed useCallback as it's not used here
import EditorPane from "./EditorPane";

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

  // Initialize state using the key prop in App.jsx to trigger re-initialization
  // The 'key' prop on ContentEditor in App.jsx (key={selectedItemId}) handles re-initialization.
  // So, useState can directly use item.content.
  const [body, setBody] = useState(item.content ?? "");

  // This useEffect will sync internal 'body' state if the 'item.content' prop changes
  // externally (e.g., due to undo/redo or another operation updating the item).
  useEffect(() => {
    setBody(item.content ?? "");
  }, [item.content, item.id]); // Depend on item.id as well if you want to reset for new item

  const handleChange = (html) => {
    // console.log(`ContentEditor: handleChange for item ${item.id}, new html:`, html.substring(0, 50) + "...");
    setBody(html); // Update internal state for responsiveness
    onSaveContent(item.id, html); // Propagate change up for saving
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
        html={body} // Use internal body state
        onChange={handleChange}
        defaultFontFamily={defaultFontFamily}
        defaultFontSize={defaultFontSize}
      />
    </div>
  );
};

export default ContentEditor;
