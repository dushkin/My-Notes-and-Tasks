// Smart debouncing that adapts to user behavior and content characteristics

import { EditHistoryTracker } from './editHistoryTracker.js';

/**
 * Adaptive debounce function that adjusts timing based on user behavior
 */
export class AdaptiveDebounce {
  constructor(baseDelay = 2000, options = {}) {
    this.baseDelay = baseDelay;
    this.options = {
      minDelay: 500,
      maxDelay: 10000,
      learningRate: 0.1,
      enableLearning: true,
      debugMode: false,
      ...options
    };
    
    this.editTracker = new EditHistoryTracker();
    this.timeoutId = null;
    this.currentDelay = baseDelay;
    this.lastExecutionTime = 0;
    this.executionHistory = [];
    this.userPreferences = this.loadUserPreferences();
  }

  /**
   * Execute the debounced function with adaptive timing
   * @param {Function} func - Function to execute
   * @param {...any} args - Arguments to pass to function
   */
  execute(func, ...args) {
    // Clear existing timeout
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    // Calculate adaptive delay
    const adaptiveDelay = this.calculateAdaptiveDelay();
    this.currentDelay = adaptiveDelay;

    if (this.options.debugMode) {
      console.log('🎯 Adaptive debounce:', {
        delay: adaptiveDelay,
        reason: this.getDelayReason(),
        pattern: this.editTracker.analyzeTypingPatterns().pattern
      });
    }

    // Set new timeout with adaptive delay
    this.timeoutId = setTimeout(() => {
      const executionTime = Date.now();
      this.recordExecution(executionTime, adaptiveDelay);
      
      try {
        func(...args);
      } catch (error) {
        console.error('Adaptive debounce execution failed:', error);
      }
      
      this.timeoutId = null;
    }, adaptiveDelay);
  }

  /**
   * Calculate adaptive delay based on current context
   * @returns {number} Recommended delay in milliseconds
   */
  calculateAdaptiveDelay() {
    const recommendations = this.editTracker.getAutoSaveRecommendations(this.baseDelay);
    let adaptiveDelay = recommendations.recommendedDelay;

    // Apply user learning adjustments
    if (this.options.enableLearning) {
      adaptiveDelay = this.applyLearningAdjustments(adaptiveDelay);
    }

    // Apply contextual modifiers
    adaptiveDelay = this.applyContextualModifiers(adaptiveDelay);

    // Ensure delay is within bounds
    return Math.max(
      this.options.minDelay,
      Math.min(adaptiveDelay, this.options.maxDelay)
    );
  }

  /**
   * Apply learning-based adjustments from user behavior
   * @param {number} baseDelay - Base calculated delay
   * @returns {number} Adjusted delay
   */
  applyLearningAdjustments(baseDelay) {
    const userPattern = this.analyzeUserBehaviorPattern();
    let adjustment = 1.0;

    // Adjust based on learned user patterns
    switch (userPattern) {
      case 'fast_saver':
        adjustment = 0.8; // User prefers faster saves
        break;
      case 'batch_saver':
        adjustment = 1.3; // User prefers to batch edits
        break;
      case 'interruption_sensitive':
        adjustment = 1.5; // User gets interrupted often
        break;
      case 'consistent_typist':
        adjustment = 1.1; // Steady typing pattern
        break;
    }

    return Math.round(baseDelay * adjustment);
  }

  /**
   * Apply contextual modifiers based on current environment
   * @param {number} delay - Current delay
   * @returns {number} Modified delay
   */
  applyContextualModifiers(delay) {
    let modifiedDelay = delay;
    const analysis = this.editTracker.analyzeTypingPatterns();

    // Network condition modifier
    if (!navigator.onLine) {
      modifiedDelay *= 0.7; // Faster saves when offline for queuing
    } else if (this.isSlowConnection()) {
      modifiedDelay *= 1.2; // Slower saves on slow connections
    }

    // Device performance modifier
    if (this.isLowPerformanceDevice()) {
      modifiedDelay *= 1.3; // Longer delays on slow devices
    }

    // Time of day modifier (optional)
    if (this.options.enableTimeBasedAdjustment) {
      const hour = new Date().getHours();
      if (hour >= 9 && hour <= 17) {
        modifiedDelay *= 1.1; // Slightly longer during work hours
      }
    }

    return Math.round(modifiedDelay);
  }

  /**
   * Analyze user behavior patterns from execution history
   * @returns {string} User behavior pattern
   */
  analyzeUserBehaviorPattern() {
    if (this.executionHistory.length < 10) {
      return 'learning'; // Not enough data yet
    }

    const recentExecutions = this.executionHistory.slice(-20);
    const avgDelay = recentExecutions.reduce((sum, exec) => sum + exec.delay, 0) / recentExecutions.length;
    const avgGap = this.calculateAverageExecutionGap(recentExecutions);

    // Analyze cancellation patterns
    const cancellationRate = this.calculateCancellationRate();

    if (avgDelay < this.baseDelay * 0.8 && cancellationRate < 0.1) {
      return 'fast_saver';
    } else if (avgDelay > this.baseDelay * 1.3 && avgGap > 10000) {
      return 'batch_saver';
    } else if (cancellationRate > 0.3) {
      return 'interruption_sensitive';
    } else if (Math.abs(avgDelay - this.baseDelay) < this.baseDelay * 0.2) {
      return 'consistent_typist';
    }

    return 'standard';
  }

