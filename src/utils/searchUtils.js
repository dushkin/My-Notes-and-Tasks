import { htmlToPlainText } from './htmlUtils';

export function escapeRegex(str) {
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
      // Use the (now exported) escapeRegex function
      const safe = escapeRegex(query);
      pattern = opts.wholeWord ? `\\b${safe}\\b` : safe;
    }
    const re = new RegExp(pattern, flags);
    const matchResult = re.exec(text);

    if (matchResult) {
      return {
        matchedString: matchResult[0],
        startIndex: matchResult.index,
      };
    }
    return null;
  } catch (e) {
    // console.error("Regex error in matchText:", e, query, text);
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

  // Check label (common to all types that might have one)
  if (typeof item.label === 'string' && matchText(item.label, query, opts) !== null) {
    return true;
  }

  // Check title if it exists and differs from label
  if (typeof item.title === 'string' && item.title !== item.label && matchText(item.title, query, opts) !== null) {
    return true;
  }

  // Check content only for notes and tasks
  if ((item.type === 'note' || item.type === 'task') && typeof item.content === 'string') {
    // Convert HTML content to plain text before matching
    const plainTextContent = htmlToPlainText(item.content);

    if (matchText(plainTextContent, query, opts) !== null) {
      return true;
    }
  }

  return false;
}