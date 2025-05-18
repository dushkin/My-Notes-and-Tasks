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

const mockOnLoginSuccess = jest.fn();
const mockOnSwitchToRegister = jest.fn();

global.fetch = jest.fn(async (url, options) => {
  // console.log('[TEST DEBUG Test Fetch Mock] CALLED WITH URL:', url);
  // console.log('[TEST DEBUG Test Fetch Mock] CALLED WITH OPTIONS:', JSON.stringify(options, null, 2));
  if (url.toString().includes("auth/login")) {
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
              token: "fake-jwt-token",
              user: { id: "123", email: "test@example.com" },
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
        /* Fall through */
      }
    }
  }
  if (
    url.toString().includes("auth/login") &&
    options &&
    options.method === "POST"
  ) {
    // Fallback for POST to login if not matched above, e.g. network error simulation if mockRejectedValueOnce isn't used
    return Promise.reject(
      new Error(
        "Simulated network error by default for unhandled POST to login"
      )
    );
  }
  return Promise.resolve({
    ok: false,
    status: 404,
    json: async () => ({ error: "Mocked fetch: Unhandled URL or method" }),
  });
});

const originalEnv = { ...process.env };
const EXPECTED_API_BASE_URL =
  process.env.VITE_API_BASE_URL || "http://localhost:5001/api/test";
const EXPECTED_API_LOGIN_ENDPOINT = `${EXPECTED_API_BASE_URL}/auth/login`;

afterAll(() => {
  process.env = originalEnv;
});

afterEach(() => {
  cleanup();
  fetch.mockClear();
  mockOnLoginSuccess.mockClear();
  mockOnSwitchToRegister.mockClear();
  localStorage.clear();
});

describe("<Login />", () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup();
  });

  test("shows error message if fields are empty on submit", async () => {
    render(
      <Login
        onLoginSuccess={mockOnLoginSuccess}
        onSwitchToRegister={mockOnSwitchToRegister}
      />
    );

    // Assuming your test environment is looking for "data-item-id"
    const formElement = screen.getByTestId("login-form");
    fireEvent.submit(formElement);

    // ***** UNCOMMENT THE LINE BELOW TO SEE THE DOM AFTER SUBMIT *****
    // console.log("DEBUG FROM TEST (empty submit): DOM state immediately after fireEvent.submit and before waitFor:");
    // screen.debug(undefined, 300000);
    // ***** *****

    await waitFor(
      () => {
        // This will look for data-item-id="login-error-message"
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

  test("calls onLoginSuccess with user data on successful login", async () => {
    const mockUserData = { id: "123", email: "test@example.com" };
    fetch.mockResolvedValueOnce({
      // Specific mock for this case
      ok: true,
      json: async () => ({ token: "fake-jwt-token", user: mockUserData }),
    });

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
        EXPECTED_API_LOGIN_ENDPOINT,
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
    expect(localStorage.getItem("userToken")).toBe("fake-jwt-token");
  });

  test("shows error message on failed login (invalid credentials)", async () => {
    fetch.mockResolvedValueOnce({
      // Specific mock for this case
      ok: false,
      status: 401,
      json: async () => ({ error: "Invalid credentials" }),
    });
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
  });

  test("shows error message on network error", async () => {
    fetch.mockRejectedValueOnce(new Error("Network error")); // Specific mock for this case
    render(
      <Login
        onLoginSuccess={mockOnLoginSuccess}
        onSwitchToRegister={mockOnSwitchToRegister}
      />
    );
    await user.type(
      screen.getByLabelText(/Email Address/i),
      "networktest@example.com"
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