  /**
   * Calculate average gap between executions
   * @param {Array} executions - Execution history
   * @returns {number} Average gap in milliseconds
   */
  calculateAverageExecutionGap(executions) {
    if (executions.length < 2) return 0;

    const gaps = [];
    for (let i = 1; i < executions.length; i++) {
      gaps.push(executions[i].timestamp - executions[i-1].timestamp);
    }

    return gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length;
  }

  /**
   * Calculate how often saves get cancelled/interrupted
   * @returns {number} Cancellation rate (0-1)
   */
  calculateCancellationRate() {
    const recentActivity = this.editTracker.getRecentActivity(300000); // Last 5 minutes
    const recentExecutions = this.executionHistory.slice(-10);

    if (recentExecutions.length === 0) return 0;

    // Estimate cancellations by comparing edit frequency to execution frequency
    const editCount = recentActivity.length;
    const executionCount = recentExecutions.length;

    return editCount > 0 ? Math.max(0, 1 - (executionCount / (editCount / 5))) : 0;
  }

  /**
   * Check if connection is slow based on recent performance
   * @returns {boolean} True if connection appears slow
   */
  isSlowConnection() {
    // Simple heuristic - could be enhanced with actual network monitoring
    return navigator.connection && navigator.connection.effectiveType === 'slow-2g';
  }

  /**
   * Check if device has low performance
   * @returns {boolean} True if device appears to be low performance
   */
  isLowPerformanceDevice() {
    // Simple heuristic based on hardware concurrency and memory
    const cores = navigator.hardwareConcurrency || 1;
    const memory = navigator.deviceMemory || 1;
    
    return cores <= 2 || memory <= 2;
  }

  /**
   * Record edit event for analysis
   * @param {string} type - Edit type
   * @param {number} position - Cursor position
   * @param {number} length - Change length
   * @param {string} content - Content sample
   */
  recordEdit(type, position, length, content) {
    this.editTracker.recordEdit(type, position, length, content);
  }

  /**
   * Record successful execution for learning
   * @param {number} timestamp - Execution timestamp
   * @param {number} delay - Delay that was used
   */
  recordExecution(timestamp, delay) {
    this.lastExecutionTime = timestamp;
    this.executionHistory.push({ timestamp, delay });

    // Keep history manageable
    if (this.executionHistory.length > 100) {
      this.executionHistory = this.executionHistory.slice(-50);
    }

    // Learn from successful execution
    if (this.options.enableLearning) {
      this.updateUserPreferences(delay);
    }
  }

  /**
   * Update user preferences based on successful executions
   * @param {number} usedDelay - Delay that was successfully used
   */
  updateUserPreferences(usedDelay) {
    const analysis = this.editTracker.analyzeTypingPatterns();
    
    if (!this.userPreferences[analysis.pattern]) {
      this.userPreferences[analysis.pattern] = [];
    }

    this.userPreferences[analysis.pattern].push(usedDelay);

    // Keep only recent preferences
    if (this.userPreferences[analysis.pattern].length > 20) {
      this.userPreferences[analysis.pattern] = this.userPreferences[analysis.pattern].slice(-10);
    }

    this.saveUserPreferences();
  }

  /**
   * Get explanation for current delay decision
   * @returns {string} Human readable reason
   */
  getDelayReason() {
    const recommendations = this.editTracker.getAutoSaveRecommendations(this.baseDelay);
    return recommendations.reason;
  }

  /**
   * Force immediate execution (bypass debounce)
   * @param {Function} func - Function to execute
   * @param {...any} args - Arguments
   */
  executeImmediate(func, ...args) {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    this.recordExecution(Date.now(), 0);
    func(...args);
  }

  /**
   * Cancel pending execution
   */
  cancel() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  /**
   * Reset state (e.g., when switching items)
   */
  reset() {
    this.cancel();
    this.editTracker.reset();
    this.currentDelay = this.baseDelay;
  }

  /**
   * Load user preferences from localStorage
   * @returns {object} User preferences
   */
  loadUserPreferences() {
    try {
      const saved = localStorage.getItem('adaptiveDebounce_userPreferences');
      return saved ? JSON.parse(saved) : {};
    } catch (error) {
      console.warn('Failed to load adaptive debounce preferences:', error);
      return {};
    }
  }

  /**
   * Save user preferences to localStorage
   */
  saveUserPreferences() {
    try {
      localStorage.setItem('adaptiveDebounce_userPreferences', 
        JSON.stringify(this.userPreferences));
    } catch (error) {
      console.warn('Failed to save adaptive debounce preferences:', error);
    }
  }

  /**
   * Get current status and debug information
   * @returns {object} Status information
   */
  getStatus() {
    const analysis = this.editTracker.analyzeTypingPatterns();
    
    return {
      currentDelay: this.currentDelay,
      baseDelay: this.baseDelay,
      isPending: !!this.timeoutId,
      userPattern: this.analyzeUserBehaviorPattern(),
      typingPattern: analysis.pattern,
      confidence: analysis.confidence,
      recommendations: this.editTracker.getAutoSaveRecommendations(this.baseDelay),
      executionCount: this.executionHistory.length,
      editHistory: this.editTracker.getDebugInfo()
    };
  }

  /**
   * Enable or disable debug mode
   * @param {boolean} enabled - Whether to enable debug mode
   */
  setDebugMode(enabled) {
    this.options.debugMode = enabled;
  }
}

export default AdaptiveDebounce;