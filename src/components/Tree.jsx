// src/components/Tree.jsx
import React, { useRef, useState, useEffect, useCallback } from "react";
import { sortItems, isSelfOrDescendant } from "../utils/treeUtils";
// --- MODIFICATION: Import MoreVertical icon ---
import { MoreVertical } from "lucide-react";
// --- END MODIFICATION ---

const INDENT_SIZE = 16; // Pixels for indentation per level

const Tree = ({
  items,
  selectedItemId,
  onSelect,
  inlineRenameId,
  inlineRenameValue,
  setInlineRenameValue,
  onAttemptRename,
  cancelInlineRename,
  expandedFolders,
  onToggleExpand,
  onToggleTask,
  draggedId,
  onDragStart,
  onDrop,
  onNativeContextMenu, // Renamed prop for clarity
  onShowItemMenu, // --- MODIFICATION: New prop for button click ---
  onRename,
  onDragEnd,
  uiError,
  setUiError,
}) => {
  const navRef = useRef(null);
  const [dragOverId, setDragOverId] = useState(null);
  const [localRenameError, setLocalRenameError] = useState("");

  // --- Callbacks (refocusTree, getVisible, findParent, handleKeyDown, drag/drop handlers) remain the same ---
  const refocusTree = useCallback(() => {
    /* ... */ requestAnimationFrame(() => {
      navRef.current?.focus({ preventScroll: true });
    });
  }, []);
  useEffect(() => {
    if (inlineRenameId) {
      setLocalRenameError("");
    }
  }, [uiError, inlineRenameId]);
  const getVisible = useCallback((nodes, currentExpandedFolders) => {
    let out = [];
    const currentNodes = Array.isArray(nodes) ? nodes : [];
    sortItems(currentNodes).forEach((it) => {
      out.push(it);
      if (
        it.type === "folder" &&
        Array.isArray(it.children) &&
        currentExpandedFolders[it.id]
      ) {
        out = out.concat(getVisible(it.children, currentExpandedFolders));
      }
    });
    return out;
  }, []);
  const findParent = useCallback((nodes, childId, parent = null) => {
    const currentNodes = Array.isArray(nodes) ? nodes : [];
    for (const it of currentNodes) {
      if (it.id === childId) return parent;
      if (Array.isArray(it.children)) {
        const p = findParent(it.children, childId, it);
        if (p) return p;
      }
    }
    return null;
  }, []);
  const handleKeyDown = useCallback(
    (e) => {
      /* ... keyboard nav logic ... */
      const activeElement = document.activeElement;
      const isRenameInputFocused = activeElement?.closest(
        `li[data-item-id="${inlineRenameId}"] input`
      );
      if (isRenameInputFocused) {
        if (e.key === "Enter" || e.key === "Escape") {
          /* handled by input */
        }
        return;
      }
      const treeNav = navRef.current;
      const isTreeAreaFocused =
        treeNav &&
        (treeNav === activeElement ||
          treeNav.contains(activeElement) ||
          activeElement === document.body);
      if (
        !isTreeAreaFocused &&
        !(activeElement === document.body && selectedItemId)
      )
        return;
      const visibleItems = getVisible(items, expandedFolders);
      const currentIndex = visibleItems.findIndex(
        (it) => it.id === selectedItemId
      );
      const currentItem =
        currentIndex !== -1 ? visibleItems[currentIndex] : null;
      let nextItemId = null;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          if (visibleItems.length === 0) break;
          nextItemId =
            currentIndex < visibleItems.length - 1
              ? visibleItems[currentIndex + 1].id
              : currentIndex === -1
              ? visibleItems[0].id
              : null;
          if (nextItemId) onSelect(nextItemId);
          break;
        case "ArrowUp":
          e.preventDefault();
          if (visibleItems.length === 0) break;
          nextItemId =
            currentIndex > 0
              ? visibleItems[currentIndex - 1].id
              : currentIndex === -1
              ? visibleItems[0].id
              : null;
          if (nextItemId) onSelect(nextItemId);
          break;
        case "ArrowRight":
          e.preventDefault();
          if (currentItem) {
            if (currentItem.type === "folder") {
              if (!expandedFolders[currentItem.id]) {
                onToggleExpand(currentItem.id, true);
              } else if (
                Array.isArray(currentItem.children) &&
                currentItem.children.length > 0
              ) {
                const sortedChildren = sortItems(currentItem.children);
                if (sortedChildren.length > 0) {
                  onSelect(sortedChildren[0].id);
                }
              }
            }
          }
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (currentItem) {
            if (
              currentItem.type === "folder" &&
              expandedFolders[currentItem.id]
            ) {
              onToggleExpand(currentItem.id, false);
            } else {
              const parent = findParent(items, currentItem.id);
              if (parent) {
                onSelect(parent.id);
              }
            }
          }
          break;
        case " ":
          e.preventDefault();
          if (currentItem && currentItem.type === "task") {
            onToggleTask(currentItem.id, !currentItem.completed);
          }
          break;
        default:
          break;
      }
    },
    [
      items,
      expandedFolders,
      selectedItemId,
      onSelect,
      onToggleExpand,
      findParent,
      getVisible,
      onToggleTask,
      inlineRenameId,
    ]
  );
  const handleDragOver = useCallback(
    (e, item) => {
      e.preventDefault();
      e.stopPropagation();
      if (
        item?.type === "folder" &&
        item.id !== draggedId &&
        !isSelfOrDescendant(items, draggedId, item.id)
      ) {
        setDragOverId(item.id);
      } else {
        setDragOverId(null);
      }
    },
    [draggedId, items]
  );
  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
  }, []);
  const handleItemDrop = useCallback(
    (e, targetItem) => {
      e.preventDefault();
      e.stopPropagation();
      const currentDragOverId = dragOverId;
      setDragOverId(null);
      if (
        targetItem?.id === currentDragOverId &&
        targetItem?.type === "folder" &&
        targetItem.id !== draggedId
      ) {
        onDrop(targetItem.id);
      }
    },
    [dragOverId, draggedId, onDrop]
  );

  const renderItems = useCallback(
    (nodes, depth = 0) => (
      <ul className="list-none p-0 m-0">
        {(Array.isArray(nodes) ? sortItems(nodes) : []).map((item) => {
          const isBeingDragged = item.id === draggedId;
          const isDragOverTarget = item.id === dragOverId;
          const isSelected = item.id === selectedItemId;
          const isRenaming = item.id === inlineRenameId;
          const hasError = isRenaming && (localRenameError || uiError);

          return (
            <li
              key={item.id}
              data-item-id={item.id}
              className={`group relative text-base md:text-sm ${
                isBeingDragged ? "opacity-40" : ""
              }`}
              draggable={!isRenaming}
              onDragStart={(e) => {
                if (isRenaming) {
                  e.preventDefault();
                  return;
                }
                e.stopPropagation();
                onDragStart(e, item.id);
              }}
              onDragOver={(e) => handleDragOver(e, item)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleItemDrop(e, item)}
              onDragEnd={onDragEnd}
              // --- MODIFICATION: Use onNativeContextMenu for actual right-click/long-press ---
              onContextMenu={(e) => {
                if (draggedId || isRenaming) {
                  e.preventDefault();
                  return;
                }
                e.preventDefault();
                e.stopPropagation();
                onSelect(item.id); // Select item first
                onNativeContextMenu(e, item); // Call original handler
              }}
              // --- END MODIFICATION ---
            >
              {isDragOverTarget && (
                <div
                  data-item-id="drag-over-indicator"
                  className="absolute inset-y-0 left-0 right-0 bg-blue-200 dark:bg-blue-800 opacity-30 rounded pointer-events-none z-0"
                  aria-hidden="true"
                ></div>
              )}
              <div
                className={`relative z-10 flex items-center cursor-pointer rounded py-1.5 sm:py-1 pr-1 ${
                  // Reduced right padding to make space for button
                  isSelected && !isRenaming
                    ? "bg-blue-600 text-white"
                    : "hover:bg-zinc-100 dark:hover:bg-zinc-700"
                } ${
                  isDragOverTarget
                    ? "bg-blue-100 dark:bg-blue-900 text-zinc-900 dark:text-zinc-100"
                    : ""
                }`}
                style={{
                  paddingLeft: `${depth * INDENT_SIZE + (depth > 0 ? 4 : 0)}px`,
                }}
                onClick={(e) => {
                  if (isBeingDragged || isRenaming) return;
                  e.stopPropagation();
                  onSelect(item.id);
                }}
                // Removed onDoubleClick here, rely on context menu or F2
                // onDoubleClick={(e) => { if (isRenaming) return; e.stopPropagation(); onRename(item); }}
              >
                {/* Expand/Collapse Button & Icon Area */}
                <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center mr-1">
                  {item.type === "folder" ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleExpand(item.id);
                      }}
                      className={`flex items-center justify-center h-full w-full focus:outline-none text-xs rounded-sm p-0.5 ${
                        isSelected && !isRenaming
                          ? "text-white"
                          : "text-zinc-500 dark:text-zinc-400"
                      } hover:bg-black/10 dark:hover:bg-white/10`}
                      aria-expanded={!!expandedFolders[item.id]}
                      aria-label={
                        expandedFolders[item.id]
                          ? `Collapse ${item.label}`
                          : `Expand ${item.label}`
                      }
                      title={expandedFolders[item.id] ? `Collapse` : `Expand`}
                    >
                      {" "}
                      {expandedFolders[item.id] ? "▾" : "▸"}{" "}
                    </button>
                  ) : (
                    <span
                      className="inline-block w-full h-full"
                      aria-hidden="true"
                    >
                      &nbsp;
                    </span>
                  )}
                </div>
                {/* Item Icon */}
                <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center mr-1.5 sm:mr-1">
                  {item.type === "folder" ? (
                    <span
                      className={`${
                        !item.children || item.children.length === 0
                          ? "opacity-50"
                          : ""
                      }`}
                      aria-hidden="true"
                    >
                      {" "}
                      {expandedFolders[item.id] ? "📂" : "📁"}{" "}
                    </span>
                  ) : item.type === "task" ? (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleTask(item.id, !item.completed);
                      }}
                      className="focus:outline-none flex items-center justify-center cursor-pointer w-full h-full"
                      aria-checked={!!item.completed}
                      role="checkbox"
                      aria-label={`Mark task ${item.label} as ${
                        item.completed ? "incomplete" : "complete"
                      }`}
                      title={`Mark as ${
                        item.completed ? "incomplete" : "complete"
                      }`}
                    >
                      {" "}
                      {item.completed ? "✅" : "⬜️"}{" "}
                    </button>
                  ) : (
                    <span aria-hidden="true">📝</span>
                  )}
                </div>
                {/* Label or Rename Input */}
                <div
                  className="flex-1 truncate relative"
                  style={{ minWidth: 0 }}
                >
                  {isRenaming ? (
                    <>
                      <input
                        type="text"
                        className={`w-full bg-white dark:bg-zinc-800 outline-none border px-1 py-0.5 text-base md:text-sm rounded ${
                          hasError
                            ? "border-red-500 text-red-700 dark:text-red-400"
                            : "border-blue-400 text-black dark:text-white"
                        }`}
                        value={inlineRenameValue}
                        onChange={(e) => {
                          setInlineRenameValue(e.target.value);
                          setLocalRenameError("");
                          if (setUiError) setUiError("");
                        }}
                        onClick={(e) => e.stopPropagation()}
                        onBlur={() => {
                          if (onAttemptRename) onAttemptRename();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            if (onAttemptRename) onAttemptRename();
                          } else if (e.key === "Escape") {
                            e.preventDefault();
                            cancelInlineRename();
                            refocusTree();
                          }
                        }}
                        autoFocus
                        onFocus={(e) => e.target.select()}
                        aria-invalid={!!hasError}
                        aria-describedby={
                          hasError ? `${item.id}-rename-error` : undefined
                        }
                      />
                      {hasError && (
                        <span
                          id={`${item.id}-rename-error`}
                          className="absolute left-1 top-full mt-0.5 text-xs text-red-600 dark:text-red-400 whitespace-normal z-10"
                        >
                          {" "}
                          {localRenameError || uiError}{" "}
                        </span>
                      )}
                    </>
                  ) : (
                    <span
                      className={` ${
                        item.type === "task" && item.completed
                          ? "line-through text-zinc-500 dark:text-zinc-400"
                          : ""
                      }`}
                    >
                      {" "}
                      {item.label}{" "}
                    </span>
                  )}
                </div>
                {/* --- MODIFICATION: Add More Options Button --- */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelect(item.id); // Ensure item is selected
                    onShowItemMenu(item, e.currentTarget); // Pass item and button element
                  }}
                  className={`ml-1 p-1 rounded hover:bg-black/10 dark:hover:bg-white/20 ${
                    isSelected && !isRenaming
                      ? "text-white"
                      : "text-zinc-500 dark:text-zinc-400"
                  } opacity-0 group-hover:opacity-100 focus:opacity-100`} // Show on hover/focus
                  aria-label={`More options for ${item.label}`}
                  title="More options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                {/* --- END MODIFICATION --- */}
              </div>
              {item.type === "folder" &&
                Array.isArray(item.children) &&
                expandedFolders[item.id] &&
                renderItems(item.children, depth + 1)}
            </li>
          );
        })}
      </ul>
    ),
    [
      items,
      selectedItemId,
      inlineRenameId,
      inlineRenameValue,
      expandedFolders,
      draggedId,
      dragOverId,
      onSelect,
      setInlineRenameValue,
      onAttemptRename,
      cancelInlineRename,
      onToggleExpand,
      onToggleTask,
      onDragStart,
      handleDragOver,
      handleDragLeave,
      handleItemDrop,
      onDrop,
      onNativeContextMenu,
      onShowItemMenu, // Use updated/new props
      onRename,
      onDragEnd,
      refocusTree,
      uiError,
      setUiError,
      localRenameError,
    ]
  );

  return (
    <nav
      ref={navRef}
      className="overflow-auto h-full p-1.5 sm:p-1 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      // --- MODIFICATION: Use onNativeContextMenu for empty area ---
      onContextMenu={(e) => {
        if (!draggedId && !inlineRenameId && e.target === navRef.current) {
          e.preventDefault();
          onSelect(null);
          onNativeContextMenu(e, null); // Show empty area menu via original handler
        } else if (draggedId || inlineRenameId) {
          e.preventDefault();
        }
      }}
      // --- END MODIFICATION ---
      aria-label="Notes and Tasks Tree"
    >
      {renderItems(items)}
    </nav>
  );
};

export default Tree;
