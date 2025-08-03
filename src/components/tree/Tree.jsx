// src/components/Tree.jsx
import React, { useRef, useState, useEffect, useCallback } from "react";
import { sortItems, isSelfOrDescendant } from "../../utils/treeUtils";
import { MoreVertical } from "lucide-react";

const INDENT_SIZE = 16;

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
  onNativeContextMenu,
  onShowItemMenu,
  onRename,
  onDragEnd,
  uiError,
  setUiError,
}) => {
  const navRef = useRef(null);
  const longPressTimeoutRef = useRef(null);
  const [isMobile, setIsMobile] = useState(
    typeof window !== "undefined" &&
      (window.innerWidth < 640 || /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent))
  );
  const [dragOverId, setDragOverId] = useState(null);
  const [localRenameError, setLocalRenameError] = useState("");
  const [lastClickTime, setLastClickTime] = useState(0);
  const [lastClickedItem, setLastClickedItem] = useState(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(
        window.innerWidth < 640 || /Mobile|Android|iPhone|iPad/i.test(navigator.userAgent)
      );
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Render empty-tree placeholder or items
  const renderContent = () => {
    if (!items || items.length === 0) {
      const message = `${isMobile ? "Press" : "Right click"} here to add your first tree folder!`;
      return (
        <div
          className="h-full flex items-center justify-center text-zinc-500 dark:text-zinc-400 italic p-4 cursor-pointer"
          onContextMenu={(e) => {
            e.preventDefault();
            onSelect(null);
            onNativeContextMenu(e, null);
          }}
          onClick={isMobile ? (e) => {
            e.preventDefault();
            onSelect(null);
            onNativeContextMenu(e, null);
          } : undefined}
        >
          {message}
        </div>
      );
    }
    return renderItems(items);
  };

  const refocusTree = useCallback(() => {
    requestAnimationFrame(() => {
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
      const activeElement = document.activeElement;
      const isRenameInputFocused = activeElement?.closest(
        `li[data-item-id="${inlineRenameId}"] input`
      );
      if (isRenameInputFocused) {
        if (e.key === "Enter" || e.key === "Escape") {
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
        case "F2":
          e.preventDefault();
          if (currentItem && onRename && !inlineRenameId) {
            onRename(currentItem);
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
      onRename,
    ]
  );

  const handleDragOver = useCallback(
    (e, item) => {
      console.log('🔄 dragOver on:', item.id, 'draggedId:', draggedId);
      e.preventDefault();
      e.stopPropagation();
      if (
        item?.type === "folder" &&
        item.id !== draggedId &&
        !isSelfOrDescendant(items, draggedId, item.id)
      ) {
        console.log('✅ Valid drop target:', item.id);
        setDragOverId(item.id);
        // Allow the drop by setting dropEffect
        e.dataTransfer.dropEffect = "move";
      } else {
        console.log('❌ Invalid drop target:', item.id);
        setDragOverId(null);
        e.dataTransfer.dropEffect = "none";
      }
    },
    [draggedId, items]
  );

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Use a timeout to prevent premature clearing when moving between child elements
    setTimeout(() => {
      setDragOverId(null);
    }, 50);
  }, []);

  const handleItemDrop = useCallback(
    (e, targetItem) => {
      console.log('🎯 DROP EVENT on:', targetItem.id, 'draggedId:', draggedId);
      e.preventDefault();
      e.stopPropagation();
      setDragOverId(null);
      
      // Allow drop if target is a valid folder and not the dragged item itself
      if (
        targetItem?.type === "folder" &&
        targetItem.id !== draggedId &&
        !isSelfOrDescendant(items, draggedId, targetItem.id)
      ) {
        console.log('✅ Executing drop: item', draggedId, 'into folder', targetItem.id);
        onDrop(targetItem.id);
      } else {
        console.log('❌ Drop blocked:', {
          targetType: targetItem?.type,
          targetId: targetItem?.id,
          draggedId,
          isSelf: targetItem.id === draggedId,
          isSelfOrDesc: isSelfOrDescendant(items, draggedId, targetItem.id)
        });
      }
    },
    [draggedId, onDrop, items]
  );

  const handleTaskToggle = useCallback(
    (e, taskId, completed) => {
      e.preventDefault();
      e.stopPropagation();
      onToggleTask(taskId, completed);
    },
    [onToggleTask]
  );

  const handleNavContextMenu = useCallback(
    (e) => {
      if (draggedId || inlineRenameId) {
        e.preventDefault();
        return;
      }
      const isDirectNavClick = e.target === navRef.current;
      const isEmptySpaceClick = e.target.closest("li") === null;
      if (isDirectNavClick || isEmptySpaceClick) {
        e.preventDefault();
        onSelect(null);
        onNativeContextMenu(e, null);
      }
    },
    [draggedId, inlineRenameId, onSelect, onNativeContextMenu]
  );

  const handleItemClick = useCallback(
    (e, item) => {
      if (e.detail > 1) return; // Ignore multiple clicks (handled by double-click)

      const currentTime = Date.now();
      const isBeingDragged = item.id === draggedId;
      const isRenaming = item.id === inlineRenameId;

      if (isBeingDragged || isRenaming) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // Only stop propagation on mobile or when not dragging
      if (isMobile || !e.target.closest('[draggable="true"]')) {
        e.stopPropagation();
      }

      if (isMobile) {
        // Mobile: Always just select - no rename on click
        onSelect(item.id);
      } else {
        // Desktop: Select, but if already selected folder, rename
        if (selectedItemId === item.id && item.type === "folder") {
          // Already selected folder - rename on second click (but not too fast)
          if (
            currentTime - lastClickTime > 300 &&
            lastClickedItem === item.id
          ) {
            onRename(item);
            return;
          }
        }
        onSelect(item.id);
      }

      setLastClickTime(currentTime);
      setLastClickedItem(item.id);
    },
    [
      selectedItemId,
      onSelect,
      onRename,
      lastClickTime,
      lastClickedItem,
      draggedId,
      inlineRenameId,
      isMobile,
    ]
  );

  const handleDoubleClick = useCallback((e, item) => {
    if (isMobile) {
      // Mobile: No double-click behavior
      return;
    }

    // Desktop: Double-click to rename non-folders
    if (item.type !== "folder") {
      e.preventDefault();
      e.stopPropagation();
      onRename(item);
    }
  }, [onRename, isMobile]);

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
              onDragOver={(e) => {
                e.preventDefault();
                console.log('🔄 Simple dragOver on:', item.id);
                handleDragOver(e, item);
              }}
              onDragLeave={handleDragLeave}
              onDrop={(e) => {
                e.preventDefault();
                console.log('🎯 Simple DROP on:', item.id);
                handleItemDrop(e, item);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                console.log('📥 dragEnter on:', item.id);
              }}
              onContextMenu={(e) => {
                if (draggedId || isRenaming) {
                  e.preventDefault();
                  return;
                }
                e.preventDefault();
                e.stopPropagation();
                onSelect(item.id);
                onNativeContextMenu(e, item);
              }}
            >
              {isDragOverTarget && (
                <div
                  className="absolute inset-0 bg-blue-200 dark:bg-blue-800 opacity-30 rounded pointer-events-none z-0"
                  aria-hidden="true"
                />
              )}
              <div
                className={`relative z-10 flex items-center cursor-pointer rounded py-1.5 sm:py-1 pr-1 min-w-max ${
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
                draggable={!isRenaming}
                onMouseDown={(e) => {
                  console.log('🖱️ mouseDown on tree item div:', item.id);
                  // Don't prevent default - let browser handle drag initiation
                }}
                onDragStart={(e) => {
                  console.log('🔄 Tree div onDragStart:', { itemId: item.id, isRenaming, draggable: !isRenaming });
                  
                  if (isRenaming) {
                    e.preventDefault();
                    console.log('🚫 Tree drag prevented - isRenaming');
                    return;
                  }
                  
                  // Minimal setup directly here - no parent call for now
                  e.dataTransfer.setData('text/plain', item.id);
                  e.dataTransfer.effectAllowed = 'move';
                  console.log('🎯 Minimal drag setup complete');
                  
                  // Set draggedId directly without parent call
                  setTimeout(() => {
                    console.log('🎯 Setting draggedId directly');
                    if (typeof onDragStart === 'function') {
                      // Just set the state, don't call the full handler
                      // onDragStart(e, item.id);
                    }
                  }, 1);
                }}
                onDragEnd={(e) => {
                  console.log('🏁 Drag ended for item:', item.id);
                  onDragEnd(e);
                }}
                onClick={(e) => {
                  // Don't handle click if this was part of a drag operation
                  if (draggedId) {
                    console.log('🚫 Ignoring click during drag operation');
                    return;
                  }
                  handleItemClick(e, item);
                }}
                onDoubleClick={(e) => handleDoubleClick(e, item)}
              >
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
                      title={expandedFolders[item.id] ? "Collapse" : "Expand"}
                    >
                      {expandedFolders[item.id] ? "▾" : "▸"}
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
                <div className="w-6 h-6 flex-shrink-0 flex items-center justify-center mr-1.5 sm:mr-1">
                  {item.type === "folder" ? (
                    <span
                      className={`${
                        !item.children || item.children.length === 0
                          ? "opacity-50"
                          : ""
                      }`}
                      aria-hidden="true"
                      onDoubleClick={(e) => {
                        if (!isMobile) {
                          e.preventDefault();
                          e.stopPropagation();
                          onToggleExpand(item.id);
                        }
                      }}
                    >
                      {expandedFolders[item.id] ? "📂" : "📁"}
                    </span>
                  ) : item.type === "task" ? (
                    <button
                      onClick={(e) =>
                        handleTaskToggle(e, item.id, item.completed)
                      }
                      className="focus:outline-none flex items-center justify-center cursor-pointer w-full h-full hover:scale-110 transition-transform"
                      aria-checked={!!item.completed}
                      role="checkbox"
                      aria-label={`Mark task ${item.label} as ${
                        item.completed ? "incomplete" : "complete"
                      }`}
                      title={`Mark as ${
                        item.completed ? "incomplete" : "complete"
                      }`}
                    >
                      {item.completed ? "✅" : "⬜️"}
                    </button>
                  ) : (
                    <span aria-hidden="true">📝</span>
                  )}
                </div>
                <div
                  className="flex-1 relative"
                  style={{ minWidth: 0 }}
                >
                  {isRenaming ? (
                    <>
                      <input
                        style={{ pointerEvents: "auto" }}
                        type="text"
                        className={`w-full bg-white dark:bg-zinc-800 outline-none border px-1 py-0.5 text-base md:text-sm rounded ${
                          hasError
                            ? "border-red-500 text-red-700 dark:text-red-400"
                            : "border-blue-400 text-black dark:text-white"
                        }`}
                        value={inlineRenameValue ?? ""}
                        onChange={(e) => {
                          setInlineRenameValue(e.target.value);
                          setLocalRenameError("");
                          if (setUiError) setUiError("");
                        }}
                        onTouchStart={(e) => e.stopPropagation()}
                        onTouchEnd={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => {
                          if (!e.target.dataset.hasSelected) {
                            if (isMobile) {
                              e.target.dataset.hasSelected = "true";
                            } else {
                              e.target.select();
                              e.target.dataset.hasSelected = "true";
                            }
                          }
                        }}
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
                      />
                      {hasError && (
                        <span
                          id={`${item.id}-rename-error`}
                          className="absolute left-1 top-full mt-0.5 text-xs text-red-600 dark:text-red-400 whitespace-normal z-10"
                        >
                          {localRenameError || uiError}
                        </span>
                      )}
                    </>
                  ) : (
                    <span
                      className={`whitespace-nowrap ${
                        item.type === "task" && item.completed
                          ? "line-through text-zinc-500 dark:text-zinc-400"
                          : ""
                      }`}
                    >
                      {item.label}
                    </span>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onShowItemMenu(item, e.currentTarget);
                  }}
                  className={`ml-1 p-1 rounded hover:bg-black/10 dark:hover:bg-white/20 ${
                    isSelected && !isRenaming
                      ? "text-white"
                      : "text-zinc-500 dark:text-zinc-400"
                  } opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100`}
                  aria-label={`More options for ${item.label}`}
                  title="More options"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
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
      handleTaskToggle,
      onDragStart,
      handleDragOver,
      handleDragLeave,
      handleItemDrop,
      onDrop,
      onNativeContextMenu,
      onShowItemMenu,
      onRename,
      onDragEnd,
      refocusTree,
      uiError,
      setUiError,
      localRenameError,
      handleItemClick,
      handleDoubleClick,
      isMobile,
    ]
  );

  return (
    <nav
      ref={navRef}
      className="overflow-auto h-full p-1.5 sm:p-1 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-400 rounded"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onContextMenu={handleNavContextMenu}
      aria-label="Notes and Tasks Tree"
    >
      {renderContent()}
    </nav>
  );
};

export default Tree;