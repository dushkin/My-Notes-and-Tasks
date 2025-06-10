// src/utils/itemNameValidation.js

// Characters that could cause technical issues
const FORBIDDEN_CHARS = [
  '/', '\\',     // Path separators (could interfere with URL routing)
  '<', '>',     // HTML tags (XSS prevention)
  '|',          // Pipe character (could interfere with shell commands)
  '\0',         // Null character
  '\r', '\n',   // Line breaks (could cause display issues)
  '\t'          // Tabs (could cause formatting issues)
];

// More restrictive set for file export compatibility
const EXPORT_UNFRIENDLY_CHARS = [
  ...FORBIDDEN_CHARS,
  ':', '*', '?', '"',  // Windows filename restrictions
  // Note: We're being lenient with & and allowing it
];

/**
 * Validates an item name and returns validation result
 * @param {string} name - The item name to validate
 * @param {object} options - Validation options
 * @returns {object} - {isValid: boolean, error: string|null, sanitized: string}
 */
export function validateItemName(name, options = {}) {
  const {
    maxLength = 255,
    forbidExportUnfriendlyChars = false,
    allowEmptyAfterTrim = false
  } = options;

  // Basic checks
  if (typeof name !== 'string') {
    return { isValid: false, error: 'Name must be a string', sanitized: '' };
  }

  const trimmed = name.trim();
  
  if (!allowEmptyAfterTrim && !trimmed) {
    return { isValid: false, error: 'Name cannot be empty', sanitized: '' };
  }

  if (trimmed.length > maxLength) {
    return { 
      isValid: false, 
      error: `Name cannot exceed ${maxLength} characters`, 
      sanitized: trimmed.substring(0, maxLength) 
    };
  }

  // Choose character set based on options
  const forbiddenChars = forbidExportUnfriendlyChars ? EXPORT_UNFRIENDLY_CHARS : FORBIDDEN_CHARS;
  
  // Check for forbidden characters
  const foundForbiddenChar = forbiddenChars.find(char => trimmed.includes(char));
  if (foundForbiddenChar) {
    const charName = getCharacterName(foundForbiddenChar);
    return { 
      isValid: false, 
      error: `Name cannot contain ${charName}`, 
      sanitized: sanitizeName(trimmed, forbiddenChars)
    };
  }

  // Check for leading/trailing periods (can cause issues on some systems)
  if (trimmed.startsWith('.') || trimmed.endsWith('.')) {
    return { 
      isValid: false, 
      error: 'Name cannot start or end with a period', 
      sanitized: trimmed.replace(/^\.+|\.+$/g, '')
    };
  }

  // Check for reserved names (Windows system names)
  const upperName = trimmed.toUpperCase();
  const reservedNames = ['CON', 'PRN', 'AUX', 'NUL', 'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9', 'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9'];
  if (reservedNames.includes(upperName)) {
    return { 
      isValid: false, 
      error: `"${trimmed}" is a reserved system name`, 
      sanitized: trimmed + '_item'
    };
  }

  return { isValid: true, error: null, sanitized: trimmed };
}

/**
 * Sanitizes a name by removing forbidden characters
 * @param {string} name - The name to sanitize
 * @param {array} forbiddenChars - Array of forbidden characters
 * @returns {string} - Sanitized name
 */
function sanitizeName(name, forbiddenChars = FORBIDDEN_CHARS) {
  let sanitized = name;
  forbiddenChars.forEach(char => {
    sanitized = sanitized.replaceAll(char, '');
  });
  return sanitized.trim();
}

/**
 * Gets a human-readable name for a character
 * @param {string} char - The character
 * @returns {string} - Human-readable name
 */
function getCharacterName(char) {
  const charNames = {
    '/': 'forward slash (/)',
    '\\': 'backslash (\\)',
    '<': 'less than sign (<)',
    '>': 'greater than sign (>)',
    '|': 'pipe character (|)',
    ':': 'colon (:)',
    '*': 'asterisk (*)',
    '?': 'question mark (?)',
    '"': 'quotation mark (")',
    '\0': 'null character',
    '\r': 'carriage return',
    '\n': 'line break',
    '\t': 'tab character'
  };
  return charNames[char] || `"${char}"`;
}

// Frontend validation hook
export function useItemNameValidation() {
  return {
    validateName: (name, options = {}) => validateItemName(name, options),
    sanitizeName: (name, forbiddenChars) => sanitizeName(name, forbiddenChars)
  };
}