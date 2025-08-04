// src/pages/EditorPage.jsx
import React, { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import ContentEditor from "../../components/rpane/ContentEditor";
import { useTree } from "../../hooks/useTree";
import { findItemById } from "../../utils/treeUtils";
import { getAccessToken } from "../../services/authService";
import { authFetch } from "../../services/apiClient";
import { setupAndroidBackHandler, cleanupAndroidBackHandler } from "../../utils/androidBackHandler";

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

  // Handle browser back button/gesture to go back to tree
  useEffect(() => {
    // Setup Android back button handler for EditorPage
    // Since EditorPage is a separate route, we always want to go back to main app
    setupAndroidBackHandler(true, "content", () => {}, navigate);

    const handlePopState = (event) => {
      // Navigate back to main app tree view
      navigate("/");
    };

    window.addEventListener("popstate", handlePopState);
    return () => {
      cleanupAndroidBackHandler();
      window.removeEventListener("popstate", handlePopState);
    };
  }, [navigate]);

  // Get tree data and handlers
  const { tree, updateNoteContent, updateTask } = useTree(currentUser);

  // Find the item by ID
  const item = useMemo(() => {
    return findItemById(tree, id);
  }, [tree, id]);

  // Track the current item title via item data
  const title = item?.label || "";

  // Enhanced RTL detection for titles (similar to ContentEditor)
  const isRtl = useMemo(() => {
    if (!title) return false;
    
    // Enhanced RTL character detection - covers Hebrew, Arabic, Persian, etc.
    const rtlChars = /[\u0590-\u08FF]|[\uFB1D-\uFDFF]|[\uFE70-\uFEFF]/g;
    const rtlMatches = title.match(rtlChars) || [];
    
    // Remove spaces, numbers, punctuation, and English letters for better analysis
    const textForAnalysis = title.replace(/[\s\d\p{P}\p{S}a-zA-Z]/gu, "");
    
    if (textForAnalysis.length === 0) return false;
    
    // Lower threshold for better RTL detection (30% instead of 75%)
    const rtlRatio = rtlMatches.length / textForAnalysis.length;
    return rtlRatio > 0.3;
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
          onClick={() => navigate("/")}
          className="px-3 py-2 bg-blue-500 text-white rounded-md"
        >
          ← Back to Tree
        </button>

      </div>

      {/* Single ContentEditor with toolbar toggle functionality */}
      <div className="flex-1 m-2">
        {item ? (
          <div className="flex flex-col h-full">
            {/* Title Section */}
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700">
              <h1
                dir={isRtl ? "rtl" : "ltr"}
                className={`text-xl font-bold title-multiline ${isRtl ? "text-right" : "text-left"} text-zinc-900 dark:text-zinc-100`}
              >
                {title || "Untitled"}
              </h1>
            </div>
            <div className="flex-1">
              <ContentEditor
            item={item}
            onSaveItemData={handleSaveItemData}
            renderToolbarToggle={(toggleToolbar, showToolbar) => (
              <button
                className="toolbar-toggle-button px-3 py-1 rounded bg-slate-500 text-white hover:bg-slate-600"
                onClick={toggleToolbar}
                style={{ position: 'fixed', bottom: '20px', left: '20px', zIndex: 60 }}
              >
                {showToolbar ? "Hide Toolbar" : "Show Toolbar"}
              </button>
            )}
          />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500">
            {tree.length === 0 ? "Loading..." : "Item not found"}
          </div>
        )}
      </div>
    </div>
  );
}
