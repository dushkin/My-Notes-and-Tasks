// src/App.jsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import Tree from "./components/Tree";
import FolderContents from "./components/FolderContents";
import ContentEditor from "./components/ContentEditor";
import ContextMenu from "./components/ContextMenu";
import AddDialog from "./components/AddDialog";
// RenameDialog not needed for inline rename
// import RenameDialog from "./components/RenameDialog";
import AboutDialog from "./components/AboutDialog";
import ExportDialog from "./components/ExportDialog";
import ImportDialog from "./components/ImportDialog";
import SettingsDialog from "./components/SettingsDialog";
import { useTree } from "./hooks/useTree.jsx";
import { useSettings } from "./contexts/SettingsContext"; // <-- Use settings hook
import { findItemById } from "./utils/treeUtils";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { Info, EllipsisVertical, XCircle, Settings as SettingsIcon } from "lucide-react";

// ErrorDisplay component remains the same...
const ErrorDisplay = ({ message, onClose }) => {
  if (!message) return null;
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose();
    }, 5000);
    return () => clearTimeout(timer);
  }, [message, onClose]);
  return (
    <div className="absolute top-2 right-2 left-2 md:left-auto md:max-w-md z-50 bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded shadow-lg flex justify-between items-center">
      <span className="text-sm">{message}</span>
      <button onClick={onClose} className="ml-2 text-red-500 hover:text-red-700">
        <XCircle className="w-4 h-4" />
      </button>
    </div>
  );
};


