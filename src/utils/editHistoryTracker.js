// ============================================================================
// EDIT HISTORY TRACKER
// ============================================================================
// Tracks user editing patterns to optimize auto-save behavior

/**
 * Represents a single edit event
 */
class EditEvent {
  constructor(type, position, length, timestamp, content) {
    this.type = type; // 'insert', 'delete', 'replace', 'paste'
    this.position = position; // Cursor position where edit occurred
    this.length = length; // Length of change
    this.timestamp = timestamp;
    this.content = content; // Sample of content for analysis
  }
}

/**
 * Tracks and analyzes user editing patterns
 */
export class EditHistoryTracker {
  constructor(maxHistorySize = 50) {
    this.maxHistorySize = maxHistorySize;
    this.editHistory = [];
    this.sessionStartTime = Date.now();
    this.lastEditTime = null;
    this.contentLength = 0;
  }

  /**
   * Record a new edit event
   * @param {string} type - Type of edit
   * @param {number} position - Cursor position
   * @param {number} length - Length of change
   * @param {string} content - Content sample
   */
  recordEdit(type, position = 0, length = 0, content = '') {
    const timestamp = Date.now();
    const editEvent = new EditEvent(type, position, length, timestamp, content);
    
    this.editHistory.push(editEvent);
    this.lastEditTime = timestamp;
    this.contentLength = content.length;
    
    // Keep history size manageable
    if (this.editHistory.length > this.maxHistorySize) {
      this.editHistory.shift();
    }
    
    console.debug('📝 Edit recorded:', {
      type,
      position,
      length,
      contentLength: content.length,
      timestamp
    });
  }

  /**
   * Get recent editing activity
   * @param {number} timeWindowMs - Time window in milliseconds
   * @returns {Array} Recent edit events
   */
  getRecentActivity(timeWindowMs = 10000) {
    const cutoff = Date.now() - timeWindowMs;
    return this.editHistory.filter(edit => edit.timestamp >= cutoff);
  }

  /**
   * Calculate typing speed in characters per minute
   * @param {number} timeWindowMs - Time window to analyze
   * @returns {number} Characters per minute
   */
  getTypingSpeed(timeWindowMs = 60000) {
    const recentEdits = this.getRecentActivity(timeWindowMs);
    if (recentEdits.length === 0) return 0;
    
    const totalChars = recentEdits
      .filter(edit => edit.type === 'insert' || edit.type === 'paste')
      .reduce((sum, edit) => sum + edit.length, 0);
    
    const timeSpanMs = Math.max(1000, timeWindowMs);
    return Math.round((totalChars / timeSpanMs) * 60000); // Convert to CPM
  }

  /**
   * Detect if user is actively typing
   * @param {number} maxGapMs - Maximum gap between keystrokes to consider active
   * @returns {boolean} True if actively typing
   */
  isActivelyTyping(maxGapMs = 1500) {
    if (!this.lastEditTime) return false;
    
    const timeSinceLastEdit = Date.now() - this.lastEditTime;
    const recentEdits = this.getRecentActivity(10000);
    
    // Must have recent activity and small gaps between edits
    return timeSinceLastEdit < maxGapMs && recentEdits.length >= 2;
  }

  /**
   * Calculate edit frequency (edits per minute)
   * @param {number} timeWindowMs - Time window to analyze
   * @returns {number} Edits per minute
   */
  getEditFrequency(timeWindowMs = 60000) {
    const recentEdits = this.getRecentActivity(timeWindowMs);
    return (recentEdits.length / timeWindowMs) * 60000;
  }

