// src/utils/searchUtils.js

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Finds the first match of a query in text based on options.
 * @param {string} text The text to search within.
 * @param {string} query The search query.
 * @param {object} opts Search options (caseSensitive, wholeWord, useRegex).
 * @returns {object|null} An object { matchedString, startIndex } or null if no match.
 */
export function matchText(text, query, opts) {
  if (!query || text == null || typeof text !== 'string') return null;
  const flags = opts.caseSensitive ? '' : 'i';
  try {
    let pattern;
    if (opts.useRegex) {
      pattern = query;
    } else {
      const safe = escapeRegex(query);
      pattern = opts.wholeWord ? `\\b${safe}\\b` : safe;
    }
    const re = new RegExp(pattern, flags);
    const matchResult = re.exec(text); // Use exec() to get index and matched string

    if (matchResult) {
      return {
        matchedString: matchResult[0], // The actual matched string
        startIndex: matchResult.index,  // The starting index of the match
      };
    }
    return null; // No match
  } catch (e) {
    // console.error("Regex error in matchText:", e, query, text); // For debugging
    return null;
  }
}

/**
 * Checks if an item matches the search query based on its type and relevant fields.
 * For folders, checks only the label.
 * For notes/tasks, checks label and content.
 * @param {object} item The item to check.
 * @param {string} query The search query.
 * @param {object} opts Search options.
 * @returns {boolean} True if the item is a match, false otherwise.
 */
export function itemMatches(item, query, opts) {
  if (!item || !query) return false;

  if (item.type === 'folder') {
    if (typeof item.label === 'string' && matchText(item.label, query, opts) !== null) {
      return true;
    }
  } else if (item.type === 'note' || item.type === 'task') {
    // Check label first
    if (typeof item.label === 'string' && matchText(item.label, query, opts) !== null) {
      return true;
    }
    // Then check content
    if (typeof item.content === 'string' && matchText(item.content, query, opts) !== null) {
      return true;
    }
    // If item has a 'title' (e.g. from an imported structure) and it's different from label, you could check it too
    if (typeof item.title === 'string' && item.title !== item.label && matchText(item.title, query, opts) !== null) {
      return true;
    }
  }
  return false;
}