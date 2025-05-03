// src/App.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import Tree from "./components/Tree";
import FolderContents from "./components/FolderContents";
import ContentEditor from "./components/ContentEditor";
import ContextMenu from "./components/ContextMenu";
import AddDialog from "./components/AddDialog";
import AboutDialog from "./components/AboutDialog";
import ExportDialog from "./components/ExportDialog";
import ImportDialog from "./components/ImportDialog";
import { useTree } from "./hooks/useTree.jsx";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Info, EllipsisVertical } from "lucide-react";

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
    updateNoteContent,
    updateTask,
    renameItem,
    deleteItem,
    draggedId,
    setDraggedId,
    handleDrop,
    clipboardItem,
    clipboardMode,
    copyItem,
    cutItem,
    pasteItem,
    addItem,
    duplicateItem,
    handleExport,
    handleImport,
  } = useTree();

  // --- Local UI state (Dialogs, Inline Rename, Menus) ---
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newItemType, setNewItemType] = useState("folder");
  const [newItemLabel, setNewItemLabel] = useState("");
  const [parentItemForAdd, setParentItemForAdd] = useState(null);
  const [showError, setShowError] = useState(false);
  const [inlineRenameId, setInlineRenameId] = useState(null);
  const [inlineRenameValue, setInlineRenameValue] = useState("");
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false);
  // Modified state to hold context for dialogs
  const [exportDialogState, setExportDialogState] = useState({ isOpen: false, context: null }); // context: 'item' | 'tree' | null
  const [importDialogState, setImportDialogState] = useState({ isOpen: false, context: null }); // context: 'item' | 'tree' | null
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const topMenuRef = useRef(null);

   // --- Click Outside Handler for Top Menu ---
   useEffect(() => {
    const handleClickOutside = (event) => {
      if (topMenuRef.current && !topMenuRef.current.contains(event.target)) {
        setTopMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);


  // --- Inline Rename Logic ---
   const startInlineRename = useCallback((itemToRename) => {
      if (!itemToRename || draggedId === itemToRename.id) return;
      setInlineRenameId(itemToRename.id);
      setInlineRenameValue(itemToRename.label);
      setContextMenu((m) => ({ ...m, visible: false }));
   }, [draggedId, setContextMenu]);


  const finishInlineRename = useCallback(() => {
    if (!inlineRenameId) return;

    const findItemInTree = (nodes, id) => {
         if (!id || !Array.isArray(nodes)) return null;
         for (const item of nodes) {
             if (item.id === id) return item;
             if (Array.isArray(item.children)) {
                 const found = findItemInTree(item.children, id);
                 if (found) return found;
             }
         }
         return null;
     };
     const originalItem = findItemInTree(tree, inlineRenameId);


    const newLabel = inlineRenameValue.trim();

    if (newLabel && newLabel !== originalItem?.label) {
      renameItem(inlineRenameId, newLabel);
    }
    setInlineRenameId(null);
    setInlineRenameValue("");
  }, [inlineRenameId, inlineRenameValue, renameItem, tree]);

  const cancelInlineRename = useCallback(() => {
    setInlineRenameId(null);
    setInlineRenameValue("");
  }, []);

  // --- Add Item Dialog Control ---
   const openAddDialog = useCallback((type, parentItemOrNull) => {
      setNewItemType(type);
      setParentItemForAdd(parentItemOrNull);
      setNewItemLabel("");
      setShowError(false);
      setAddDialogOpen(true);
      setContextMenu((m) => ({ ...m, visible: false }));
      setTopMenuOpen(false);
   }, [setContextMenu]);


  // --- Add Item Action (Called by Dialog) ---
   const handleAdd = useCallback(() => {
    if (!newItemLabel.trim()) {
      setShowError(true);
      return;
    }
    const newItem = {
      id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9),
      type: newItemType,
      label: newItemLabel.trim(),
      ...(newItemType === "folder" ? { children: [] } : {}),
      ...(newItemType === "task" ? { completed: false, content: "" } : {}),
      ...(newItemType === "note" ? { content: "" } : {}),
    };

     const parentId = parentItemForAdd?.id ?? null;

    addItem(newItem, parentId);

    setAddDialogOpen(false);
    setNewItemLabel("");
    setParentItemForAdd(null);
    setShowError(false);
  }, [newItemLabel, newItemType, parentItemForAdd, addItem]);

  // --- Toggle Task Completion ---
   const handleToggleTask = useCallback((id, completed) => {
      updateTask(id, { completed });
   }, [updateTask]);


  // --- Drag End Handler ---
  const handleDragEnd = useCallback(() => {
    setDraggedId(null);
  }, [setDraggedId]);

   // --- Handlers to open dialogs with context ---
   const openExportDialog = useCallback((context = null) => { // context: 'item' | 'tree'
        setExportDialogState({ isOpen: true, context: context });
        setContextMenu((m) => ({ ...m, visible: false }));
        setTopMenuOpen(false);
   }, [setContextMenu]);

   const openImportDialog = useCallback((context = null) => { // context: 'item' | 'tree'
        setImportDialogState({ isOpen: true, context: context });
        setContextMenu((m) => ({ ...m, visible: false }));
        setTopMenuOpen(false);
   }, [setContextMenu]);


  // --- Keyboard Shortcuts Effect ---
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (
          activeElement.tagName === 'INPUT' ||
          activeElement.tagName === 'TEXTAREA' ||
          activeElement.isContentEditable
      );

       if (isInputFocused) {
            if (inlineRenameId && activeElement.tagName === 'INPUT') {
                if (e.key === "Enter") {
                    e.preventDefault();
                    finishInlineRename();
                } else if (e.key === "Escape") {
                    e.preventDefault();
                    cancelInlineRename();
                }
            }
            return;
        }

       const treeNav = document.querySelector('nav[aria-label="Notes and Tasks Tree"]');
       const isTreeFocused = treeNav && treeNav.contains(activeElement);

       if (e.key === "F2" && selectedItemId && isTreeFocused) {
          e.preventDefault();
          if (selectedItem) {
              startInlineRename(selectedItem);
          }
       }

       if (e.ctrlKey && e.key.toLowerCase() === 'c' && selectedItemId && isTreeFocused) {
          e.preventDefault();
          copyItem(selectedItemId);
       }

        if (e.ctrlKey && e.key.toLowerCase() === 'x' && selectedItemId && isTreeFocused) {
          e.preventDefault();
          cutItem(selectedItemId);
       }

        if (e.ctrlKey && e.key.toLowerCase() === 'v' && clipboardItem && isTreeFocused) {
           e.preventDefault();
           const targetId = selectedItem?.type === 'folder' ? selectedItemId : null;
           pasteItem(targetId);
        }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedItemId, selectedItem, inlineRenameId, startInlineRename, finishInlineRename, cancelInlineRename, copyItem, cutItem, pasteItem, clipboardItem]);


  // --- Render Component ---
  return (
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
               {/* Action Buttons Replaced by Menu */}
               <div className="flex items-center space-x-1 sm:space-x-2 relative" ref={topMenuRef}>
                  <button
                     onClick={() => setAboutDialogOpen(true)}
                     className="p-1 sm:p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                     title="About this application"
                  >
                     <Info className="w-4 h-4" />
                  </button>
                  <button
                     onClick={() => setTopMenuOpen(prev => !prev)}
                     className="p-1 sm:p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded"
                     title="More Actions"
                   >
                     <EllipsisVertical className="w-4 h-4" />
                  </button>

                  {/* Top Level Menu Dropdown */}
                  {topMenuOpen && (
                    <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded shadow-lg z-40 text-sm">
                       <button
                         onClick={() => openAddDialog("folder", null)}
                         className="block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700"
                       >
                         Add Root Folder
                       </button>
                       <button
                         onClick={() => openExportDialog('tree')} // Pass context
                         className="block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700"
                       >
                         Export Full Tree...
                       </button>
                        <button
                         onClick={() => openImportDialog('tree')} // Pass context
                         className="block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700"
                       >
                         Import Full Tree...
                       </button>
                    </div>
                  )}
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
                  try {
                      e.dataTransfer.setData('text/plain', id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggedId(id);
                  } catch (err) {
                       console.error("Error setting drag data:", err);
                  }
                }}
                onDrop={handleDrop}
                onDragEnd={handleDragEnd}
                onContextMenu={(e, item) => {
                   if (draggedId || inlineRenameId) { e.preventDefault(); return; }
                  e.preventDefault();
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
              ) : selectedItem.type === 'note' || selectedItem.type === 'task' ? (
                <ContentEditor
                  key={selectedItemId}
                  item={selectedItem}
                  onSaveContent={
                     selectedItem.type === "task"
                       ? (id, content) => updateTask(id, { content })
                       : updateNoteContent
                  }
                />
              ) : null
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
          // Actions
          onAddRootFolder={() => openAddDialog("folder", null)}
          onAddFolder={() => contextMenu.item && openAddDialog("folder", contextMenu.item)}
          onAddNote={() => contextMenu.item && openAddDialog("note", contextMenu.item)}
          onAddTask={() => contextMenu.item && openAddDialog("task", contextMenu.item)}
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
          // Pass context-aware dialog openers
          onExportItem={() => openExportDialog('item')}
          onImportItem={() => openImportDialog('item')}
          onExportTree={() => openExportDialog('tree')}
          onImportTree={() => openImportDialog('tree')}
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

       {/* Export Dialog - Pass context and manage open state */}
       <ExportDialog
         isOpen={exportDialogState.isOpen}
         context={exportDialogState.context} // Pass context ('item' or 'tree')
         onClose={() => setExportDialogState({ isOpen: false, context: null })}
         onExport={handleExport}
       />

       {/* Import Dialog - Pass context and manage open state */}
       <ImportDialog
         isOpen={importDialogState.isOpen}
         context={importDialogState.context} // Pass context ('item' or 'tree')
         onClose={() => setImportDialogState({ isOpen: false, context: null })}
         onImport={handleImport}
       />

    </div>
  );
};

export default App;