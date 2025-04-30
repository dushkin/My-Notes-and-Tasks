import React, { useRef } from "react";
import { sortItems } from "../utils/treeUtils";

const Tree = ({
  items,
  selectedItemId,
  inlineRenameId,
  inlineRenameValue,
  setInlineRenameValue,
  finishInlineRename,
  cancelInlineRename,
  expandedFolders,
  onToggleExpand,
  onSelect,
  onToggleTask,
  onDragStart,
  onDrop,
  onContextMenu,
  onRename,
}) => {
  const navRef = useRef(null);

  // Flatten visible items
  const getVisible = (nodes) => {
    let out = [];
    sortItems(nodes).forEach((it) => {
      out.push(it);
      if (it.children && expandedFolders[it.id]) {
        out = out.concat(getVisible(it.children));
      }
    });
    return out;
  };

  // Find parent for ArrowLeft
  const findParent = (nodes, childId, parent = null) => {
    for (const it of nodes) {
      if (it.id === childId) return parent;
      if (it.children) {
        const p = findParent(it.children, childId, it);
        if (p) return p;
      }
    }
    return null;
  };

  // Key navigation (arrows + space toggle)
  const handleKeyDown = (e) => {
    // Skip when editing
    if (e.target.tagName === "INPUT") return;

    const visible = getVisible(items);
    const idx = visible.findIndex((it) => it.id === selectedItemId);

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (idx < visible.length - 1) onSelect(visible[idx + 1]);
        else if (idx === -1 && visible.length) onSelect(visible[0]);
        break;
      case "ArrowUp":
        e.preventDefault();
        if (idx > 0) onSelect(visible[idx - 1]);
        break;
      case "ArrowRight":
        e.preventDefault();
        if (idx === -1) return;
        const curR = visible[idx];
        if (curR.type === "folder") {
          if (!expandedFolders[curR.id]) {
            onToggleExpand(curR.id, true);
          } else if (curR.children?.length) {
            onSelect(curR.children[0]);
          }
        }
        break;
      case "ArrowLeft":
        e.preventDefault();
        if (idx === -1) return;
        const curL = visible[idx];
        if (curL.type === "folder" && expandedFolders[curL.id]) {
          onToggleExpand(curL.id, false);
        } else {
          const parent = findParent(items, curL.id);
          if (parent) onSelect(parent);
        }
        break;
      case " ":
      case "Spacebar":
        e.preventDefault();
        if (idx === -1) return;
        const cur = visible[idx];
        if (cur.type === "task") {
          onToggleTask(cur.id, !cur.completed);
        }
        break;
      default:
        break;
    }
  };

  const renderItems = (nodes, depth = 0) => (
    <ul className="list-none" style={{ marginLeft: depth * 16 }}>
      {sortItems(nodes).map((item) => (
        <li
          key={item.id}
          className="py-1"
          onDragStart={(e) => onDragStart(e, item.id)}
          onDrop={(e) => onDrop(e, item.id)}
          draggable
        >
          <div
            className={`flex items-center px-1 ${
              item.id === selectedItemId ? "bg-blue-600 text-white" : ""
            }`}
            onContextMenu={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onContextMenu(e, item);
            }}
          >
            {item.type === "folder" ? (
              <button
                onClick={() => onToggleExpand(item.id)}
                className="mr-2 flex items-center focus:outline-none"
              >
                <span className="mr-1">
                  {expandedFolders[item.id] ? "▾" : "▸"}
                </span>
                {expandedFolders[item.id] ? "📂" : "📁"}
              </button>
            ) : item.type === "task" ? (
              <button
                onClick={() => onToggleTask(item.id, !item.completed)}
                className="mr-2 focus:outline-none"
              >
                {item.completed ? "✅" : "⬜️"}
              </button>
            ) : (
              <span className="mr-2">📝</span>
            )}

            {item.id === inlineRenameId ? (
              <input
                className="flex-1 bg-transparent outline-none"
                value={inlineRenameValue}
                onChange={(e) => setInlineRenameValue(e.target.value)}
                onBlur={() => {
                  finishInlineRename();
                  navRef.current?.focus({ preventScroll: true });
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    finishInlineRename();
                    navRef.current?.focus({ preventScroll: true });
                  } else if (e.key === "Escape") {
                    cancelInlineRename();
                    setTimeout(() =>
                      navRef.current?.focus({ preventScroll: true }),
                      0
                    );
                  }
                }}
                autoFocus
              />
            ) : (
              <span
                className="flex-1 cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(item);
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onContextMenu(e, item);
                }}
              >
                {item.label}
              </span>
            )}
          </div>

          {item.children &&
            expandedFolders[item.id] &&
            renderItems(item.children, depth + 1)}
        </li>
      ))}
    </ul>
  );

  return (
    <nav
      ref={navRef}
      className="overflow-auto h-full"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onContextMenu={(e) => {
        e.preventDefault();
        onContextMenu(e, null);
      }}
    >
      {renderItems(items)}
    </nav>
  );
};

export default Tree;