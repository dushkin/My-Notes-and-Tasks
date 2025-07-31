import { getAccessToken, getRefreshToken, storeTokens, clearTokens } from "./authService";
import { Capacitor } from '@capacitor/core';

// The base URL must NOT include /api. This client will add it.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://my-notes-and-tasks-backend.onrender.com";

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

const refreshTokenFlow = async () => {
  const currentRefreshToken = getRefreshToken();
  if (!currentRefreshToken) {
    const error = createApiError("No refresh token available. Please login again.", 401);
    onLogoutCallback();
    return Promise.reject(error);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
      credentials: 'include',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: currentRefreshToken }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorData;
      try { errorData = await response.json(); }
      catch (parseError) { errorData = { error: `Server error (${response.status})` }; }
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
              onRefreshed(newAccessToken);
              return makeRequest(newAccessToken, retryCount);
            } catch (refreshError) {
              isRefreshing = false;
              onRefreshFailed(refreshError);
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
        const errorMessage = errorData.error || errorData.message || `HTTP ${response.status}`;
        throw createApiError(errorMessage, response.status);
      }

      return response;
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