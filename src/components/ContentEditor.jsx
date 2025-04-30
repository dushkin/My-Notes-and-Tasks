import React, { useState, useEffect } from "react";
import EditorPane from "./EditorPane";

const ContentEditor = ({ item, onSaveContent }) => {
  const [body, setBody] = useState(item.content || "");

  // Reset when switching items
  useEffect(() => {
    setBody(item.content || "");
  }, [item.id, item.content]);

  const handleChange = html => {
    setBody(html);
    onSaveContent(item.id, html);
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-semibold">{item.label}</h2>
      <EditorPane html={body} onChange={handleChange} />
    </div>
  );
};

export default ContentEditor;
