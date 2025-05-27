// tests/services/apiClient.test.js
import { authFetch, initApiClient } from '../../src/services/apiClient';
import * as authService from '../../src/services/authService';

jest.mock('../../src/services/authService');

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";
const mockLogoutHandler = jest.fn();

describe('apiClient', () => {
    beforeEach(() => {
        fetch.resetMocks();
        authService.getAccessToken.mockReset();
        authService.getRefreshToken.mockReset();
        authService.storeTokens.mockReset();
        authService.clearTokens.mockReset();
        mockLogoutHandler.mockReset();
        initApiClient(mockLogoutHandler); // Initialize with a fresh mock handler
    });

    test('authFetch makes a successful request with Authorization header', async () => {
        authService.getAccessToken.mockReturnValue('test-access-token');
        fetch.mockResponseOnce(JSON.stringify({ data: 'success' }));

        const response = await authFetch('/test-endpoint');
        const data = await response.json();

        expect(fetch).toHaveBeenCalledWith(
            `${API_BASE_URL}/test-endpoint`,
            expect.objectContaining({
                headers: expect.objectContaining({
                    'Authorization': 'Bearer test-access-token',
                    'Content-Type': 'application/json',
                }),
            })
        );
        expect(data).toEqual({ data: 'success' });
    });

    test('authFetch handles 401, successfully refreshes token, and retries request', async () => {
        authService.getAccessToken
            .mockReturnValueOnce('expired-access-token') // First call
            .mockReturnValueOnce('new-access-token');    // Second call (after refresh)
        authService.getRefreshToken.mockReturnValue('test-refresh-token');

        // First call to /test-endpoint (will 401)
        fetch.mockResponseOnce(JSON.stringify({ error: 'Token expired' }), { status: 401 });
        // Call to /auth/refresh-token
        fetch.mockResponseOnce(JSON.stringify({
            accessToken: 'new-access-token',
            refreshToken: 'new-refresh-token'
        }));
        // Second call to /test-endpoint (retry with new token)
        fetch.mockResponseOnce(JSON.stringify({ data: 'success after refresh' }));

        const response = await authFetch('/test-endpoint');
        const data = await response.json();

        expect(authService.getAccessToken).toHaveBeenCalledTimes(2);
        expect(authService.getRefreshToken).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledTimes(3);
        expect(fetch.mock.calls[0][0]).toBe(`${API_BASE_URL}/test-endpoint`);
        expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer expired-access-token');

        expect(fetch.mock.calls[1][0]).toBe(`${API_BASE_URL}/auth/refresh-token`);
        expect(JSON.parse(fetch.mock.calls[1][1].body)).toEqual({ token: 'test-refresh-token' });

        expect(authService.storeTokens).toHaveBeenCalledWith('new-access-token', 'new-refresh-token');

        expect(fetch.mock.calls[2][0]).toBe(`${API_BASE_URL}/test-endpoint`);
        expect(fetch.mock.calls[2][1].headers.Authorization).toBe('Bearer new-access-token');

        expect(data).toEqual({ data: 'success after refresh' });
        expect(mockLogoutHandler).not.toHaveBeenCalled();
    });

    test('authFetch handles 401, refresh token fails, and calls logout handler', async () => {
        authService.getAccessToken.mockReturnValue('expired-access-token');
        authService.getRefreshToken.mockReturnValue('invalid-refresh-token');

        // First call to /test-endpoint (will 401)
        fetch.mockResponseOnce(JSON.stringify({ error: 'Token expired' }), { status: 401 });
        // Call to /auth/refresh-token (will fail)
        fetch.mockResponseOnce(JSON.stringify({ error: 'Invalid refresh token' }), { status: 403 });

        try {
            await authFetch('/test-endpoint');
        } catch (error) {
            expect(error.message).toBe('Invalid refresh token');
        }

        expect(authService.getAccessToken).toHaveBeenCalledTimes(1);
        expect(authService.getRefreshToken).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledTimes(2); // Original + refresh attempt
        expect(fetch.mock.calls[1][0]).toBe(`${API_BASE_URL}/auth/refresh-token`);
        expect(authService.clearTokens).toHaveBeenCalled();
        expect(mockLogoutHandler).toHaveBeenCalledTimes(1);
    });

    test('authFetch does not add Content-Type for FormData', async () => {
        authService.getAccessToken.mockReturnValue('test-access-token');
        fetch.mockResponseOnce(JSON.stringify({ data: 'success' }));
        const formData = new FormData();
        formData.append('key', 'value');

        await authFetch('/upload-endpoint', { method: 'POST', body: formData });

        expect(fetch).toHaveBeenCalledWith(
            `${API_BASE_URL}/upload-endpoint`,
            expect.objectContaining({
                method: 'POST',
                body: formData,
                headers: expect.not.objectContaining({
                    'Content-Type': 'application/json', // Should not be set by authFetch for FormData
                }),
            })
        );
        // Browser sets Content-Type for FormData automatically, check it's not explicitly application/json
        const fetchOptions = fetch.mock.calls[0][1];
        expect(fetchOptions.headers['Content-Type']).toBeUndefined();
    });

    test('authFetch proceeds without Authorization header if no access token', async () => {
        authService.getAccessToken.mockReturnValue(null);
        fetch.mockResponseOnce(JSON.stringify({ data: 'public data' }));

        const response = await authFetch('/public-endpoint');
        const data = await response.json();

        expect(fetch).toHaveBeenCalledWith(
            `${API_BASE_URL}/public-endpoint`,
            expect.objectContaining({
                headers: expect.not.objectContaining({
                    'Authorization': expect.any(String),
                }),
            })
        );
        expect(data).toEqual({ data: 'public data' });
    });

    test('authFetch calls onLogoutCallback if no refresh token during refresh flow', async () => {
        authService.getAccessToken.mockReturnValue('expired-access-token');
        authService.getRefreshToken.mockReturnValue(null); // No refresh token available

        fetch.mockResponseOnce(JSON.stringify({ error: 'Token expired' }), { status: 401 });

        try {
            await authFetch('/needs-refresh');
        } catch (e) {
            expect(e.message).toBe('No refresh token available.');
        }

        expect(mockLogoutHandler).toHaveBeenCalledTimes(1);
        expect(fetch).toHaveBeenCalledTimes(1); // Only the initial failing call
    });
});