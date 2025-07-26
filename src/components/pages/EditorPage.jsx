// src/pages/EditorPage.jsx
import React, { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ContentEditor from "../../components/rpane/ContentEditor";
import { useTree } from "../../hooks/useTree";
import { findItemById } from "../../utils/treeUtils";
import { getAccessToken } from "../../services/authService";
import { authFetch } from "../../services/apiClient";

export default function EditorPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Check authentication
  useEffect(() => {
    const checkAuth = async () => {
      const token = getAccessToken();
      if (token) {
        try {
          const response = await authFetch("/auth/verify-token");
          if (response.ok) {
            const data = await response.json();
            if (data.valid && data.user) {
              setCurrentUser(data.user);
            } else {
              navigate("/");
            }
          } else {
            navigate("/");
          }
        } catch (error) {
          console.error("Auth verification failed:", error);
          navigate("/");
        }
      } else {
        navigate("/");
      }
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, [navigate]);

  // Get tree data and handlers
  const { tree, updateNoteContent, updateTask } = useTree(currentUser);

  // Find the item by ID
  const item = useMemo(() => {
    return findItemById(tree, id);
  }, [tree, id]);

  // Track the current item title via item data
  const title = item?.label || "";

  // Detect RTL-heavy titles (more than 75% RTL characters)
  const isRtl = useMemo(() => {
    const total = title.length;
    const rtlChars = (title.match(/[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/g) || []).length;
    return total > 0 && rtlChars / total > 0.75;
  }, [title]);

  // Handle saving item data
  const handleSaveItemData = async (itemId, updates) => {
    if (!item) return;
    
    try {
      if (item.type === 'task') {
        await updateTask(itemId, updates);
      } else {
        await updateNoteContent(itemId, updates.content, updates.direction);
      }
    } catch (error) {
      console.error('Failed to save item:', error);
      throw error;
    }
  };

  // Show loading while checking authentication
  if (isCheckingAuth) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-gray-400 dark:text-gray-500">Loading...</div>
      </div>
    );
  }

  // Don't render anything if not authenticated (will redirect)
  if (!currentUser) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between m-2">
        <button
          onClick={() => navigate(-1)}
          className="px-3 py-2 bg-blue-500 text-white rounded-md"
        >
          ← Back to Tree
        </button>

        {/* Title display with RTL detection */}
        {title && (
          <h1
            dir={isRtl ? "rtl" : "ltr"}
            className={`text-xl font-bold ${isRtl ? "text-right" : "text-left"} flex-1 mx-4`}
          >
            {title}
          </h1>
        )}
      </div>

      {/* Single ContentEditor with toolbar toggle functionality */}
      <div className="flex-1 m-2">
        {item ? (
          <ContentEditor
            item={item}
            onSaveItemData={handleSaveItemData}
            renderToolbarToggle={(toggleToolbar, showToolbar) => (
              <button
                className="toolbar-toggle-button px-3 py-1 rounded bg-slate-500 text-white hover:bg-slate-600"
                onClick={toggleToolbar}
                style={{ position: 'fixed', bottom: '20px', left: '20px', zIndex: 99999 }}
              >
                {showToolbar ? "Hide Toolbar" : "Show Toolbar"}
              </button>
            )}
          />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
            {tree.length === 0 ? "Loading..." : "Item not found"}
          </div>
        )}
      </div>
    </div>
  );
}
