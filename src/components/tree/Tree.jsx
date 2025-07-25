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
      ("ontouchstart" in window || navigator.maxTouchPoints > 0)
  );
  const [dragOverId, setDragOverId] = useState(null);
  const [localRenameError, setLocalRenameError] = useState("");
  const [lastClickTime, setLastClickTime] = useState(0);
  const [lastClickedItem, setLastClickedItem] = useState(null);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(
        "ontouchstart" in window || navigator.maxTouchPoints > 0
      );
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Render empty-tree placeholder or items
  const renderContent = () => {
    if (!items || items.length === 0) {
      const message = `${isMobile ? "Long press" : "Right click"} here to add your first tree folder!`;
      return (
        <div
          className="h-full flex items-center justify-center text-zinc-500 dark:text-zinc-400 italic p-4"
          onContextMenu={(e) => {
            e.preventDefault();
            onSelect(null);
            onNativeContextMenu(e, null);
          }}
          onTouchStart={(e) => {
            longPressTimeoutRef.current = setTimeout(() => {
              e.preventDefault();
              onSelect(null);
              onShowItemMenu(e, null, [
                { key: "add", label: "Add root folder" },
                { key: "import", label: "Import" }
              ]);
            }, 300);
          }}
          onTouchEnd={() => clearTimeout(longPressTimeoutRef.current)}
          onTouchMove={() => clearTimeout(longPressTimeoutRef.current)}
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

      e.stopPropagation();

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
                className={`relative z-10 flex items-center cursor-pointer rounded py-1.5 sm:py-1 pr-1 ${
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
                onClick={(e) => handleItemClick(e, item)}
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
                  className="flex-1 truncate relative"
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
                      className={`${
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