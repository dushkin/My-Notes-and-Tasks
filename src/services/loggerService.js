// src/services/loggerService.js

const LOG_LEVELS = {
  DEBUG: 'DEBUG',
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
};

// Placeholder for sending logs to a backend API
// You would implement this function to make an HTTP request
// to your backend logging endpoint if desired.
// eslint-disable-next-line no-unused-vars
async function sendLogToServer(level, message, context = {}) {
  // Example implementation (currently commented out):
  /*
  try {
    const logPayload = {
        timestamp: new Date().toISOString(),
        level,
        message,
        context,
        url: window.location.href,
        userAgent: navigator.userAgent,
    };
    // Replace '/api/logs' with your actual backend logging endpoint
    const response = await fetch('/api/logs', { 
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logPayload),
    });
    if (!response.ok) {
        // Use console.error directly here to avoid recursive logging if sendLogToServer fails
        console.error('loggerService: Failed to send log to server, server responded with status:', response.status);
    }
  } catch (error) {
    console.error('loggerService: Exception while trying to send log to server:', error);
  }
  */
}

const formatMessage = (level, message, context) => {
  const timestamp = new Date().toISOString();
  let logEntry = `${timestamp} [${level}] - ${message}`;
  if (context && Object.keys(context).length > 0) {
    try {
      // Simple check for error objects to avoid stringifying them poorly
      const cleanContext = {};
      for (const key in context) {
        if (context[key] instanceof Error) {
          cleanContext[key] = `Error: ${context[key].message}`;
        } else {
          cleanContext[key] = context[key];
        }
      }
      logEntry += ` | Context: ${JSON.stringify(cleanContext)}`;
    } catch (e) {
      logEntry += ` | Context: [UnserializableObject]`;
    }
  }
  return logEntry;
};

const logger = {
  debug: (message, context = {}) => {
    // Conditionally log debug messages, e.g., only in development
    if (import.meta.env.DEV || process.env.NODE_ENV === 'development') {
      console.debug(formatMessage(LOG_LEVELS.DEBUG, message, context));
    }
  },
  info: (message, context = {}) => {
    console.info(formatMessage(LOG_LEVELS.INFO, message, context));
    // Example: Send INFO logs if they are of high importance
    // if (context.important) sendLogToServer(LOG_LEVELS.INFO, message, context);
  },
  warn: (message, context = {}) => {
    console.warn(formatMessage(LOG_LEVELS.WARN, message, context));
    // Example: Send WARN logs to server
    // sendLogToServer(LOG_LEVELS.WARN, message, context);
  },
  error: (message, errorOrContext = null, optionalContext = {}) => {
    let mainMessage = message;
    let errorObject = null;
    let context = {};

    if (errorOrContext instanceof Error) {
        errorObject = errorOrContext;
        context = { ...optionalContext }; // Use optionalContext if error object is first
        mainMessage = message; // Original message is the primary descriptor
        if (errorObject.message && message !== errorObject.message) {
            // Append error message if it's different and provides more info
            // mainMessage += `: ${errorObject.message}`; // Or log separately
        }
        context.errorMessage = errorObject.message;
        context.errorStack = errorObject.stack;
        context.errorName = errorObject.name;

    } else if (errorOrContext !== null && typeof errorOrContext === 'object') {
        context = { ...errorOrContext, ...optionalContext };
    } else if (typeof errorOrContext === 'string') { // Simple string as second arg
        mainMessage = `${message}: ${errorOrContext}`;
        context = { ...optionalContext };
    } else { // Only message is provided
        context = { ...optionalContext };
    }
    
    // Log to browser console
    if (errorObject) {
        console.error(formatMessage(LOG_LEVELS.ERROR, mainMessage, context), errorObject);
    } else {
        console.error(formatMessage(LOG_LEVELS.ERROR, mainMessage, context));
    }

    // Example: Send all ERROR logs to the server
    sendLogToServer(LOG_LEVELS.ERROR, mainMessage, context);
  },
};

export default logger;