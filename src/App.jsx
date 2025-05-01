// src/App.jsx
import React, { useState, useEffect, useCallback } from "react";
import Tree from "./components/Tree";
import FolderContents from "./components/FolderContents";
import ContentEditor from "./components/ContentEditor";
import ContextMenu from "./components/ContextMenu";
import AddDialog from "./components/AddDialog";
import { useTree } from "./hooks/useTree";
import { sortItems } from "./utils/treeUtils";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

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
    setTree,
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
    deleteItem,
    draggedId,
    setDraggedId,
    handleDrop,
  } = useTree();

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newItemType, setNewItemType] = useState("folder");
  const [newItemLabel, setNewItemLabel] = useState("");
  const [parentItemForAdd, setParentItemForAdd] = useState(null);
  const [showError, setShowError] = useState(false);
  const [inlineRenameId, setInlineRenameId] = useState(null);
  const [inlineRenameValue, setInlineRenameValue] = useState("");

  const startInlineRename = useCallback((itemToRename) => {
    if (!itemToRename) return;
    setInlineRenameId(itemToRename.id);
    setInlineRenameValue(itemToRename.label);
    setContextMenu((m) => ({ ...m, visible: false }));
  }, []);

  const finishInlineRename = useCallback(() => {
    if (!inlineRenameId) return;
    const newLabel = inlineRenameValue.trim();
    if (!newLabel) {
      setInlineRenameId(null);
      return;
    }
    setTree((prevTree) => {
      const recurse = (arr) =>
        arr.map((it) => {
          if (it.id === inlineRenameId) {
            return { ...it, label: newLabel };
          }
          if (Array.isArray(it.children)) {
            const updatedChildren = recurse(it.children);
            return updatedChildren !== it.children ? { ...it, children: updatedChildren } : it;
          }
          return it;
        });
      return recurse(prevTree);
    });
    setInlineRenameId(null);
  }, [inlineRenameId, inlineRenameValue, setTree]);

  const cancelInlineRename = useCallback(() => {
    setInlineRenameId(null);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "F2" && selectedItem && !inlineRenameId) {
        e.preventDefault();
        startInlineRename(selectedItem);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedItem, inlineRenameId, startInlineRename]);

  const handleAddItem = useCallback((type, parent) => {
    setNewItemType(type);
    setParentItemForAdd(parent);
    setNewItemLabel("");
    setShowError(false);
    setAddDialogOpen(true);
    setContextMenu((m) => ({ ...m, visible: false }));
  }, []);

  const handleAdd = useCallback(() => {
    if (!newItemLabel.trim()) {
      setShowError(true);
      return;
    }
    const newItem = {
      id: Date.now().toString(),
      type: newItemType,
      label: newItemLabel.trim(),
      ...(newItemType === "folder" ? { children: [] } : {}),
      ...(newItemType === "task" ? { completed: false, content: "" } : {}),
      ...(newItemType === "note" ? { content: "" } : {}),
    };
    const parentId = parentItemForAdd?.id || null;

    setTree((prevTree) => {
      if (parentId) {
        const recurse = (arr) =>
          arr.map((it) => {
            if (it.id === parentId) {
              const currentChildren = Array.isArray(it.children) ? it.children : [];
              return {
                ...it,
                children: sortItems([...currentChildren, newItem]),
              };
            }
            if (Array.isArray(it.children)) {
              const ch = recurse(it.children);
              return ch !== it.children ? { ...it, children: ch } : it;
            }
            return it;
          });
        return recurse(prevTree);
      } else {
        return sortItems([...prevTree, newItem]);
      }
    });

    setAddDialogOpen(false);
    if (parentId) {
      expandFolderPath(parentId);
    }
    setNewItemLabel("");
    setParentItemForAdd(null);
    setShowError(false);
  }, [newItemLabel, newItemType, parentItemForAdd, setTree, expandFolderPath]);

  const handleToggleTask = useCallback((id, completed) => {
    setTree((prevTree) => {
      const recurse = (arr) =>
        arr.map((it) => {
          if (it.id === id) {
            return { ...it, completed };
          }
          if (Array.isArray(it.children)) {
            const updatedChildren = recurse(it.children);
            return updatedChildren !== it.children ? { ...it, children: updatedChildren } : it;
          }
          return it;
        });
      return recurse(prevTree);
    });
  }, [setTree]);

  return (
    <div className="fixed inset-0 flex flex-col">
      <PanelGroup direction="horizontal" className="flex-1">
        {/* Left Panel */}
        <Panel
          defaultSize={25}
          minSize={15}
          maxSize={50}
          className="flex flex-col bg-white dark:bg-zinc-900 border-r border-gray-200 dark:border-zinc-700"
        >
          <div className="flex flex-col h-full overflow-hidden">
            <div className="p-2 flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 sticky top-0 bg-white dark:bg-zinc-900 z-10 flex-shrink-0">
              <h2 className="font-medium text-zinc-900 dark:text-zinc-100">Notes & Tasks</h2>
              <button
                onClick={() => handleAddItem("folder", null)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm"
                title="Add Top Level Folder"
              >
                Add Top Level Folder
              </button>
            </div>
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
                  e.dataTransfer.setData('text/plain', id);
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggedId(id);
                }}
                onDrop={handleDrop}
                onContextMenu={(e, item) => {
                  if (draggedId || inlineRenameId) { e.preventDefault(); return; }
                  if (item) selectItemById(item.id);
                  else selectItemById(null);
                  setContextMenu({
                    visible: true,
                    x: e.clientX,
                    y: e.clientY,
                    item,
                    isEmptyArea: !item,
                  });
                }}
                onRename={(itemId) => {
                  const itemToRename = findItemById(tree, itemId);
                  startInlineRename(itemToRename);
                }}
              />
            </div>
          </div>
        </Panel>

        {/* Resize Handle - Now spans full height */}
        <PanelResizeHandle className="w-1.5 h-full bg-transparent hover:bg-blue-500/50 data-[resize-handle-active]:bg-blue-600/50 cursor-col-resize" />

        {/* Right Panel */}
        <Panel minSize={30} className="flex flex-col bg-gray-50 dark:bg-zinc-800">
          <div className="flex-grow p-4 overflow-auto h-full">
            {selectedItem ? (
              selectedItem.type === "folder" ? (
                <div>
                  <h2 className="text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100">{selectedItem.label}</h2>
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

      {/* Context Menu and Add Dialog */}
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
          onDelete={() => contextMenu.item && deleteItem(contextMenu.item.id)}
          onClose={() => setContextMenu((m) => ({ ...m, visible: false }))}
        />
      )}
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
  );
};

export default App;