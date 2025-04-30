import React from "react";
import { sortItems } from "../utils/treeUtils";

const FolderContents = ({ folder, onSelect }) => {
  if (!folder.children || folder.children.length === 0) {
    return <p className="text-zinc-400 italic">This folder is empty.</p>;
  }

  return (
    <div>
      <ul className="space-y-2">
        {sortItems(folder.children).map((child) => (
          <li
            key={child.id}
            className="flex items-center p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded cursor-pointer"
            onClick={() => onSelect && onSelect(child)}
          >
            <span className="mr-2">
              {child.type === "folder" ? "📁" : child.type === "note" ? "📝" : child.completed ? "✅" : "⬜️"}
            </span>
            <span>{child.label}</span>
            <span className="ml-2 text-zinc-500 text-sm">
              ({child.type.charAt(0).toUpperCase() + child.type.slice(1)})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default FolderContents;