const App = () => {
  // Destructure hooks
  const { settings } = useSettings(); // <-- Get settings
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
  } = useTree(); // Note: useTree doesn't consume settings yet

  // --- Local UI state (remains mostly the same) ---
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newItemType, setNewItemType] = useState("folder");
  const [newItemLabel, setNewItemLabel] = useState("");
  const [parentItemForAdd, setParentItemForAdd] = useState(null);
  const [inlineRenameId, setInlineRenameId] = useState(null);
  const [inlineRenameValue, setInlineRenameValue] = useState("");
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false);
  const [exportDialogState, setExportDialogState] = useState({ isOpen: false, context: null });
  const [importDialogState, setImportDialogState] = useState({ isOpen: false, context: null });
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const topMenuRef = useRef(null);
  const [uiError, setUiError] = useState('');

  // --- Handlers remain mostly the same, but could eventually use settings ---
  // Click Outside Handler for Top Menu
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

  // Inline Rename Logic
  const startInlineRename = useCallback((itemToRename) => {
    if (!itemToRename || draggedId === itemToRename.id || inlineRenameId) return;
    setUiError('');
    setInlineRenameId(itemToRename.id);
    setInlineRenameValue(itemToRename.label);
    setContextMenu((m) => ({ ...m, visible: false }));
  }, [draggedId, inlineRenameId]);

  const cancelInlineRename = useCallback(() => {
    setInlineRenameId(null);
    setInlineRenameValue("");
    setUiError('');
     const treeNav = document.querySelector('nav[aria-label="Notes and Tasks Tree"]');
     requestAnimationFrame(() => treeNav?.focus({ preventScroll: true }));
  }, []);

  const handleAttemptRename = useCallback(async () => {
    if (!inlineRenameId) return;
    const newLabel = inlineRenameValue.trim();
    const originalItem = findItemById(tree, inlineRenameId);
    if (!newLabel) { setUiError("Name cannot be empty."); return; }
    if (newLabel === originalItem?.label) { cancelInlineRename(); return; }
    const result = renameItem(inlineRenameId, newLabel);
    if (result.success) { cancelInlineRename(); }
    else { setUiError(result.error || "Failed to rename item."); }
  }, [inlineRenameId, inlineRenameValue, renameItem, tree, cancelInlineRename]);

  // Add Item Dialog Control
   const openAddDialog = useCallback((type, parentItemOrNull) => {
      setNewItemType(type);
      setParentItemForAdd(parentItemOrNull);
      setNewItemLabel("");
      setUiError('');
      setAddDialogOpen(true);
      setContextMenu((m) => ({ ...m, visible: false }));
      setTopMenuOpen(false);
   }, []);

   const handleAdd = useCallback(async () => {
    const trimmedLabel = newItemLabel.trim();
    if (!trimmedLabel) { setUiError("Name cannot be empty."); return; }
    const newItem = {
      id: Date.now().toString() + '-' + Math.random().toString(36).substring(2, 9),
      type: newItemType, label: trimmedLabel,
      ...(newItemType === "folder" ? { children: [] } : {}),
      ...(newItemType === "task" ? { completed: false, content: "" } : {}),
      ...(newItemType === "note" ? { content: "" } : {}),
    };
    const parentId = parentItemForAdd?.id ?? null;
    // Check setting before calling addItem which might expand parent
    // TODO: Modify addItem in useTree to check settings.autoExpandNewFolders
    const result = addItem(newItem, parentId);
    if (result.success) {
        setAddDialogOpen(false); setNewItemLabel(""); setParentItemForAdd(null); setUiError('');
    } else { setUiError(result.error || "Failed to add item."); }
  }, [newItemLabel, newItemType, parentItemForAdd, addItem /*, settings.autoExpandNewFolders */]); // Add setting dependency later

  // Other Handlers
   const handleToggleTask = useCallback((id, completed) => { updateTask(id, { completed }); }, [updateTask]);
   const handleDragEnd = useCallback(() => { setDraggedId(null); }, [setDraggedId]);
   const openExportDialog = useCallback((context = null) => { setExportDialogState({ isOpen: true, context: context }); setContextMenu((m) => ({ ...m, visible: false })); setTopMenuOpen(false); }, []);
   const openImportDialog = useCallback((context = null) => { setImportDialogState({ isOpen: true, context: context }); setContextMenu((m) => ({ ...m, visible: false })); setTopMenuOpen(false); }, []);
   const handleFileImport = useCallback(async (file, targetOption) => {
       const result = await handleImport(file, targetOption);
       if (!result.success) { setUiError(result.error || "An unknown error occurred during import."); }
       else { setUiError(''); }
   }, [handleImport]);
   const handlePaste = useCallback((targetFolderId) => {
       const result = pasteItem(targetFolderId);
       if (!result.success) { setUiError(result.error || "Failed to paste item."); }
       else { setUiError(''); }
   }, [pasteItem]);
   const handleDeleteConfirm = useCallback(() => {
        if (contextMenu.item) { deleteItem(contextMenu.item.id); }
        setContextMenu((m) => ({ ...m, visible: false }));
    }, [contextMenu.item, deleteItem]);


  // Keyboard Shortcuts Effect (remains the same for now)
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeElement = document.activeElement;
      const isInputFocused = activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable);
      const isRenameInputFocused = activeElement?.closest(`li[data-item-id="${inlineRenameId}"] input`);
      if (isRenameInputFocused || isInputFocused) return; // Ignore if typing

       const treeNav = document.querySelector('nav[aria-label="Notes and Tasks Tree"]');
       const isTreeAreaFocused = treeNav && (treeNav === activeElement || activeElement === document.body || treeNav.contains(activeElement));
       if (!isTreeAreaFocused) return; // Only tree shortcuts

       if (e.key === "F2" && selectedItemId) {
          e.preventDefault(); const itemToRename = findItemById(tree, selectedItemId);
          if (itemToRename) { startInlineRename(itemToRename); }
       }
       if (e.ctrlKey && e.key.toLowerCase() === 'c' && selectedItemId) { e.preventDefault(); copyItem(selectedItemId); }
       if (e.ctrlKey && e.key.toLowerCase() === 'x' && selectedItemId) { e.preventDefault(); cutItem(selectedItemId); }
       if (e.ctrlKey && e.key.toLowerCase() === 'v' && clipboardItem) {
           e.preventDefault(); const currentItem = findItemById(tree, selectedItemId);
           const targetId = currentItem?.type === 'folder' ? selectedItemId : null; // TODO: More robust parent finding?
           handlePaste(targetId);
       }
       if ((e.key === "Delete" || e.key === "Backspace") && selectedItemId) {
             e.preventDefault(); const itemToDelete = findItemById(tree, selectedItemId);
             if (itemToDelete && window.confirm(`Are you sure you want to delete "${itemToDelete.label}"?`)) {
                 deleteItem(selectedItemId);
             }
       }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [ selectedItemId, inlineRenameId, startInlineRename, tree, copyItem, cutItem, pasteItem, clipboardItem, deleteItem, handlePaste ]);

  // --- Render Component ---
  return (
    <div className="relative flex flex-col h-screen bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100">
       <ErrorDisplay message={uiError} onClose={() => setUiError('')} />
       <PanelGroup direction="horizontal" className="flex-1 min-h-0">
         <Panel defaultSize={25} minSize={15} maxSize={50} className="flex flex-col !overflow-hidden bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-700">
           <div className="flex flex-col h-full">
             {/* Top Bar */}
             <div className="p-2 flex justify-between items-center border-b border-zinc-200 dark:border-zinc-700 flex-shrink-0">
               <h2 className="font-medium text-sm sm:text-base whitespace-nowrap overflow-hidden text-ellipsis mr-2">
                 Notes & Tasks
               </h2>
               <div className="flex items-center space-x-1 sm:space-x-2 relative" ref={topMenuRef}>
                   {/* Settings Button */}
                   <button onClick={() => setSettingsDialogOpen(true)} className="p-1 sm:p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded" title="Settings">
                     <SettingsIcon className="w-4 h-4" />
                   </button>
                   {/* Other buttons */}
                   <button onClick={() => setAboutDialogOpen(true)} className="p-1 sm:p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded" title="About this application">
                       <Info className="w-4 h-4" />
                   </button>
                   <button onClick={() => setTopMenuOpen(prev => !prev)} className="p-1 sm:p-1.5 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded" title="More Actions">
                     <EllipsisVertical className="w-4 h-4" />
                   </button>
                   {/* Top Level Menu Dropdown */}
                   {topMenuOpen && (
                    <div className="absolute top-full right-0 mt-1 w-48 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 rounded shadow-lg z-40 text-sm">
                       <button onClick={() => openAddDialog("folder", null)} className="block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700">Add Root Folder</button>
                       <button onClick={() => openExportDialog('tree')} className="block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700">Export Full Tree...</button>
                       <button onClick={() => openImportDialog('tree')} className="block w-full px-4 py-2 text-left hover:bg-zinc-100 dark:hover:bg-zinc-700">Import Full Tree...</button>
                    </div>
                   )}
               </div>
             </div>
             {/* Tree View */}
             <div className="flex-grow overflow-auto">
               <Tree
                 items={tree}
                 selectedItemId={selectedItemId}
                 onSelect={selectItemById}
                 inlineRenameId={inlineRenameId}
                 inlineRenameValue={inlineRenameValue}
                 setInlineRenameValue={setInlineRenameValue}
                 onAttemptRename={handleAttemptRename}
                 cancelInlineRename={cancelInlineRename}
                 expandedFolders={expandedFolders}
                 onToggleExpand={toggleFolderExpand}
                 onToggleTask={handleToggleTask}
                 draggedId={draggedId}
                 onDragStart={(e, id) => { if (inlineRenameId) { e.preventDefault(); return; } try { e.dataTransfer.setData('text/plain', id); e.dataTransfer.effectAllowed = 'move'; setDraggedId(id); } catch (err) { console.error("Error setting drag data:", err); } }}
                 onDrop={handleDrop}
                 onDragEnd={handleDragEnd}
                 onContextMenu={(e, item) => { if (draggedId || inlineRenameId) { e.preventDefault(); return; } e.preventDefault(); e.stopPropagation(); selectItemById(item?.id ?? null); setContextMenu({ visible: true, x: e.clientX, y: e.clientY, item, isEmptyArea: !item }); }}
                 onRename={startInlineRename}
                 uiError={uiError}
                 setUiError={setUiError}
               />
             </div>
           </div>
         </Panel>
         <PanelResizeHandle className="w-1.5 h-full bg-transparent hover:bg-blue-500/50 data-[resize-handle-active]:bg-blue-600/50 cursor-col-resize z-20" />
         {/* Right Panel */}
         <Panel minSize={30} className="flex flex-col bg-white dark:bg-zinc-800 !overflow-hidden">
             <div className="flex-grow p-1 sm:p-4 overflow-auto h-full">
                 {selectedItem ? (
                     selectedItem.type === "folder" ? (
                         <div className="p-3">
                             <h2 className="text-lg sm:text-xl font-semibold mb-4 text-zinc-900 dark:text-zinc-100 break-words">{selectedItem.label}</h2>
                             {/* TODO: Pass needed drag/drop handlers down if needed here */}
                             <FolderContents
                                folder={selectedItem}
                                onSelect={selectItemById}
                                handleDragStart={(e, id) => { /* Logic if needed */ }}
                                handleDragEnter={(e, id) => { /* Logic if needed */ }}
                                handleDragOver={(e) => { /* Logic if needed */ }}
                                handleDragLeave={(e) => { /* Logic if needed */ }}
                                handleDrop={(e, id) => { /* Logic if needed */ }}
                                handleDragEnd={handleDragEnd}
                                draggedId={draggedId}
                                dragOverItemId={null} // Manage drag over state if needed for folder contents view
                                onToggleExpand={toggleFolderExpand}
                                expandedItems={expandedFolders}
                            />
                         </div>
                     ) : selectedItem.type === 'note' || selectedItem.type === 'task' ? (
                         <ContentEditor
                             key={selectedItemId} // Re-mounts editor on selection change
                             item={selectedItem}
                             // Pass editor defaults from settings
                             defaultFontFamily={settings.editorFontFamily}
                             defaultFontSize={settings.editorFontSize}
                             onSaveContent={selectedItem.type === "task" ? (id, content) => updateTask(id, { content }) : updateNoteContent}
                         />
                     ) : null
                 ) : (
                     <div className="flex items-center justify-center h-full text-zinc-500 dark:text-zinc-400">Select or create an item.</div>
                 )}
             </div>
         </Panel>
       </PanelGroup>

       {/* Modals and Context Menu */}
       {contextMenu.visible && ( <ContextMenu visible={true} x={contextMenu.x} y={contextMenu.y} item={contextMenu.item} isEmptyArea={contextMenu.isEmptyArea} clipboardItem={clipboardItem} onAddRootFolder={() => openAddDialog("folder", null)} onAddFolder={() => contextMenu.item && openAddDialog("folder", contextMenu.item)} onAddNote={() => contextMenu.item && openAddDialog("note", contextMenu.item)} onAddTask={() => contextMenu.item && openAddDialog("task", contextMenu.item)} onRename={() => contextMenu.item && startInlineRename(contextMenu.item)} onDelete={() => { if (contextMenu.item) { if (window.confirm(`Are you sure you want to delete "${contextMenu.item.label}"?`)) { handleDeleteConfirm(); } else { setContextMenu((m) => ({ ...m, visible: false })); } } else { setContextMenu((m) => ({ ...m, visible: false })); } }} onDuplicate={() => contextMenu.item && duplicateItem(contextMenu.item.id)} onClose={() => setContextMenu((m) => ({ ...m, visible: false }))} onCopy={() => contextMenu.item && copyItem(contextMenu.item.id)} onCut={() => contextMenu.item && cutItem(contextMenu.item.id)} onPaste={() => { const targetId = contextMenu.isEmptyArea ? null : (contextMenu.item?.type === 'folder' ? contextMenu.item.id : null); if (contextMenu.isEmptyArea || contextMenu.item?.type === 'folder') { handlePaste(targetId); } else { setUiError("Paste target must be a folder or the root area."); setContextMenu((m) => ({ ...m, visible: false })); } }} onExportItem={() => openExportDialog('item')} onImportItem={() => openImportDialog('item')} onExportTree={() => openExportDialog('tree')} onImportTree={() => openImportDialog('tree')} /> )}
       <AddDialog isOpen={addDialogOpen} newItemType={newItemType} newItemLabel={newItemLabel} errorMessage={addDialogOpen ? uiError : ''} onLabelChange={(e) => { setNewItemLabel(e.target.value); if (addDialogOpen) setUiError(''); }} onAdd={handleAdd} onCancel={() => { setAddDialogOpen(false); setUiError(''); }} />
       <AboutDialog isOpen={aboutDialogOpen} onClose={() => setAboutDialogOpen(false)} />
       <ExportDialog isOpen={exportDialogState.isOpen} context={exportDialogState.context} defaultFormat={settings.defaultExportFormat} onClose={() => setExportDialogState({ isOpen: false, context: null })} onExport={handleExport} />
       <ImportDialog isOpen={importDialogState.isOpen} context={importDialogState.context} onClose={() => setImportDialogState({ isOpen: false, context: null })} onImport={handleFileImport} />

       {/* Settings Dialog */}
       <SettingsDialog isOpen={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} />

    </div>
  );
};

export default App;