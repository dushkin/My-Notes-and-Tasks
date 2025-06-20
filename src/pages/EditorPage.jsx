import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ContentEditor from '../components/ContentEditor';

export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col h-full">
      <button
        onClick={() => navigate(-1)}
        className="m-2 px-3 py-2 bg-blue-500 text-white rounded-md self-start"
      >
        ← Back to Tree
      </button>
      <ContentEditor itemId={id} />
    </div>
  );
}
