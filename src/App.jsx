// src/App.jsx
import React, { useState, useEffect } from "react";
import Tree from "./components/Tree";
import FolderContents from "./components/FolderContents";
import ContentEditor from "./components/ContentEditor";
import ContextMenu from "./components/ContextMenu";
import AddDialog from "./components/AddDialog";
import { useTree } from "./hooks/useTree";
import { sortItems } from "./utils/treeUtils";
import { LOCAL_STORAGE_KEY } from "./utils/constants";

// Helper function (can be moved to utils)
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
  const {
    tree,
    setTree, // Use the hook's setter which includes persistence
    // *** Use derived selectedItem and ID setter from the hook ***
    selectedItem,     // The derived selected item object
    selectedItemId,   // The ID of the selected item
    selectItemById,   // Function to set the selected item ID
    // ---
    contextMenu,
    setContextMenu,
    expandedFolders,
    toggleFolderExpand,
    expandFolderPath,
    handleEmptyAreaContextMenu,
    updateNoteContent,
    updateTaskContent,
    deleteItem,
    draggedId,
    setDraggedId,
    handleDrop,
  } = useTree();

  // Add-dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newItemType, setNewItemType] = useState("folder");
  const [newItemLabel, setNewItemLabel] = useState("");
  const [parentItemForAdd, setParentItemForAdd] = useState(null); // Renamed to avoid confusion
  const [showError, setShowError] = useState(false);

  // Inline-rename state
  const [inlineRenameId, setInlineRenameId] = useState(null);
  const [inlineRenameValue, setInlineRenameValue] = useState("");

  // Start inline rename - needs the item object
  const startInlineRename = (itemToRename) => {
    if (!itemToRename) return; // Guard against null item
    setInlineRenameId(itemToRename.id);
    setInlineRenameValue(itemToRename.label);
    setContextMenu((m) => ({ ...m, visible: false }));
  };

  // Finish inline rename - uses setTree directly
  const finishInlineRename = () => {
    if (!inlineRenameId) return;
    const newLabel = inlineRenameValue.trim();
    if (!newLabel) {
      setInlineRenameId(null); // Cancel if label is empty
      return;
    }
    // Use the hook's setter function
    setTree((prevTree) => {
      const recurse = (arr) =>
        arr.map((it) => {
          if (it.id === inlineRenameId) {
            return { ...it, label: newLabel }; // Update label
          }
          // Ensure children is an array before recursing
          if (Array.isArray(it.children)) {
            const updatedChildren = recurse(it.children);
            return updatedChildren !== it.children ? { ...it, children: updatedChildren } : it;
          }
          return it;
        });
      // No need to manually persist here, setTree from useTree handles it
      return recurse(prevTree);
    });
    setInlineRenameId(null); // Clear rename state
  };

  const cancelInlineRename = () => {
    setInlineRenameId(null);
  };

  // F2 -> rename effect
  useEffect(() => {
    const onKey = (e) => {
      // Use the derived selectedItem here
      if (e.key === "F2" && selectedItem && !inlineRenameId) {
        e.preventDefault();
        startInlineRename(selectedItem); // Pass the derived object
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // Depend on the derived selectedItem object
  }, [selectedItem, inlineRenameId]); // Keep inlineRenameId dependency

  // Open add-dialog
  const handleAddItem = (type, parent) => {
    setNewItemType(type);
    // Store the parent object for context, but use its ID later if needed
    setParentItemForAdd(parent);
    setNewItemLabel("");
    setShowError(false);
    setAddDialogOpen(true);
    setContextMenu((m) => ({ ...m, visible: false }));
  };

  // Actually add item
  const handleAdd = () => {
    if (!newItemLabel.trim()) {
      setShowError(true);
      return;
    }
    const newItem = {
      id: Date.now().toString(),
      type: newItemType,
      label: newItemLabel,
      ...(newItemType === "folder" ? { children: [] } : {}),
      ...(newItemType === "task" ? { completed: false, content: "" } : {}),
      ...(newItemType === "note" ? { content: "" } : {}),
    };
    const parentId = parentItemForAdd?.id || null; // Get parent ID

    // Use the hook's setter
    setTree((prevTree) => {
      // It's generally safer to work with immutable updates
      let nextTree;
      if (parentId) { // Add to a specific parent
        const recurse = (arr) =>
          arr.map((it) => {
            if (it.id === parentId) {
              // Ensure children is an array before spreading
              const currentChildren = Array.isArray(it.children) ? it.children : [];
              return {
                ...it,
                children: sortItems([...currentChildren, newItem]),
              };
            }
            if (Array.isArray(it.children)) {
              const ch = recurse(it.children);
              // Avoid creating new object if children didn't change
              return ch !== it.children ? { ...it, children: ch } : it;
            }
            return it;
          });
        nextTree = recurse(prevTree); // Use prevTree directly
      } else { // Add to root level
        nextTree = sortItems([...prevTree, newItem]);
      }
      return nextTree; // Return the new state for the hook's setter
    });

    setAddDialogOpen(false);
    if (parentId) expandFolderPath(parentId); // Ensure parent is expanded
  };

   // Toggle Task Completion
   const handleToggleTask = (id, completed) => {
      // Use the hook's setter
      setTree((prevTree) => {
        const recurse = (arr) =>
          arr.map((it) => {
            if (it.id === id) {
              return { ...it, completed }; // Update status
            }
            if (Array.isArray(it.children)) {
              const updatedChildren = recurse(it.children);
              return updatedChildren !== it.children ? { ...it, children: updatedChildren } : it;
            }
            return it;
          });
        // No need to manually persist
        return recurse(prevTree);
      });
      // Note: selectedItem will update automatically via useMemo if needed
   };


  return (
    <div className="grid grid-cols-1 md:grid-cols-4 h-screen">
      {/* Sidebar */}
      <div className="col-span-1 border-r overflow-auto bg-white dark:bg-zinc-900">
        <div className="p-2 flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-900 z-10">
          <h2 className="font-medium text-zinc-900 dark:text-zinc-100">Notes & Tasks</h2>
          <button
            onClick={() => handleAddItem("folder", null)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
            title="Add Root Folder"
          >
            Add Folder
          </button>
        </div>

        {/* Tree Component */}
        <Tree
          items={tree}
          // *** Pass selectedItemId and the ID setter function ***
          selectedItemId={selectedItemId}
          onSelect={selectItemById} // Pass the ID setter as onSelect
          // --- Other props ---
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
             e.dataTransfer.setData('text/plain', id);
             e.dataTransfer.effectAllowed = 'move';
             setDraggedId(id);
          }}
          onDrop={handleDrop}
          onContextMenu={(e, item) => {
            if (draggedId || inlineRenameId) { e.preventDefault(); return; } // Prevent during drag/rename
            // *** Set selected ID on context menu open ***
            if (item) selectItemById(item.id);
            else selectItemById(null); // Clear selection if clicking empty area

            setContextMenu({
              visible: true,
              x: e.clientX,
              y: e.clientY,
              item, // Pass the actual item object for context menu logic
              isEmptyArea: !item,
            });
          }}
          // Pass the function to initiate rename
          onRename={(itemId) => {
              // Find the item object based on ID to start rename
              const itemToRename = findItemById(tree, itemId);
              startInlineRename(itemToRename);
          }}
        />
      </div>

      {/* Main pane */}
      <div className="col-span-1 md:col-span-3 relative p-4 overflow-auto bg-gray-50 dark:bg-zinc-800">
        {/* Use the derived selectedItem for rendering */}
        {selectedItem ? (
          selectedItem.type === "folder" ? (
            <div>
              <h2 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100">{selectedItem.label}</h2>
              {/* Pass selectItemById to FolderContents */}
              <FolderContents folder={selectedItem} onSelect={selectItemById} />
            </div>
          ) : (
            <ContentEditor
              // Use selectedItemId for the key to ensure re-mount on selection change
              key={selectedItemId}
              item={selectedItem} // Pass the derived item object
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

        {/* Context Menu */}
        {contextMenu.visible && (
          <ContextMenu
            visible={true}
            x={contextMenu.x}
            y={contextMenu.y}
            // Pass the item object stored in contextMenu state
            item={contextMenu.item}
            isEmptyArea={contextMenu.isEmptyArea}
            onAddRootFolder={() => handleAddItem("folder", null)}
            // Pass the item from contextMenu state for adding relative items
            onAddFolder={() => handleAddItem("folder", contextMenu.item)}
            onAddNote={() => handleAddItem("note", contextMenu.item)}
            onAddTask={() => handleAddItem("task", contextMenu.item)}
            // Pass the item from contextMenu state for rename/delete
            onRename={() => startInlineRename(contextMenu.item)}
            onDelete={() => contextMenu.item && deleteItem(contextMenu.item.id)}
            onClose={() => setContextMenu((m) => ({ ...m, visible: false }))}
          />
        )}

        {/* Add Dialog */}
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
      </div>
    </div>
  );
};

export default App;
