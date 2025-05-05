// src/components/ContentEditor.jsx
import React, { useState, useEffect } from "react";
import EditorPane from "./EditorPane";

// Added defaultFontFamily and defaultFontSize props
const ContentEditor = ({ item, onSaveContent, defaultFontFamily, defaultFontSize }) => {
  // Defensive check
  if (!item) {
    console.error("ContentEditor RENDER ERROR: Received null or undefined 'item' prop.");
    return <div className="p-4 text-red-500">Error: Item data is missing.</div>;
  }

  // Initialize state using the key prop in App.jsx to trigger re-initialization
  const [body, setBody] = useState(() => {
      // Use ?? to provide a default empty string if item.content is null or undefined
      return item.content ?? "";
  });

  // Handler for changes within EditorPane
  const handleChange = (html) => {
    setBody(html); // Update internal state
    onSaveContent(item.id, html); // Propagate change upwards
  };

  // Render the editor UI
  return (
    <div className="p-4 flex flex-col flex-grow">
      {/* Added margin-bottom to title */}
      <h2 className="text-xl font-semibold mb-3 break-words">{item.label}</h2>
      {/* Pass the internal body state AND default font settings to the EditorPane */}
      <EditorPane
        html={body}
        onChange={handleChange}
        defaultFontFamily={defaultFontFamily} // Pass down
        defaultFontSize={defaultFontSize}     // Pass down
      />
    </div>
  );
};

export default ContentEditor;