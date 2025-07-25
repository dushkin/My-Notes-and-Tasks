/**
 * Utility functions for handling HTML content safely
 */

/**
 * Converts HTML content to plain text, preserving basic formatting
 * @param {string} html - The HTML content to convert
 * @returns {string} - Plain text representation
 */
export function htmlToPlainText(html) {
  if (!html || typeof html !== 'string') return "";
  
  let text = html;
  
  // Replace block elements with newlines
  text = text.replace(
    /<(div|p|h[1-6]|li|blockquote|pre|tr|hr)[^>]*>/gi,
    "\n$&"
  );
  
  // Replace <br> tags with newlines
  text = text.replace(/<br\s*\/?>/gi, "\n");
  
  // Remove all HTML tags
  text = text.replace(/<[^>]+>/g, "");
  
  try {
    // Use DOM parsing for proper HTML entity decoding
    const tempDiv = document.createElement("div");
    tempDiv.innerHTML = text;
    text = tempDiv.textContent || tempDiv.innerText || "";
  } catch (e) {
    console.error("Error converting HTML to plain text:", e);
    // Return empty string instead of raw HTML on error
    return "";
  }
  
  // Clean up multiple newlines and trim
  return text.replace(/(\r?\n|\r){2,}/g, "\n").trim();
}

/**
 * Sanitizes HTML content for safe display in attributes like title
 * @param {string} html - The HTML content to sanitize
 * @returns {string} - Sanitized plain text
 */
export function sanitizeForAttribute(html) {
  const plainText = htmlToPlainText(html);
  
  // Additional sanitization for HTML attributes
  return plainText
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Checks if a string contains HTML tags
 * @param {string} str - The string to check
 * @returns {boolean} - True if contains HTML tags
 */
export function containsHTML(str) {
  if (!str || typeof str !== 'string') return false;
  return /<[^>]*>/g.test(str);
}

/**
 * Creates a safe preview text from HTML content
 * @param {string} html - The HTML content
 * @param {number} maxLength - Maximum length of preview (default: 100)
 * @returns {string} - Safe preview text
 */
export function createPreviewText(html, maxLength = 100) {
  const plainText = htmlToPlainText(html);
  
  if (plainText.length <= maxLength) {
    return plainText;
  }
  
  return plainText.substring(0, maxLength).trim() + '...';
}