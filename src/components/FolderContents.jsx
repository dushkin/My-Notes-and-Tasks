    // src/components/FolderContents.jsx
    import React from "react";
    import { sortItems } from "../utils/treeUtils";

    /**
     * Displays the contents (children) of a selected folder.
     * Allows selecting child items.
     */
    const FolderContents = ({ folder, onSelect }) => {
      // Ensure the folder prop exists and has a valid children array
      // This check prevents errors if the folder object is somehow malformed.
      const hasChildren = folder && Array.isArray(folder.children) && folder.children.length > 0;

      if (!hasChildren) {
        // Line 7: Display message if folder is empty or invalid
        return <p className="text-zinc-400 italic">This folder is empty.</p>;
      }

      // If folder has children, render the list
      return (
        <div>
          <ul className="space-y-2">
            {/* Sort and map over the children */}
            {sortItems(folder.children).map((child) => (
              <li
                key={child.id} // Unique key for each child item
                className="flex items-center p-2 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded cursor-pointer"
                // Call the onSelect handler (provided by App.jsx) with the child's ID when clicked
                onClick={() => onSelect && onSelect(child.id)}
                role="button" // Indicate it's clickable
                tabIndex={0} // Make it focusable
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { onSelect && onSelect(child.id); } }} // Allow selection with Enter/Space
              >
                {/* Display appropriate icon based on child type */}
                <span className="mr-2" aria-hidden="true">
                  {child.type === "folder" ? "📁" : child.type === "note" ? "📝" : child.completed ? "✅" : "⬜️"}
                </span>
                {/* Display the child's label */}
                <span>{child.label}</span>
                {/* Display the child's type */}
                <span className="ml-2 text-zinc-500 text-sm">
                  ({child.type.charAt(0).toUpperCase() + child.type.slice(1)})
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
      // NO ContentEditor is rendered here.
    };

    export default FolderContents;
    