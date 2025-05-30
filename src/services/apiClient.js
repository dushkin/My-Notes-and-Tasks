// src/services/apiClient.js
import { getAccessToken, getRefreshToken, storeTokens, clearTokens } from './authService';

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

export const initApiClient = (logoutHandler) => {
  if (typeof logoutHandler === 'function') {
    onLogoutCallback = logoutHandler;
  }
};

const refreshTokenFlow = async () => {
  const currentRefreshToken = getRefreshToken();
  if (!currentRefreshToken) {
    onLogoutCallback();
    return Promise.reject(new Error("No refresh token available."));
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: currentRefreshToken }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Refresh token failed:", response.status, errorData);
      clearTokens();
      onLogoutCallback();
      return Promise.reject(new Error(errorData.error || "Session expired. Please login again."));
    }

    const data = await response.json();
    if (data.accessToken && data.refreshToken) {
      storeTokens(data.accessToken, data.refreshToken);
      return data.accessToken;
    } else {
      clearTokens();
      onLogoutCallback();
      return Promise.reject(new Error("Invalid token refresh response."));
    }
  } catch (error) {
    console.error("Error during token refresh:", error);
    clearTokens();
    onLogoutCallback();
    return Promise.reject(error);
  }
};

export const authFetch = async (url, options = {}) => {
  let token = getAccessToken();

  const makeRequest = async (accessToken) => {
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

    const response = await fetch(url.startsWith('http') ? url : `${API_BASE_URL}${url}`, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      const errorData = await response.json().catch(() => ({}));
      
      // Check if this is a token expiration issue
      if (errorData.error && (
        errorData.error.includes('token') || 
        errorData.error.includes('expired') || 
        errorData.error.includes('Not authorized')
      )) {
        if (!isRefreshing) {
          isRefreshing = true;
          try {
            const newAccessToken = await refreshTokenFlow();
            isRefreshing = false;
            onRefreshed(newAccessToken);
            // Retry original request with new token
            return makeRequest(newAccessToken);
          } catch (refreshError) {
            isRefreshing = false;
            // onLogoutCallback() is called within refreshTokenFlow on failure
            return Promise.reject(refreshError);
          }
        } else {
          // Queue request until token is refreshed
          return new Promise((resolve, reject) => {
            addRefreshSubscriber((newAccessToken) => {
              // Retry request with the new token
              makeRequest(newAccessToken).then(resolve).catch(reject);
            });
          });
        }
      }
    }
    
    return response;
  };

  return makeRequest(token);
};