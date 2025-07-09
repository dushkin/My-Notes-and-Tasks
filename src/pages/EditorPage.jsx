// src/pages/EditorPage.jsx
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import ContentEditor from "../components/ContentEditor";

export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between m-2">
        <button
          onClick={() => navigate(-1)}
          className="px-3 py-2 bg-blue-500 text-white rounded-md"
        >
          ← Back to Tree
        </button>
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
        />
      </div>
      <ContentEditor itemId={id} /> {/* Render the editor content */}
    </div>
  );
}