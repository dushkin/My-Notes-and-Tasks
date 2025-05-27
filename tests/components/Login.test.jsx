// tests/components/Login.test.jsx
import React from "react";
import {
  render,
  screen,
  waitFor,
  cleanup,
  fireEvent,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import Login from "../../src/components/Login";
import * as authService from "../../src/services/authService"; // To spy on storeTokens

const mockOnLoginSuccess = jest.fn();
const mockOnSwitchToRegister = jest.fn();

// Mock the authService
jest.mock("../../src/services/authService", () => ({
  ...jest.requireActual("../../src/services/authService"), // Import and retain default behavior
  storeTokens: jest.fn(), // Mock storeTokens
}));

global.fetch = jest.fn();

const API_BASE_URL =
  global.importMeta?.env?.VITE_API_BASE_URL || "http://localhost:5001/api";
const LOGIN_ENDPOINT = `${API_BASE_URL}/auth/login`;

afterEach(() => {
  cleanup();
  fetch.mockClear();
  mockOnLoginSuccess.mockClear();
  mockOnSwitchToRegister.mockClear();
  authService.storeTokens.mockClear(); // Clear mock calls
  localStorage.clear(); // Clear local storage if Login component writes to it directly
});

describe("<Login />", () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup();
    // Reset fetch mock for each test to avoid interference
    fetch.mockImplementation(async (url, options) => {
      if (url.toString() === LOGIN_ENDPOINT) {
        if (options && options.method === "POST" && options.body) {
          try {
            const body = JSON.parse(options.body);
            if (
              body.email === "test@example.com" &&
              body.password === "password123"
            ) {
              return Promise.resolve({
                ok: true,
                json: async () => ({
                  accessToken: "fake-access-token", // Changed from token
                  refreshToken: "fake-refresh-token", // Added refreshToken
                  user: { _id: "123", email: "test@example.com" }, // Ensure user object has _id
                }),
              });
            } else if (
              body.email === "test@example.com" &&
              body.password === "wrongpassword"
            ) {
              return Promise.resolve({
                ok: false,
                status: 401,
                json: async () => ({ error: "Invalid credentials" }),
              });
            }
          } catch (e) {
            // Fall through
          }
        }
      }
      return Promise.resolve({
        ok: false,
        status: 500,
        json: async () => ({
          error: "Mocked fetch: Generic error or unhandled login path",
        }),
      });
    });
  });

  test("shows error message if fields are empty on submit", async () => {
    render(
      <Login
        onLoginSuccess={mockOnLoginSuccess}
        onSwitchToRegister={mockOnSwitchToRegister}
      />
    );
    const formElement = screen.getByTestId("login-form");
    fireEvent.submit(formElement);

    await waitFor(
      () => {
        const errorMessageElement = screen.getByTestId("login-error-message");
        expect(errorMessageElement).toBeInTheDocument();
        expect(errorMessageElement).toHaveTextContent(
          /Please enter both email and password/i
        );
      },
      { timeout: 3000 }
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  test("renders login form correctly", () => {
    render(
      <Login
        onLoginSuccess={mockOnLoginSuccess}
        onSwitchToRegister={mockOnSwitchToRegister}
      />
    );
    expect(
      screen.getByRole("heading", { name: /Login to Notes & Tasks/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Password/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Login/i })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Create one/i })
    ).toBeInTheDocument();
  });

  test("allows input for email and password", async () => {
    render(
      <Login
        onLoginSuccess={mockOnLoginSuccess}
        onSwitchToRegister={mockOnSwitchToRegister}
      />
    );
    const emailInput = screen.getByLabelText(/Email Address/i);
    await user.type(emailInput, "test@example.com");
    expect(emailInput).toHaveValue("test@example.com");

    const passwordInput = screen.getByLabelText(/Password/i);
    await user.type(passwordInput, "password123");
    expect(passwordInput).toHaveValue("password123");
  });

  test("calls onLoginSuccess with user data and stores tokens on successful login", async () => {
    const mockUserData = { _id: "123", email: "test@example.com" }; // Ensure _id is present

    render(
      <Login
        onLoginSuccess={mockOnLoginSuccess}
        onSwitchToRegister={mockOnSwitchToRegister}
      />
    );
    await user.type(
      screen.getByLabelText(/Email Address/i),
      "test@example.com"
    );
    await user.type(screen.getByLabelText(/Password/i), "password123");
    await user.click(screen.getByRole("button", { name: /Login/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        LOGIN_ENDPOINT,
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@example.com",
            password: "password123",
          }),
        })
      );
    });
    await waitFor(() => {
      expect(mockOnLoginSuccess).toHaveBeenCalledWith(mockUserData);
    });
    // Check if authService.storeTokens was called correctly
    expect(authService.storeTokens).toHaveBeenCalledWith(
      "fake-access-token",
      "fake-refresh-token"
    );
  });

  test("shows error message on failed login (invalid credentials)", async () => {
    render(
      <Login
        onLoginSuccess={mockOnLoginSuccess}
        onSwitchToRegister={mockOnSwitchToRegister}
      />
    );
    await user.type(
      screen.getByLabelText(/Email Address/i),
      "test@example.com"
    );
    await user.type(screen.getByLabelText(/Password/i), "wrongpassword");
    await user.click(screen.getByRole("button", { name: /Login/i }));

    const errorMessageElement = await screen.findByTestId(
      "login-error-message",
      {},
      { timeout: 3000 }
    );
    expect(errorMessageElement).toHaveTextContent(/Invalid credentials/i);
    expect(authService.storeTokens).not.toHaveBeenCalled();
  });

  test("shows error message on network error", async () => {
    fetch.mockRejectedValueOnce(new Error("Network error"));

    render(
      <Login
        onLoginSuccess={mockOnLoginSuccess}
        onSwitchToRegister={mockOnSwitchToRegister}
      />
    );
    await user.type(
      screen.getByLabelText(/Email Address/i),
      "network@example.com"
    );
    await user.type(screen.getByLabelText(/Password/i), "anypassword");
    await user.click(screen.getByRole("button", { name: /Login/i }));

    const errorMessageElement = await screen.findByTestId(
      "login-error-message",
      {},
      { timeout: 3000 }
    );
    expect(errorMessageElement).toHaveTextContent(
      /Network error or server issue/i
    );
    expect(authService.storeTokens).not.toHaveBeenCalled();
  });

  test('calls onSwitchToRegister when "Create one" button is clicked', async () => {
    render(
      <Login
        onLoginSuccess={mockOnLoginSuccess}
        onSwitchToRegister={mockOnSwitchToRegister}
      />
    );
    const createAccountButton = screen.getByRole("button", {
      name: /Create one/i,
    });
    await user.click(createAccountButton);
    expect(mockOnSwitchToRegister).toHaveBeenCalledTimes(1);
  });
});
