// ============================================================================
// IMPORTS
// ============================================================================
import { getAccessToken, getRefreshToken, storeTokens, clearTokens } from "./authService";
import { Capacitor } from '@capacitor/core';

// ============================================================================
// CONFIGURATION
// ============================================================================
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://my-notes-and-tasks-backend.onrender.com";

// Request configuration constants
const REQUEST_CONFIG = {
  DEFAULT_TIMEOUT: 30000,
  REFRESH_TIMEOUT: 10000,
  MAX_RETRIES: 2,
  RETRY_DELAY_BASE: 1000,
  RETRY_DELAY_MULTIPLIER: 2
};

// Public endpoints that don't require authentication
const PUBLIC_ENDPOINTS = ['/auth/beta-status', '/push/vapid-public-key'];

// ============================================================================
// STATE MANAGEMENT
// ============================================================================
let onLogoutCallback = () => {
  console.warn("onLogoutCallback not initialized in apiClient. Call initApiClient() in App.jsx.");
  window.location.href = '/login'; // Fallback
};

let isRefreshing = false;
let refreshSubscribers = [];

// ============================================================================
// TOKEN REFRESH SUBSCRIBER MANAGEMENT
// ============================================================================
const addRefreshSubscriber = (callback) => {
  refreshSubscribers.push(callback);
};

const notifyRefreshSubscribers = (newAccessToken, error = null) => {
  refreshSubscribers.forEach(callback => callback(newAccessToken, error));
  refreshSubscribers = [];
};

// ============================================================================
// INITIALIZATION
// ============================================================================
export const initApiClient = (logoutHandler) => {
  if (typeof logoutHandler === 'function') {
    onLogoutCallback = logoutHandler;
  }
};

// ============================================================================
// ERROR HANDLING UTILITIES
// ============================================================================
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
  const authErrorPatterns = [
    'token', 'expired', 'not authorized', 'unauthorized',
    'invalid token', 'authentication failed', 'access denied', 'forbidden'
  ];
  return status === 401 || status === 403 ||
    authErrorPatterns.some(pattern => errorMessage.toLowerCase().includes(pattern));
};

const isPublicEndpoint = (url) => {
  return PUBLIC_ENDPOINTS.some(path => url.includes(path));
};

// ============================================================================
// TOKEN REFRESH FLOW
// ============================================================================
const refreshTokenFlow = async () => {
  const currentRefreshToken = getRefreshToken();
  if (!currentRefreshToken) {
    const error = createApiError("No refresh token available. Please login again.", 401);
    onLogoutCallback();
    return Promise.reject(error);
  }

  try {
    const response = await performRefreshRequest(currentRefreshToken);
    const data = await handleRefreshResponse(response);
    
    if (data.accessToken && data.refreshToken) {
      storeTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    } else {
      throw createApiError("Invalid token refresh response.", 422);
    }
  } catch (error) {
    console.error("Error during token refresh:", error);
    clearTokens();
    
    if (error.isApiError) {
      onLogoutCallback();
      return Promise.reject(error);
    }
    
    const apiError = createRefreshError(error);
    onLogoutCallback();
    return Promise.reject(apiError);
  }
};

/**
 * Perform the actual refresh token request
 */
const performRefreshRequest = async (refreshToken) => {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_CONFIG.REFRESH_TIMEOUT);

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: refreshToken }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

/**
 * Handle refresh token response
 */
const handleRefreshResponse = async (response) => {
  if (!response.ok) {
    let errorData;
    try { 
      errorData = await response.json(); 
    } catch (parseError) { 
      errorData = { error: `Server error (${response.status})` }; 
    }
    
    console.error("Refresh token failed:", response.status, errorData);
    const errorMessage = errorData.error || "Session expired. Please login again.";
    throw createApiError(errorMessage, response.status);
  }

  return await response.json();
};

/**
 * Create error for token refresh failures
 */
const createRefreshError = (error) => {
  let errorMessage;
  let status = null;
  
  if (isNetworkError(error)) {
    errorMessage = "Network error during authentication. Please check your connection and try again.";
  } else if (isTimeoutError(error)) {
    errorMessage = "Authentication request timed out. Please try again.";
  } else {
    errorMessage = "Authentication failed. Please login again.";
  }
  
  return createApiError(errorMessage, status, error);
};

