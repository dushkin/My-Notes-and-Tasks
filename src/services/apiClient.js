import { getAccessToken, getRefreshToken, storeTokens, clearTokens } from "./authService";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";

let onLogoutCallback = () => {
  console.warn("onLogoutCallback not initialized in apiClient. Call apiClient.init() in App.jsx.");
  window.location.href = '/login'; // Fallback
};

let isRefreshing = false;
let refreshSubscribers = [];

const addRefreshSubscriber = (callback) => {
  refreshSubscribers.push(callback);
};

const onRefreshed = (newAccessToken) => {
  refreshSubscribers.map(callback => callback(newAccessToken));
  refreshSubscribers = [];
};

const onRefreshFailed = (error) => {
  refreshSubscribers.map(callback => callback(null, error));
  refreshSubscribers = [];
};

export const initApiClient = (logoutHandler) => {
  if (typeof logoutHandler === 'function') {
    onLogoutCallback = logoutHandler;
  }
};

// Enhanced error handling utility
const createApiError = (message, status = null, originalError = null) => {
  const error = new Error(message);
  error.status = status;
  error.originalError = originalError;
  error.isApiError = true;
  return error;
};

const isNetworkError = (error) => {
  return error instanceof TypeError &&
    (error.message.includes('Failed to fetch') ||
      error.message.includes('Network request failed') ||
      error.message.includes('fetch is not defined'));
};

const isTimeoutError = (error) => {
  return error.name === 'AbortError' ||
    error.message.includes('timeout') ||
    error.code === 'TIMEOUT';
};

const shouldTriggerLogout = (status, errorMessage = '') => {
  // Authentication-related errors that should trigger logout
  const authErrorPatterns = [
    'token',
    'expired',
    'not authorized',
    'unauthorized',
    'invalid token',
    'authentication failed',
    'access denied',
    'forbidden'
  ];

  return status === 401 ||
    status === 403 ||
    authErrorPatterns.some(pattern =>
      errorMessage.toLowerCase().includes(pattern)
    );
};

const refreshTokenFlow = async () => {
  const currentRefreshToken = getRefreshToken();
  if (!currentRefreshToken) {
    const error = createApiError("No refresh token available. Please login again.", 401);
    onLogoutCallback();
    return Promise.reject(error);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
      credentials: 'include',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: currentRefreshToken }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorData;
      try {
        errorData = await response.json();
      } catch (parseError) {
        errorData = { error: `Server error (${response.status})` };
      }

      console.error("Refresh token failed:", response.status, errorData);
      clearTokens();

      const errorMessage = errorData.error || "Session expired. Please login again.";
      const error = createApiError(errorMessage, response.status);

      onLogoutCallback();
      return Promise.reject(error);
    }

    const data = await response.json();
    if (data.accessToken && data.refreshToken) {
      storeTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    } else {
      clearTokens();
      const error = createApiError("Invalid token refresh response.", 422);
      onLogoutCallback();
      return Promise.reject(error);
    }
  } catch (error) {
    console.error("Error during token refresh:", error);
    clearTokens();

    let errorMessage;
    let status = null;

    if (isNetworkError(error)) {
      errorMessage = "Network error during authentication. Please check your connection and try again.";
    } else if (isTimeoutError(error)) {
      errorMessage = "Authentication request timed out. Please try again.";
    } else if (error.isApiError) {
      // Re-throw API errors as-is
      onLogoutCallback();
      return Promise.reject(error);
    } else {
      errorMessage = "Authentication failed. Please login again.";
    }

    const apiError = createApiError(errorMessage, status, error);
    onLogoutCallback();
    return Promise.reject(apiError);
  }
};

const broadcastTreeUpdate = (method, url) => {
  // Broadcast tree updates to other tabs
  try {
    const methodLower = (method || 'get').toLowerCase();
    if (['post', 'put', 'delete', 'patch'].includes(methodLower) && url.match(/^\/items/)) {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('notes-sync');
        bc.postMessage({ type: 'TREE_UPDATED', timestamp: Date.now() });
        bc.close();
      } else {
        localStorage.setItem('notesTreeSync', String(Date.now()));
      }
    }
  } catch (e) {
    console.warn('Broadcast failed', e);
  }
};

