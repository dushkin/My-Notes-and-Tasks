// src/App.jsx
import React, { useState, useEffect, useCallback } from "react";
import Tree from "./components/Tree";
import FolderContents from "./components/FolderContents";
import ContentEditor from "./components/ContentEditor";
import ContextMenu from "./components/ContextMenu";
import AddDialog from "./components/AddDialog";
import AboutDialog from "./components/AboutDialog";
import { useTree } from "./hooks/useTree";
import { sortItems } from "./utils/treeUtils"; // Keep if used directly, otherwise maybe only in useTree.js
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Info } from "lucide-react";

// Helper to find item (could be moved to utils if not already there)
const findItemById = (nodes, id) => {
  if (!id || !Array.isArray(nodes)) return null;
  for (const item of nodes) {
    if (item.id === id) return item;
    if (Array.isArray(item.children)) {
      const found = findItemById(item.children, id);
      if (found) return found;
    }
  }
  return null;
};

const App = () => {
  // Destructure everything needed from the useTree hook
  const {
    tree,
    selectedItem,
    selectedItemId,
    selectItemById,
    contextMenu,
    setContextMenu,
    expandedFolders,
    toggleFolderExpand,
    expandFolderPath,
    updateNoteContent,
    updateTaskContent,
    renameItem, // Use the specific action from the hook
    deleteItem,
    draggedId,
    setDraggedId, // Need the setter for drag state
    handleDrop,
    clipboardItem,
    clipboardMode, // Maybe useful for UI feedback later
    copyItem,
    cutItem,
    pasteItem,
    addItem,
    duplicateItem, // NEW: duplicateItem function from the hook
  } = useTree();

  // Local UI state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newItemType, setNewItemType] = useState("folder"); // Default type for add dialog
  const [newItemLabel, setNewItemLabel] = useState("");
  const [parentItemForAdd, setParentItemForAdd] = useState(null); // Stores parent item object or null for root
  const [showError, setShowError] = useState(false); // For add dialog validation
  const [inlineRenameId, setInlineRenameId] = useState(null); // ID of item being renamed inline
  const [inlineRenameValue, setInlineRenameValue] = useState(""); // Current value in inline input
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false); // For About dialog visibility

  // --- Inline Rename Logic ---
  const startInlineRename = useCallback((itemToRename) => {
      if (!itemToRename) return;
      setInlineRenameId(itemToRename.id);
      setInlineRenameValue(itemToRename.label);
      setContextMenu((m) => ({ ...m, visible: false })); // Close context menu
  }, []);

  // Uses the renameItem function from useTree hook
  const finishInlineRename = useCallback(() => {
      if (!inlineRenameId) return;
      const originalItem = findItemById(tree, inlineRenameId); // Find item to compare label
      const newLabel = inlineRenameValue.trim();
      // Only call renameItem if the label is valid and actually changed
      if (newLabel && newLabel !== originalItem?.label) {
          renameItem(inlineRenameId, newLabel);
      }
      setInlineRenameId(null); // Clear inline rename state regardless
      setInlineRenameValue(""); // Clear value
  }, [inlineRenameId, inlineRenameValue, renameItem, tree]);

  const cancelInlineRename = useCallback(() => {
      setInlineRenameId(null);
      setInlineRenameValue("");
  }, []);

  // --- Add Item Logic (UI Control) ---
  const handleAddItem = useCallback((type, parent) => {
      setNewItemType(type);
      setParentItemForAdd(parent); // parent can be null for root items
      setNewItemLabel(""); // Clear label for new dialog
      setShowError(false); // Reset error
      setAddDialogOpen(true); // Open dialog
      setContextMenu((m) => ({ ...m, visible: false })); // Close context menu
  }, []);

  // This function creates the item and calls the addItem hook function
  const handleAdd = useCallback(() => {
      if (!newItemLabel.trim()) {
        setShowError(true); // Show validation error
        return;
      }
      // 1. Create the new item object based on dialog state
      const newItem = {
        // Use a robust ID generation method
        id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9),
        type: newItemType,
        label: newItemLabel.trim(),
        ...(newItemType === "folder" ? { children: [] } : {}),
        ...(newItemType === "task" ? { completed: false, content: "" } : {}),
        ...(newItemType === "note" ? { content: "" } : {}),
      };
      const parentId = parentItemForAdd?.id || null; // Get parent ID or null for root

      // 2. Call the addItem function from the useTree hook
      addItem(newItem, parentId);

      // 3. Handle UI updates after add attempt (hook handles persistence)
      setAddDialogOpen(false); // Close dialog
      if (parentId) {
        expandFolderPath(parentId); // Expand parent after adding child
      }
      // Reset dialog state
      setNewItemLabel("");
      setParentItemForAdd(null);
      setShowError(false);
  }, [newItemLabel, newItemType, parentItemForAdd, addItem, expandFolderPath]);

  // --- Toggle Task Logic ---
  const handleToggleTask = useCallback((id, completed) => {
       // Placeholder - Needs proper implementation in useTree
       console.warn("toggleTask logic should ideally be moved into useTree hook");
       const task = findItemById(tree, id);
       if(task && task.type === 'task') {
           // Example: updateTaskContent(id, task.content, completed);
       }
  }, [tree, updateTaskContent]);

  // --- Drag End Handler ---
  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
  }, [setDraggedId]);

  // --- Keyboard Shortcuts Effect ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      const treeNav = document.querySelector('nav[aria-label="Notes and Tasks Tree"]');
      const isTreeFocused = treeNav && (treeNav.contains(document.activeElement) || treeNav === document.activeElement);
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.contentEditable === 'true') {
          return;
      }

      if (e.key === "F2" && selectedItemId && isTreeFocused && !inlineRenameId) {
          e.preventDefault();
          const item = findItemById(tree, selectedItemId);
          startInlineRename(item);
      }
      if (e.ctrlKey && e.key === 'c' && selectedItemId && isTreeFocused) {
         e.preventDefault();
         copyItem(selectedItemId);
      }
       if (e.ctrlKey && e.key === 'x' && selectedItemId && isTreeFocused) {
         e.preventDefault();
         cutItem(selectedItemId);
      }
       if (e.ctrlKey && e.key === 'v' && clipboardItem && isTreeFocused) {
          e.preventDefault();
          const currentItem = findItemById(tree, selectedItemId);
          const targetId = currentItem?.type === 'folder' ? selectedItemId : null;
          pasteItem(targetId);
       }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItemId, inlineRenameId, startInlineRename, copyItem, cutItem, pasteItem, clipboardItem, tree, selectedItem]);

  // --- Render Component ---
  return (
    // Outer container for fixed layout
    <div className="fixed inset-0 flex flex-col bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
      {/* Resizable Panels */}
      <PanelGroup direction="horizontal" className="flex-1">
        {/* Left Panel (Tree) */}
        <Panel
          defaultSize={25}
          minSize={15}
          maxSize={50}
          className="flex flex-col !overflow-hidden bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-700"
        >
          <div className="flex flex-col h-full">
            {/* Top Bar */}
            <div className="p-2 flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
               <h2 className="font-medium text-sm sm:text-base whitespace-nowrap overflow-hidden text-ellipsis mr-2">
                 Notes & Tasks
               </h2>
               {/* Action Buttons */}
               <div className="flex items-center space-x-1 sm:space-x-2">
                <button
                  onClick={() => handleAddItem("folder", null)}
                  className="px-2 sm:px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs sm:text-sm"
                  title="Add Top Level Folder"
                >
                  Add Folder
                </button>
                <button
                  onClick={() => setAboutDialogOpen(true)}
                  className="p-1 sm:p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                  title="About this application"
                >
                   <Info className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Tree View Container */}
            <div className="flex-grow overflow-auto">
              <Tree
                items={tree}
                selectedItemId={selectedItemId}
                onSelect={selectItemById}
                inlineRenameId={inlineRenameId}
                inlineRenameValue={inlineRenameValue}
                setInlineRenameValue={setInlineRenameValue}
                finishInlineRename={finishInlineRename}
                cancelInlineRename={cancelInlineRename}
                expandedFolders={expandedFolders}
                onToggleExpand={toggleFolderExpand}
                onToggleTask={handleToggleTask}
                draggedId={draggedId}
                onDragStart={(e, id) => {
                  if (inlineRenameId) { e.preventDefault(); return; }
                  e.dataTransfer.setData('text/plain', id);
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggedId(id);
                }}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onContextMenu={(e, item) => {
                  if (draggedId || inlineRenameId) { e.preventDefault(); return; }
                  selectItemById(item?.id ?? null);
                  setContextMenu({
                    visible: true,
                    x: e.clientX,
                    y: e.clientY,
                    item,
                    isEmptyArea: !item,
                  });
                }}
                onRename={startInlineRename}
              />
            </div>
          </div>
        </Panel>
        {/* Resize Handle */}
        <PanelResizeHandle className="w-1.5 h-full bg-transparent hover:bg-blue-500/50 data-[resize-handle-active]:bg-blue-600/50 cursor-col-resize z-20" />
        {/* Right Panel (Content) */}
        <Panel minSize={30} className="flex flex-col bg-white dark:bg-zinc-800">
          <div className="flex-grow p-1 sm:p-4 overflow-auto h-full">
            {selectedItem ? (
              selectedItem.type === "folder" ? (
                <div className="p-3">
                  <h2 className="text-lg sm:text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100 break-words">
                    {selectedItem.label}
                  </h2>
                  <FolderContents folder={selectedItem} onSelect={selectItemById} />
                </div>
              ) : (
                <ContentEditor
                  key={selectedItemId}
                  item={selectedItem}
                  onSaveContent={
                    selectedItem.type === "task"
                      ? updateTaskContent
                      : updateNoteContent
                  }
                />
              )
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-500 dark:text-zinc-400">
                Select or create an item.
              </div>
            )}
          </div>
        </Panel>
      </PanelGroup>

      {/* --- Modals and Context Menu --- */}
      {contextMenu.visible && (
        <ContextMenu
          visible={true}
          x={contextMenu.x}
          y={contextMenu.y}
          item={contextMenu.item}
          isEmptyArea={contextMenu.isEmptyArea}
          clipboardItem={clipboardItem}
          onAddRootFolder={() => handleAddItem("folder", null)}
          onAddFolder={() => contextMenu.item && handleAddItem("folder", contextMenu.item)}
          onAddNote={() => contextMenu.item && handleAddItem("note", contextMenu.item)}
          onAddTask={() => contextMenu.item && handleAddItem("task", contextMenu.item)}
          onRename={() => contextMenu.item && startInlineRename(contextMenu.item)}
          onDelete={() => contextMenu.item && deleteItem(contextMenu.item.id)}
          onDuplicate={() => {
             if (contextMenu.item) {
               duplicateItem(contextMenu.item.id);
             }
          }}
          onClose={() => setContextMenu((m) => ({ ...m, visible: false }))}
          onCopy={() => contextMenu.item && copyItem(contextMenu.item.id)}
          onCut={() => contextMenu.item && cutItem(contextMenu.item.id)}
          onPaste={() => {
               const targetId = contextMenu.isEmptyArea
                 ? null
                 : (contextMenu.item?.type === 'folder' ? contextMenu.item.id : null);
               if (contextMenu.isEmptyArea || contextMenu.item?.type === 'folder') {
                    pasteItem(targetId);
               } else {
                   console.warn("Paste target is not a folder or the root area.");
                   setContextMenu((m) => ({ ...m, visible: false }));
               }
          }}
        />
      )}

      {/* Add Item Dialog */}
      <AddDialog
        isOpen={addDialogOpen}
        newItemType={newItemType}
        newItemLabel={newItemLabel}
        showError={showError}
        onLabelChange={(e) => {
          setNewItemLabel(e.target.value);
          if (e.target.value.trim()) setShowError(false);
        }}
        onAdd={handleAdd}
        onCancel={() => setAddDialogOpen(false)}
      />

      {/* About Dialog */}
      <AboutDialog
          isOpen={aboutDialogOpen}
          onClose={() => setAboutDialogOpen(false)}
      />
    </div>
  );
};

export default App;