const broadcastTreeUpdate = (method, url) => {
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
  // Define explicitly public endpoints that should never use Authorization
  const publicPaths = ['/auth/beta-status', '/push/vapid-public-key'];
  const isPublicEndpoint = publicPaths.some(path => url.includes(path));
  
  let token = null;
  if (!isPublicEndpoint) {
    token = getAccessToken();
  }

  console.log("[authFetch] Access token:", token ? `${token.substring(0, 10)}...` : 'null (public endpoint)');

  const makeRequest = async (accessToken, retryCount = 0) => {
    const maxRetries = 2;

    try {
      const headers = { ...options.headers };
      
      // Only add Authorization header if we have a token and it's not a public endpoint
      if (accessToken && !isPublicEndpoint) {
        headers['Authorization'] = `Bearer ${accessToken}`;
      }
      
      if (!(options.body instanceof FormData) && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const finalOptions = {
        credentials: isPublicEndpoint ? 'omit' : 'include',
        ...options,
        headers,
        signal: controller.signal,
      };

      // For Android, remove some problematic options
      if (Capacitor.getPlatform() === 'android') {
        delete finalOptions.credentials;
        delete finalOptions.signal; // Some Android WebViews don't support AbortController
      }

      if (finalOptions.body && typeof finalOptions.body === 'object' && !(finalOptions.body instanceof FormData)) {
        finalOptions.body = JSON.stringify(finalOptions.body);
      }

      const endpoint = url.startsWith('/') ? url : `/${url}`;
      const finalUrl = `${API_BASE_URL}/api${endpoint}`;

      console.log("[authFetch] Final request details:", {
        method: finalOptions.method || 'GET',
        url: finalUrl,
        headers: finalOptions.headers,
        isPublicEndpoint
      });

      const response = await fetch(finalUrl, finalOptions);

      if (Capacitor.getPlatform() !== 'android') {
        clearTimeout(timeoutId);
      }

      if (response.ok) {
        broadcastTreeUpdate(finalOptions.method, url);
      }

      // Only handle auth errors for non-public endpoints
      if (!isPublicEndpoint && (response.status === 401 || response.status === 403)) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `Authentication error (${response.status})` };
        }

        if (shouldTriggerLogout(response.status, errorData.error)) {
          if (!isRefreshing) {
            isRefreshing = true;
            try {
              const newAccessToken = await refreshTokenFlow();
              isRefreshing = false;
              notifyRefreshSubscribers(newAccessToken);
              return makeRequest(newAccessToken, retryCount);
            } catch (refreshError) {
              isRefreshing = false;
              notifyRefreshSubscribers(null, refreshError);
              throw refreshError;
            }
          } else {
            return new Promise((resolve, reject) => {
              addRefreshSubscriber((newAccessToken, refreshError) => {
                if (refreshError) reject(refreshError);
                else if (newAccessToken) makeRequest(newAccessToken, retryCount).then(resolve).catch(reject);
                else reject(createApiError("Token refresh failed", 401));
              });
            });
          }
        }
      }

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch {
          errorData = { error: `Server error (${response.status})` };
        }
        
        // Handle version conflicts specially
        if (response.status === 409 && errorData.conflict) {
          const conflictError = createApiError(
            errorData.error || 'Version conflict detected', 
            response.status
          );
          conflictError.conflict = errorData.conflict;
          throw conflictError;
        }
        
        const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
        throw createApiError(errorMessage, response.status);
      }

      return await response.json();
    } catch (error) {
      if (isNetworkError(error)) {
        if (retryCount < maxRetries) {
          console.warn(`Network error, retrying... (${retryCount + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, 1000 * (retryCount + 1)));
          return makeRequest(accessToken, retryCount + 1);
        }
        throw createApiError("Network error. Please check your internet connection and try again.", null, error);
      }
      if (isTimeoutError(error)) {
        if (retryCount < maxRetries) {
          console.warn(`Request timeout, retrying... (${retryCount + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, 2000 * (retryCount + 1)));
          return makeRequest(accessToken, retryCount + 1);
        }
        throw createApiError("Request timed out. Please try again.", null, error);
      }
      if (error.isApiError) throw error;

      console.error("Unexpected error in authFetch:", error);
      throw createApiError("An unexpected error occurred. Please try again.", null, error);
    }
  };

  return makeRequest(token);
};