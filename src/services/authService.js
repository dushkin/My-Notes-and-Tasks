// src/services/authService.js
import storageManager from '../utils/storageManager.js';

const ACCESS_TOKEN_KEY = "accessToken";
const REFRESH_TOKEN_KEY = "refreshToken";

// Cache for immediate synchronous access
let tokenCache = {
  accessToken: null,
  refreshToken: null,
  loaded: false
};

/**
 * Initialize auth service and load tokens from storage
 */
export const initAuthService = async () => {
  try {
    await storageManager.init();
    
    // Load tokens from storage into cache
    const accessToken = await storageManager.get('auth', ACCESS_TOKEN_KEY);
    const refreshToken = await storageManager.get('auth', REFRESH_TOKEN_KEY);
    
    tokenCache = {
      accessToken,
      refreshToken,
      loaded: true
    };
    
    console.log('✅ AuthService initialized with IndexedDB storage');
    return true;
  } catch (error) {
    console.error('❌ AuthService initialization failed:', error);
    
    // Fallback to localStorage
    tokenCache = {
      accessToken: localStorage.getItem(ACCESS_TOKEN_KEY),
      refreshToken: localStorage.getItem(REFRESH_TOKEN_KEY),
      loaded: true
    };
    
    console.warn('📦 AuthService falling back to localStorage');
    return false;
  }
};

export const storeTokens = async (accessToken, refreshToken) => {
  try {
    // Ensure auth service is initialized
    if (!tokenCache.loaded) {
      await initAuthService();
    }
    
    // Update cache immediately for synchronous access
    if (accessToken) {
      tokenCache.accessToken = accessToken;
    }
    if (refreshToken) {
      tokenCache.refreshToken = refreshToken;
    }
    
    // Store in IndexedDB/localStorage
    const promises = [];
    if (accessToken) {
      promises.push(storageManager.set('auth', ACCESS_TOKEN_KEY, accessToken));
    }
    if (refreshToken) {
      promises.push(storageManager.set('auth', REFRESH_TOKEN_KEY, refreshToken));
    }
    
    await Promise.all(promises);
    console.log('✅ Tokens stored successfully');
  } catch (e) {
    console.error('Failed to save tokens:', e);
    
    // Fallback to localStorage
    try {
      if (accessToken) {
        localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
      }
      if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
      }
      console.warn('📦 Fell back to localStorage for token storage');
    } catch (fallbackError) {
      console.error('Even localStorage fallback failed:', fallbackError);
      throw fallbackError;
    }
  }
};

export const getAccessToken = () => {
  // Return from cache for synchronous access
  if (tokenCache.loaded) {
    return tokenCache.accessToken;
  }
  
  // Fallback to localStorage if cache not loaded
  return localStorage.getItem(ACCESS_TOKEN_KEY);
};

export const getRefreshToken = () => {
  // Return from cache for synchronous access
  if (tokenCache.loaded) {
    return tokenCache.refreshToken;
  }
  
  // Fallback to localStorage if cache not loaded
  return localStorage.getItem(REFRESH_TOKEN_KEY);
};

export const clearTokens = async () => {
  try {
    // Clear cache immediately
    tokenCache = {
      accessToken: null,
      refreshToken: null,
      loaded: true
    };
    
    // Clear from storage
    await Promise.all([
      storageManager.remove('auth', ACCESS_TOKEN_KEY),
      storageManager.remove('auth', REFRESH_TOKEN_KEY)
    ]);
    
    console.log('✅ Tokens cleared successfully');
  } catch (error) {
    console.error('Failed to clear tokens:', error);
    
    // Fallback to localStorage
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    console.warn('📦 Fell back to localStorage for token clearing');
  }
};

export const isLoggedIn = () => {
  return !!getAccessToken();
};

/**
 * Get detailed authentication status
 */
export const getAuthStatus = async () => {
  if (!tokenCache.loaded) {
    await initAuthService();
  }
  
  return {
    isLoggedIn: isLoggedIn(),
    hasAccessToken: !!tokenCache.accessToken,
    hasRefreshToken: !!tokenCache.refreshToken,
    usingIndexedDB: await storageManager.isUsingIndexedDB(),
    cacheLoaded: tokenCache.loaded
  };
};

/**
 * Refresh tokens from storage (useful after external changes)
 */
export const refreshTokensFromStorage = async () => {
  await initAuthService();
  return {
    accessToken: tokenCache.accessToken,
    refreshToken: tokenCache.refreshToken
  };
};

// Auto-initialize on import
if (typeof window !== 'undefined') {
  initAuthService().catch(error => {
    console.warn('AuthService auto-initialization failed:', error);
  });
}