export const authFetch = async (url, options = {}) => {
  let token = getAccessToken();

  const makeRequest = async (accessToken, retryCount = 0) => {
    const maxRetries = 2;

    try {
      const headers = {
        ...options.headers,
      };

      if (accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }

      // Do not set Content-Type if FormData is used (browser will set it with boundary)
      if (!(options.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }

      // Add timeout support
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const finalOptions = {
        credentials: 'include',
        ...options,
        headers,
        signal: controller.signal,
      };

      let finalPath;
      // Check if the URL you provided already has the /api prefix
      if (url.startsWith('/api')) {
        finalPath = url; // Use the path as-is
      } else {
        // If not, add the /api prefix
        const slash = url.startsWith('/') ? '' : '/';
        finalPath = `/api${slash}${url}`;
      }

      // Construct the final URL, handling absolute URLs correctly
      const finalUrl = url.startsWith('http') ? url : `${API_BASE_URL}${finalPath}`;

      console.log(`[apiClient] Requesting: ${finalOptions.method || 'GET'} ${finalUrl}`); // Added for debugging

      const response = await fetch(
        finalUrl,
        finalOptions
      );

      clearTimeout(timeoutId);

      // Broadcast tree updates after successful request
      if (response.ok) {
        broadcastTreeUpdate(finalOptions.method, url);
      }

      // Handle 401/403 authentication errors
      if (response.status === 401 || response.status === 403) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          errorData = { error: `Authentication error (${response.status})` };
        }

        // Check if this is a token expiration issue
        if (shouldTriggerLogout(response.status, errorData.error)) {
          if (!isRefreshing) {
            isRefreshing = true;
            try {
              const newAccessToken = await refreshTokenFlow();
              isRefreshing = false;
              onRefreshed(newAccessToken);
              // Retry original request with new token
              return makeRequest(newAccessToken, retryCount);
            } catch (refreshError) {
              isRefreshing = false;
              onRefreshFailed(refreshError);
              // onLogoutCallback() is called within refreshTokenFlow on failure
              throw refreshError;
            }
          } else {
            // Queue request until token is refreshed
            return new Promise((resolve, reject) => {
              addRefreshSubscriber((newAccessToken, refreshError) => {
                if (refreshError) {
                  reject(refreshError);
                } else if (newAccessToken) {
                  // Retry request with the new token
                  makeRequest(newAccessToken, retryCount).then(resolve).catch(reject);
                } else {
                  reject(createApiError("Token refresh failed", 401));
                }
              });
            });
          }
        }
      }

      // Handle other HTTP error statuses
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          errorData = { error: `Server error (${response.status})` };
        }

        let errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;

        // Provide more user-friendly error messages
        switch (response.status) {
          case 400:
            errorMessage = errorData.error || "Invalid request. Please check your input and try again.";
            break;
          case 404:
            errorMessage = "The requested resource was not found.";
            break;
          case 409:
            errorMessage = errorData.error || "A conflict occurred. The resource may already exist.";
            break;
          case 413:
            errorMessage = "File too large. Please choose a smaller file.";
            break;
          case 422:
            errorMessage = errorData.error || "Invalid data provided. Please check your input.";
            break;
          case 429:
            errorMessage = "Too many requests. Please wait a moment and try again.";
            break;
          case 500:
            errorMessage = "Server error. Please try again later.";
            break;
          case 502:
          case 503:
          case 504:
            errorMessage = "Service temporarily unavailable. Please try again later.";
            break;
          default:
            errorMessage = errorData.error || `An error occurred (${response.status})`;
        }

        throw createApiError(errorMessage, response.status);
      }

      return response;

    } catch (error) {
      // Handle network and timeout errors
      if (isNetworkError(error)) {
        if (retryCount < maxRetries) {
          console.warn(`Network error, retrying... (${retryCount + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1))); // Exponential backoff
          return makeRequest(accessToken, retryCount + 1);
        }
        throw createApiError(
          "Network error. Please check your internet connection and try again.",
          null,
          error
        );
      }

      if (isTimeoutError(error)) {
        if (retryCount < maxRetries) {
          console.warn(`Request timeout, retrying... (${retryCount + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1))); // Exponential backoff
          return makeRequest(accessToken, retryCount + 1);
        }
        throw createApiError(
          "Request timed out. Please try again.",
          null,
          error
        );
      }

      // Handle API errors (re-throw as-is)
      if (error.isApiError) {
        throw error;
      }

      // Handle other unexpected errors
      console.error("Unexpected error in authFetch:", error);
      throw createApiError(
        "An unexpected error occurred. Please try again.",
        null,
        error
      );
    }
  };

  return makeRequest(token);
};

// Utility function for handling API responses with error extraction
export const handleApiResponse = async (response) => {
  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch (parseError) {
      errorData = { error: `Server error (${response.status})` };
    }

    throw createApiError(
      errorData.error || errorData.message || `HTTP ${response.status}`,
      response.status
    );
  }

  try {
    return await response.json();
  } catch (parseError) {
    // Handle responses that don't contain JSON
    return { success: true };
  }
};

// Enhanced error checking utilities for components
export const isApiError = (error) => {
  return error && error.isApiError === true;
};

export const getErrorMessage = (error) => {
  if (isApiError(error)) {
    return error.message;
  }

  if (isNetworkError(error)) {
    return "Network error. Please check your internet connection.";
  }

  if (isTimeoutError(error)) {
    return "Request timed out. Please try again.";
  }

  return error?.message || "An unexpected error occurred.";
};

export const shouldShowError = (error) => {
  // Don't show error UI for authentication errors (they trigger logout)
  return !shouldTriggerLogout(error?.status, error?.message);
};