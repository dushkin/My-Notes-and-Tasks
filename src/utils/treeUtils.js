export const sortItems = (items) => {
  if (!items || !Array.isArray(items)) return [];

  return [...items].sort((a, b) => {
    // First, sort by item type (folders first)
    if (a.type === "folder" && b.type !== "folder") return -1;
    if (a.type !== "folder" && b.type === "folder") return 1;

    // If both are not folders, sort notes before tasks
    if (a.type === "note" && b.type === "task") return -1;
    if (a.type === "task" && b.type === "note") return 1;

    // If same type, sort alphabetically by label (case-insensitive)
    return a.label.localeCompare(b.label, undefined, { sensitivity: 'base' });
  });
};

export const handleDrop = (tree, targetId, draggedId, setTree) => {
  if (targetId === draggedId) return;

  let dragged = null;
  const remove = (items) => {
    const result = [];
    for (const item of items) {
      if (item.id === draggedId) {
        dragged = item;
        continue;
      }
      const newItem = { ...item };
      if (newItem.children?.length > 0) {
        newItem.children = remove(newItem.children);
      }
      result.push(newItem);
    }
    return result;
  };

  const newTree = remove([...tree]);
  if (!dragged) return;

  const isDescendant = (parent, id) => {
    if (parent.id === id) return true;
    return parent.children?.some((c) => isDescendant(c, id)) || false;
  };

  const insert = (items) => {
    return items.map((item) => {
      if (item.id === targetId) {
        if (item.type === "folder" && !isDescendant(dragged, item.id)) {
          // Add the dragged item to the folder's children and make sure they're sorted
          return {
            ...item,
            children: sortItems([...(item.children || []), dragged]),
          };
        }
      }
      if (item.children?.length > 0) {
        return { ...item, children: insert(item.children) };
      }
      return item;
    });
  };

  setTree(insert(newTree));
};