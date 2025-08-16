/**
 * RTL (Right-to-Left) text detection utilities
 * Detects if text contains RTL characters (Hebrew, Arabic, Persian, etc.)
 * and provides alignment recommendations
 */

/**
 * Detects if text contains RTL characters and should be aligned to the right
 * @param {string} text - The text to analyze
 * @returns {boolean} - True if text should be aligned right (RTL), false for left (LTR)
 */
export const isRTLText = (text) => {
  if (!text || typeof text !== 'string') return false;
  
  // Enhanced RTL character detection - covers Hebrew, Arabic, Persian, etc.
  const rtlChars = /[\u0590-\u08FF]|[\uFB1D-\uFDFF]|[\uFE70-\uFEFF]/g;
  const rtlMatches = text.match(rtlChars) || [];
  
  // Remove spaces, numbers, punctuation, and English letters for better analysis
  const textForAnalysis = text.replace(/[\s\d\p{P}\p{S}a-zA-Z]/gu, "");
  
  if (textForAnalysis.length === 0) return false;
  
  // Lower threshold for better RTL detection (30% instead of 75%)
  const rtlRatio = rtlMatches.length / textForAnalysis.length;
  return rtlRatio > 0.3;
};

/**
 * Gets text direction for HTML dir attribute
 * @param {string} text - The text to analyze
 * @returns {string} - 'rtl' or 'ltr'
 */
export const getTextDirection = (text) => {
  return isRTLText(text) ? 'rtl' : 'ltr';
};

/**
 * Gets CSS text-align value based on RTL detection
 * @param {string} text - The text to analyze
 * @returns {string} - 'right' or 'left'
 */
export const getTextAlignment = (text) => {
  return isRTLText(text) ? 'right' : 'left';
};

/**
 * Gets appropriate CSS classes for RTL/LTR text
 * @param {string} text - The text to analyze
 * @returns {string} - CSS classes for text alignment
 */
export const getTextAlignmentClasses = (text) => {
  return isRTLText(text) ? 'text-right' : 'text-left';
};