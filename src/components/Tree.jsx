// src/components/Tree.jsx
import React, { useRef, useState } from "react";
import { sortItems } from "../utils/treeUtils";

const INDENT_SIZE = 16;

/**
 * Tree component renders the hierarchical file/folder structure.
 */
const Tree = ({
  items,
  // *** Accept selectedItemId and onSelect (which expects an ID) ***
  selectedItemId,
  onSelect, // Should now be the function that sets the selected ID
  // --- Other props ---
  inlineRenameId,
  inlineRenameValue,
  setInlineRenameValue,
  finishInlineRename,
  cancelInlineRename,
  expandedFolders,
  onToggleExpand,
  onToggleTask,
  draggedId,
  onDragStart,
  onDrop,
  onContextMenu, // Still expects (e, item)
  onRename,    // Still expects (itemId)
}) => {
  const navRef = useRef(null);
  const [dragOverId, setDragOverId] = useState(null);

  const refocusTree = () => { /* ... refocusTree implementation ... */
      requestAnimationFrame(() => {
        navRef.current?.focus({ preventScroll: true });
      });
  };

  // --- Keyboard Navigation & Item Interaction Logic ---
  const getVisible = (nodes) => { /* ... getVisible implementation ... */
      let out = [];
      if (!Array.isArray(nodes)) return out;
      sortItems(nodes).forEach((it) => {
          out.push(it);
          if (it.type === "folder" && Array.isArray(it.children) && expandedFolders[it.id]) {
              out = out.concat(getVisible(it.children));
          }
      });
      return out;
  };
  const findParent = (nodes, childId, parent = null) => { /* ... findParent implementation ... */
      if (!Array.isArray(nodes)) return null;
      for (const it of nodes) {
          if (it.id === childId) return parent;
          if (Array.isArray(it.children)) {
              const p = findParent(it.children, childId, it);
              if (p) return p;
          }
      }
      return null;
  };

  const handleKeyDown = (e) => { /* ... handleKeyDown implementation ... */
      if (e.target.tagName === "INPUT") return;
      const visible = getVisible(items);
      const idx = visible.findIndex((it) => it.id === selectedItemId); // Use selectedItemId

      switch (e.key) {
          case "ArrowDown":
              e.preventDefault();
              if (idx < visible.length - 1) onSelect(visible[idx + 1].id); // Pass ID
              else if (idx === -1 && visible.length > 0) onSelect(visible[0].id); // Pass ID
              break;
          case "ArrowUp":
              e.preventDefault();
              if (idx > 0) onSelect(visible[idx - 1].id); // Pass ID
              break;
          case "ArrowRight":
              e.preventDefault();
              const curR = idx !== -1 ? visible[idx] : null;
              if (curR && curR.type === "folder" && !expandedFolders[curR.id]) {
                  onToggleExpand(curR.id, true);
              }
              break;
          case "ArrowLeft":
              e.preventDefault();
              const curL = idx !== -1 ? visible[idx] : null;
              if (curL && curL.type === "folder" && expandedFolders[curL.id]) {
                  onToggleExpand(curL.id, false);
              } else if (curL) {
                  const parent = findParent(items, curL.id);
                  if (parent) onSelect(parent.id); // Pass parent ID
              }
              break;
          case " ":
          case "Spacebar":
              e.preventDefault();
              if (idx === -1) return;
              const curSpace = visible[idx];
              if (curSpace.type === "task") {
                  onToggleTask(curSpace.id, !curSpace.completed);
              }
              break;
          case "F2":
              e.preventDefault();
              if (idx === -1) return;
              // onRename expects the ID, which we have via selectedItemId
              if (selectedItemId) {
                  onRename(selectedItemId);
              }
              break;
          default:
              break;
      }
  };
  // --- End Keyboard Navigation ---


  // --- Drag Handlers (No changes needed here) ---
  const handleDragOver = (e, item) => { /* ... */
      e.preventDefault();
      e.stopPropagation();
      if (item?.type === 'folder' && item.id !== draggedId) {
          setDragOverId(item.id);
      } else {
          setDragOverId(null);
      }
   };
  const handleDragLeave = (e) => { /* ... */
      e.preventDefault();
      e.stopPropagation();
      setDragOverId(null);
  };
  const handleItemDrop = (e, targetItem) => { /* ... */
      e.preventDefault();
      e.stopPropagation();
      const currentDragOverId = dragOverId;
      setDragOverId(null);
      if (targetItem?.id === currentDragOverId && targetItem?.type === 'folder' && targetItem.id !== draggedId) {
          onDrop(targetItem.id);
      } else {
          // console.log(...)
      }
  };
  // --- End Drag Handlers ---


  const renderItems = (nodes, depth = 0) => (
    <ul className="list-none p-0 m-0">
      {sortItems(nodes).map((item) => {
        const isBeingDragged = item.id === draggedId;
        const isDragOverTarget = item.id === dragOverId;
        // *** Check selection based on selectedItemId ***
        const isSelected = item.id === selectedItemId;

        return (
          <li
            key={item.id}
            className={`py-0.5 group relative ${isBeingDragged ? 'opacity-40' : ''}`}
            draggable={!inlineRenameId}
            onDragStart={(e) => { /* ... */
                 if (inlineRenameId) { e.preventDefault(); return; }
                 e.stopPropagation();
                 onDragStart(e, item.id);
            }}
            onDragOver={(e) => handleDragOver(e, item)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleItemDrop(e, item)}
          >
            {isDragOverTarget && ( /* ... overlay ... */
                <div className="absolute inset-0 bg-blue-200 dark:bg-blue-800 opacity-30 rounded pointer-events-none z-0" aria-hidden="true"></div>
            )}
            <div
               className={`relative z-10 flex items-center cursor-pointer rounded ${
                 // *** Use isSelected derived from selectedItemId ***
                 isSelected
                   ? "bg-blue-600 text-white"
                   : "hover:bg-gray-100 dark:hover:bg-zinc-700"
               } ${isDragOverTarget ? 'bg-blue-100 dark:bg-blue-900' : ''}`}
               style={{ paddingLeft: `${depth * INDENT_SIZE}px` }}
               // *** Call onSelect with item.id ***
               onClick={(e) => {
                   if (isBeingDragged || inlineRenameId === item.id) return;
                   e.stopPropagation();
                   onSelect(item.id); // Pass the ID to the selection handler
               }}
               // onContextMenu still needs the item object
               onContextMenu={(e) => {
                  if (draggedId || inlineRenameId) { e.preventDefault(); return; }
                  e.preventDefault();
                  e.stopPropagation();
                  // Select the item first by ID
                  onSelect(item.id);
                  // Then call the context menu handler with the item object
                  onContextMenu(e, item);
               }}
            >
              {/* Expand/Collapse Button */}
              <div className="w-4 h-5 flex-shrink-0 flex items-center justify-center">
                  {/* ... button logic ... */}
                   {item.type === "folder" ? (
                     <button onClick={(e) => { e.stopPropagation(); onToggleExpand(item.id); }} className="flex items-center justify-center h-full w-full focus:outline-none text-xs" aria-expanded={!!expandedFolders[item.id]} aria-label={expandedFolders[item.id] ? `Collapse ${item.label}` : `Expand ${item.label}`}>
                       {expandedFolders[item.id] ? "▾" : "▸"}
                     </button>
                   ) : ( <span className="inline-block w-4" aria-hidden="true"></span> )}
              </div>
              {/* Icon */}
              <div className="mx-1 flex-shrink-0 flex items-center">
                  {/* ... icon logic ... */}
                    {item.type === "folder" ? (
                      <span className={`${!item.children || item.children.length === 0 ? "opacity-50" : ""}`} aria-hidden="true">
                         {expandedFolders[item.id] ? "📂" : "📁"}
                      </span>
                    ) : item.type === "task" ? (
                      <button onClick={(e) => { e.stopPropagation(); onToggleTask(item.id, !item.completed); }} className="focus:outline-none flex items-center" aria-checked={!!item.completed} role="checkbox" aria-label={`Mark task ${item.label} as ${item.completed ? 'incomplete' : 'complete'}`}>
                        {item.completed ? "✅" : "⬜️"}
                      </button>
                    ) : ( <span aria-hidden="true">📝</span> )}
              </div>
              {/* Label or Rename Input */}
              <div className="flex-1 truncate pr-1">
                  {/* ... rename logic ... */}
                    {item.id === inlineRenameId ? (
                      <input type="text" className="w-full bg-white dark:bg-zinc-800 text-black dark:text-white outline-none border border-blue-400 px-1 text-sm rounded" value={inlineRenameValue} onChange={(e) => setInlineRenameValue(e.target.value)} onClick={(e) => e.stopPropagation()} onBlur={() => { finishInlineRename(); refocusTree(); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); finishInlineRename(); refocusTree(); } else if (e.key === "Escape") { cancelInlineRename(); refocusTree(); } }} autoFocus />
                    ) : ( <span className="text-sm">{item.label}</span> )}
              </div>
            </div>
            {/* Recursive render */}
            {item.type === "folder" && Array.isArray(item.children) && expandedFolders[item.id] &&
              renderItems(item.children, depth + 1)}
          </li>
        );
      })}
    </ul>
  );

  return (
    <nav ref={navRef} className="overflow-auto h-full p-1 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded" tabIndex={0} onKeyDown={handleKeyDown} onContextMenu={(e) => { /* ... context menu empty area ... */ if (!draggedId && !inlineRenameId && e.target === navRef.current) { e.preventDefault(); onSelect(null); onContextMenu(e, null); } else if (draggedId || inlineRenameId) { e.preventDefault(); } }} aria-label="Notes and Tasks Tree">
      {renderItems(items)}
    </nav>
  );
};

export default Tree;