  /**
   * Analyze typing patterns to determine editing behavior
   * @returns {object} Analysis results
   */
  analyzeTypingPatterns() {
    const recentEdits = this.getRecentActivity(30000); // Last 30 seconds
    const veryRecentEdits = this.getRecentActivity(5000); // Last 5 seconds
    
    if (recentEdits.length === 0) {
      return {
        pattern: 'idle',
        confidence: 1.0,
        typingSpeed: 0,
        editFrequency: 0,
        isActivelyTyping: false
      };
    }

    // Calculate metrics
    const typingSpeed = this.getTypingSpeed();
    const editFrequency = this.getEditFrequency();
    const isActivelyTyping = this.isActivelyTyping();
    
    // Analyze edit types
    const insertRatio = recentEdits.filter(e => e.type === 'insert').length / recentEdits.length;
    const deleteRatio = recentEdits.filter(e => e.type === 'delete').length / recentEdits.length;
    const pasteRatio = recentEdits.filter(e => e.type === 'paste').length / recentEdits.length;
    
    // Calculate edit gaps
    const gaps = [];
    for (let i = 1; i < veryRecentEdits.length; i++) {
      gaps.push(veryRecentEdits[i].timestamp - veryRecentEdits[i-1].timestamp);
    }
    const avgGap = gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;

    // Determine pattern
    let pattern = 'unknown';
    let confidence = 0.5;

    if (!isActivelyTyping && editFrequency < 5) {
      pattern = 'idle';
      confidence = 0.9;
    } else if (pasteRatio > 0.5) {
      pattern = 'pasting';
      confidence = 0.8;
    } else if (insertRatio > 0.8 && avgGap < 300 && typingSpeed > 100) {
      pattern = 'fast_typing';
      confidence = 0.9;
    } else if (insertRatio > 0.7 && avgGap < 800) {
      pattern = 'steady_typing';
      confidence = 0.8;
    } else if (deleteRatio > 0.4) {
      pattern = 'editing';
      confidence = 0.7;
    } else if (editFrequency > 20) {
      pattern = 'rapid_changes';
      confidence = 0.8;
    }

    return {
      pattern,
      confidence,
      typingSpeed,
      editFrequency,
      isActivelyTyping,
      insertRatio,
      deleteRatio,
      pasteRatio,
      avgGap,
      metrics: {
        recentEditCount: recentEdits.length,
        contentLength: this.contentLength,
        sessionDuration: Date.now() - this.sessionStartTime
      }
    };
  }

  /**
   * Get recommendations for auto-save timing
   * @param {number} baseDelay - Base delay in milliseconds
   * @returns {object} Timing recommendations
   */
  getAutoSaveRecommendations(baseDelay = 2000) {
    const analysis = this.analyzeTypingPatterns();
    let recommendedDelay = baseDelay;
    let reason = 'default';

    switch (analysis.pattern) {
      case 'fast_typing':
        recommendedDelay = Math.max(baseDelay * 2, 4000);
        reason = 'fast typing detected - extended delay';
        break;
        
      case 'steady_typing':
        recommendedDelay = Math.max(baseDelay * 1.5, 3000);
        reason = 'steady typing - moderate delay';
        break;
        
      case 'rapid_changes':
        recommendedDelay = Math.max(baseDelay * 1.8, 3500);
        reason = 'rapid changes - longer delay to batch';
        break;
        
      case 'editing':
        recommendedDelay = Math.max(baseDelay * 1.2, 2500);
        reason = 'editing mode - slight delay increase';
        break;
        
      case 'pasting':
        recommendedDelay = Math.min(baseDelay * 0.8, 1500);
        reason = 'paste operation - quicker save';
        break;
        
      case 'idle':
        recommendedDelay = Math.min(baseDelay * 0.5, 1000);
        reason = 'idle state - quick save';
        break;
    }

    // Content size adjustments
    if (this.contentLength > 100000) { // >100KB
      recommendedDelay = Math.max(recommendedDelay, 5000);
      reason += ' + large content adjustment';
    } else if (this.contentLength > 50000) { // >50KB
      recommendedDelay = Math.max(recommendedDelay, 4000);
      reason += ' + medium content adjustment';
    }

    return {
      recommendedDelay: Math.min(recommendedDelay, 10000), // Cap at 10 seconds
      reason,
      analysis,
      shouldSaveNow: analysis.pattern === 'idle' && Date.now() - this.lastEditTime > 2000
    };
  }

  /**
   * Reset history (e.g., when switching to a different item)
   */
  reset() {
    this.editHistory = [];
    this.sessionStartTime = Date.now();
    this.lastEditTime = null;
    this.contentLength = 0;
  }

  /**
   * Get debug information
   * @returns {object} Debug data
   */
  getDebugInfo() {
    const analysis = this.analyzeTypingPatterns();
    const recommendations = this.getAutoSaveRecommendations();
    
    return {
      historySize: this.editHistory.length,
      lastEditTime: this.lastEditTime,
      contentLength: this.contentLength,
      sessionDuration: Date.now() - this.sessionStartTime,
      analysis,
      recommendations,
      recentEdits: this.getRecentActivity(10000).map(edit => ({
        type: edit.type,
        timestamp: edit.timestamp,
        length: edit.length
      }))
    };
  }
}

export default EditHistoryTracker;