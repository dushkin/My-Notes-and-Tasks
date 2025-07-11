// src/pages/EditorPage.jsx
import React, { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ContentEditor from "../components/ContentEditor";

export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Track the current item title via callback from ContentEditor
  const [title, setTitle] = useState("");

  // Detect RTL-heavy titles (more than 75% RTL characters)
  const isRtl = useMemo(() => {
    const total = title.length;
    const rtlChars = (title.match(/[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/g) || []).length;
    return total > 0 && rtlChars / total > 0.75;
  }, [title]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between m-2">
        <button
          onClick={() => navigate(-1)}
          className="px-3 py-2 bg-blue-500 text-white rounded-md"
        >
          ← Back to Tree
        </button>
        {/* Render toolbar toggle and capture title changes */}
        <ContentEditor
          itemId={id}
          renderToolbarToggle={(showToolbar, toggleToolbar) => (
            <button
              className="toolbar-toggle-button px-3 py-1 border rounded"
              onClick={toggleToolbar}
            >
              {showToolbar ? "Hide Tools" : "Show Tools"}
            </button>
          )}
          onTitleChange={setTitle}
        />
      </div>

      {/* Title display with RTL detection */}
      {title && (
        <h1
          dir={isRtl ? "rtl" : "ltr"}
          className={`text-2xl font-bold ${isRtl ? "text-right" : "text-left"}`}
        >
          {title}
        </h1>
      )}

      {/* Main editor content */}
      <ContentEditor itemId={id} />
    </div>
  );
}
