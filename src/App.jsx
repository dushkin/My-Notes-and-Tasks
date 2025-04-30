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

const App = () => {
  const {
    tree,
    setTree,
    selectedItem,
    setSelectedItem,
    contextMenu,
    setContextMenu,
    expandedFolders,
    toggleFolderExpand,
    expandFolderPath,
    handleEmptyAreaContextMenu,
    updateNoteContent,
    updateTaskContent,
    deleteItem,
    handleDrop,
  } = useTree();

  // Add-dialog state
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newItemType, setNewItemType] = useState("folder");
  const [newItemLabel, setNewItemLabel] = useState("");
  const [parentItem, setParentItem] = useState(null);
  const [showError, setShowError] = useState(false);

  // Inline-rename state
  const [inlineRenameId, setInlineRenameId] = useState(null);
  const [inlineRenameValue, setInlineRenameValue] = useState("");

  const startInlineRename = (item) => {
    setInlineRenameId(item.id);
    setInlineRenameValue(item.label);
    setContextMenu((m) => ({ ...m, visible: false }));
  };

  const finishInlineRename = () => {
    if (!inlineRenameId) return;
    const newLabel = inlineRenameValue.trim();
    if (!newLabel) {
      setInlineRenameId(null);
      return;
    }
    // apply rename
    setTree((prev) => {
      const clone = JSON.parse(JSON.stringify(prev));
      const recurse = (arr) =>
        arr.map((it) =>
          it.id === inlineRenameId
            ? { ...it, label: newLabel }
            : it.children
            ? { ...it, children: recurse(it.children) }
            : it
        );
      const next = recurse(clone);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
    if (selectedItem?.id === inlineRenameId) {
      setSelectedItem({ ...selectedItem, label: newLabel });
    }
    setInlineRenameId(null);
  };

  const cancelInlineRename = () => {
    setInlineRenameId(null);
  };

  // F2 → rename
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "F2" && selectedItem) {
        e.preventDefault();
        startInlineRename(selectedItem);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedItem]);

  // Open add-dialog
  const handleAddItem = (type, parent) => {
    setNewItemType(type);
    setParentItem(parent);
    setNewItemLabel("");
    setShowError(false);
    setAddDialogOpen(true);
    setContextMenu((m) => ({ ...m, visible: false }));
  };

  // Actually add
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
      ...(newItemType === "task" ? { content: "" } : {}),
      ...(newItemType === "note" ? { content: "" } : {}),
    };
    const parentId = parentItem?.id || null;

    setTree((prev) => {
      const clone = JSON.parse(JSON.stringify(prev));
      let nextTree;
      if (parentItem) {
        const recurse = (arr) =>
          arr.map((it) => {
            if (it.id === parentId) {
              return {
                ...it,
                children: sortItems([...(it.children || []), newItem]),
              };
            }
            if (it.children) {
              const ch = recurse(it.children);
              if (ch !== it.children) return { ...it, children: ch };
            }
            return it;
          });
        nextTree = recurse(clone);
      } else {
        nextTree = [...clone, newItem];
      }
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(nextTree));
      return nextTree;
    });

    setAddDialogOpen(false);
    if (parentId) expandFolderPath(parentId);
  };

  return (
    <div className="grid grid-cols-4 h-screen">
      {/* Sidebar */}
      <div className="col-span-1 border-r overflow-auto">
        <div className="p-2 flex justify-between items-center border-b">
          <h2 className="font-medium">My Notes and Tasks</h2>
          <button
            onClick={() => handleAddItem("folder", null)}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            Add
          </button>
        </div>

        <Tree
          items={sortItems(tree)}
          selectedItemId={selectedItem?.id}
          inlineRenameId={inlineRenameId}
          inlineRenameValue={inlineRenameValue}
          setInlineRenameValue={setInlineRenameValue}
          finishInlineRename={finishInlineRename}
          cancelInlineRename={cancelInlineRename}
          expandedFolders={expandedFolders}
          onToggleExpand={toggleFolderExpand}
          onSelect={setSelectedItem}
          onToggleTask={(id, completed) => {
            setTree((prev) => {
              const recurse = (arr) =>
                arr.map((it) =>
                  it.id === id ? { ...it, completed } : it.children
                  ? { ...it, children: recurse(it.children) }
                  : it
                );
              const next = recurse(prev);
              localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(next));
              return next;
            });
            if (selectedItem?.id === id) {
              setSelectedItem({ ...selectedItem, completed });
            }
          }}
          onDragStart={() => {}}
          onDrop={handleDrop}
          onContextMenu={(e, item) => {
            e.preventDefault();
            setContextMenu({
              visible: true,
              x: e.clientX,
              y: e.clientY,
              item,
              isEmptyArea: false,
            });
          }}
          onRename={startInlineRename}
        />
      </div>

      {/* Main pane */}
      <div className="col-span-3 relative p-4">
        {selectedItem ? (
          selectedItem.type === "folder" ? (
            <FolderContents folder={selectedItem} onSelect={setSelectedItem} />
          ) : (
            <ContentEditor
              item={selectedItem}
              onSaveContent={
                selectedItem.type === "task"
                  ? updateTaskContent
                  : updateNoteContent
              }
            />
          )
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-500">
            Select a folder or item.
          </div>
        )}

        {contextMenu.visible && (
          <ContextMenu
            visible={true}
            x={contextMenu.x}
            y={contextMenu.y}
            item={contextMenu.item}
            isEmptyArea={contextMenu.isEmptyArea}
            onAddRootFolder={() => handleAddItem("folder", null)}
            onAddFolder={() => handleAddItem("folder", contextMenu.item)}
            onAddNote={() => handleAddItem("note", contextMenu.item)}
            onAddTask={() => handleAddItem("task", contextMenu.item)}
            onRename={() => startInlineRename(contextMenu.item)}
            onDelete={() => deleteItem(contextMenu.item.id)}
            onClose={() => setContextMenu((m) => ({ ...m, visible: false }))}
          />
        )}

        <AddDialog
          isOpen={addDialogOpen}
          newItemType={newItemType}
          newItemLabel={newItemLabel}
          showError={showError}
          onLabelChange={(e) => setNewItemLabel(e.target.value)}
          onAdd={handleAdd}
          onCancel={() => setAddDialogOpen(false)}
        />
      </div>
    </div>
  );
};

export default App;
