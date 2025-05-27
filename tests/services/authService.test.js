// tests/services/authService.test.js
import {
  storeTokens,
  getAccessToken,
  getRefreshToken,
  clearTokens,
  isLoggedIn,
} from '../../src/services/authService';

// Mock localStorage
const localStorageMock = (() => {
  let store = {};
  return {
    getItem: jest.fn(key => store[key] || null),
    setItem: jest.fn((key, value) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn(key => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
    hasOwnProperty: jest.fn(key => Object.prototype.hasOwnProperty.call(store, key)),
    length: Object.keys(store).length, // Dynamically get length
    key: jest.fn(index => Object.keys(store)[index] || null),
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true // Allow it to be modified if other tests also try to mock it
});


describe('authService', () => {
  const ACCESS_TOKEN_KEY = "accessToken";
  const REFRESH_TOKEN_KEY = "refreshToken";
  const mockAccessToken = "mock-access-token-123";
  const mockRefreshToken = "mock-refresh-token-456";

  beforeEach(() => {
    // Clear the mock store and mock function call history before each test
    localStorageMock.clear(); // This will call the jest.fn() clear for the mock store
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.removeItem.mockClear();
  });

  describe('storeTokens', () => {
    it('should store both access and refresh tokens in localStorage', () => {
      storeTokens(mockAccessToken, mockRefreshToken);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(ACCESS_TOKEN_KEY, mockAccessToken);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(REFRESH_TOKEN_KEY, mockRefreshToken);
      // To verify they are stored, you could also check getItem calls if storeTokens directly calls them
      // Or, more directly, check the mock's internal store if you expose it or test getItem separately
    });

    it('should store only access token if refresh token is null', () => {
      storeTokens(mockAccessToken, null);
      expect(localStorageMock.setItem).toHaveBeenCalledWith(ACCESS_TOKEN_KEY, mockAccessToken);
      expect(localStorageMock.setItem).not.toHaveBeenCalledWith(REFRESH_TOKEN_KEY, expect.anything());
    });

    it('should store only refresh token if access token is null', () => {
      storeTokens(null, mockRefreshToken);
      expect(localStorageMock.setItem).not.toHaveBeenCalledWith(ACCESS_TOKEN_KEY, expect.anything());
      expect(localStorageMock.setItem).toHaveBeenCalledWith(REFRESH_TOKEN_KEY, mockRefreshToken);
    });
  });

  describe('getAccessToken', () => {
    it('should retrieve the access token from localStorage', () => {
      // Simulate item being in the mock store for getItem to retrieve
      localStorageMock.setItem(ACCESS_TOKEN_KEY, mockAccessToken); // Use the mock's setItem to populate its store
      localStorageMock.setItem.mockClear(); // Clear setItem calls from this setup

      const token = getAccessToken();
      expect(token).toBe(mockAccessToken);
      expect(localStorageMock.getItem).toHaveBeenCalledWith(ACCESS_TOKEN_KEY);
    });

    it('should return null if access token is not found', () => {
      const token = getAccessToken();
      expect(token).toBeNull();
      expect(localStorageMock.getItem).toHaveBeenCalledWith(ACCESS_TOKEN_KEY);
    });
  });

  describe('getRefreshToken', () => {
    it('should retrieve the refresh token from localStorage', () => {
      localStorageMock.setItem(REFRESH_TOKEN_KEY, mockRefreshToken);
      localStorageMock.setItem.mockClear();

      const token = getRefreshToken();
      expect(token).toBe(mockRefreshToken);
      expect(localStorageMock.getItem).toHaveBeenCalledWith(REFRESH_TOKEN_KEY);
    });

    it('should return null if refresh token is not found', () => {
      const token = getRefreshToken();
      expect(token).toBeNull();
      expect(localStorageMock.getItem).toHaveBeenCalledWith(REFRESH_TOKEN_KEY);
    });
  });

  describe('clearTokens', () => {
    it('should remove both access and refresh tokens from localStorage', () => {
      localStorageMock.setItem(ACCESS_TOKEN_KEY, mockAccessToken);
      localStorageMock.setItem(REFRESH_TOKEN_KEY, mockRefreshToken);
      localStorageMock.setItem.mockClear(); // Clear calls from setup

      clearTokens();
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(ACCESS_TOKEN_KEY);
      expect(localStorageMock.removeItem).toHaveBeenCalledWith(REFRESH_TOKEN_KEY);
    });
  });

  describe('isLoggedIn', () => {
    it('should return true if an access token exists', () => {
      localStorageMock.setItem(ACCESS_TOKEN_KEY, mockAccessToken);
      localStorageMock.setItem.mockClear();

      expect(isLoggedIn()).toBe(true);
      expect(localStorageMock.getItem).toHaveBeenCalledWith(ACCESS_TOKEN_KEY);
    });

    it('should return false if no access token exists', () => {
      expect(isLoggedIn()).toBe(false);
      expect(localStorageMock.getItem).toHaveBeenCalledWith(ACCESS_TOKEN_KEY);
    });
  });
});