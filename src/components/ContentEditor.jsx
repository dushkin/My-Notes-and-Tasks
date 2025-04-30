// src/components/ContentEditor.jsx
import React, { useState, useEffect } from "react";
import EditorPane from "./EditorPane";

const ContentEditor = ({ item, onSaveContent }) => {
  // Defensive check
  if (!item) {
    console.error("ContentEditor RENDER ERROR: Received null or undefined 'item' prop.");
    return <div className="p-4 text-red-500">Error: Item data is missing.</div>;
  }

  console.log(`ContentEditor RENDER: Item ID=${item.id}, Label='${item.label}', Received Content=`, item.content);

  // Initialize state using the key prop in App.jsx to trigger re-initialization
  const [body, setBody] = useState(() => {
      console.log(`ContentEditor useState Init (ID: ${item.id}): Initializing body with content:`, item.content);
      // Use ?? to provide a default empty string if item.content is null or undefined
      return item.content ?? "";
  });

  // *** REMOVED the useEffect that synced item.content to body ***
  // The key={selectedItemId} on ContentEditor in App.jsx should handle resetting
  // the component state when the selected item changes.

  // Handler for changes within EditorPane
  const handleChange = (html) => {
    // console.log(`ContentEditor handleChange (ID: ${item.id}): Editor content changed.`);
    setBody(html); // Update internal state
    onSaveContent(item.id, html); // Propagate change upwards
  };

  // Render the editor UI
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">{item.label}</h2>
      {/* console.log(`ContentEditor RENDER: Passing body state to EditorPane (ID: ${item.id}):`, body) */}
      {/* Pass the internal body state to the EditorPane */}
      <EditorPane html={body} onChange={handleChange} />
    </div>
  );
};

export default ContentEditor;
