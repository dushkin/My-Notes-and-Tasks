// tests/components/Register.test.jsx
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
import Register from "../../src/components/Register";

const mockOnRegisterSuccess = jest.fn();
const mockOnSwitchToLogin = jest.fn();

global.fetch = jest.fn();
const originalAlert = window.alert;

// To make the component Register.jsx work (which uses import.meta.env),
// you should ensure import.meta.env is mocked in your jest.setup.js.
// For example, in jest.setup.js:
// global.importMeta = {
//   env: {
//     VITE_API_BASE_URL: 'http://localhost:3001/api/mocked', // Your test API URL
//     // Add other VITE_ variables if your components use them
//   },
// };
// Then, the Register.jsx component will pick this up.

// For constants within THIS test file, we avoid the problematic syntax:
const EXPECTED_API_BASE_URL =
  process.env.VITE_API_BASE_URL || "http://localhost:5001/api/test-register"; // Use process.env or hardcode for test
const EXPECTED_API_REGISTER_ENDPOINT = `${EXPECTED_API_BASE_URL}/auth/register`;
// The `originalEnv` line that used import.meta.env has been removed as it caused a syntax error.
// If you needed to mock/restore environment variables, do so via Jest's mechanisms or by setting process.env.

afterAll(() => {
  window.alert = originalAlert;
});

afterEach(() => {
  cleanup();
  fetch.mockClear();
  mockOnRegisterSuccess.mockClear();
  mockOnSwitchToLogin.mockClear();
});

describe("<Register />", () => {
  let user;

  beforeEach(() => {
    user = userEvent.setup();
    window.alert = jest.fn();
    // Reset fetch mock for each test
    fetch.mockImplementation(async (url, options) => {
      if (
        url.toString() === EXPECTED_API_REGISTER_ENDPOINT &&
        options &&
        options.method === "POST"
      ) {
        // Simulate successful registration
        return Promise.resolve({
          ok: true,
          json: async () => ({
            user: { _id: "newUser123", email: JSON.parse(options.body).email },
            // The actual register endpoint now returns accessToken and refreshToken
            // Include them in the mock if any part of the Register component's logic
            // (even if not explicitly tested here for token handling) might expect them.
            accessToken: "mock-access-token",
            refreshToken: "mock-refresh-token",
          }),
        });
      }
      // Fallback for other unhandled fetch calls or errors
      return Promise.resolve({
        ok: false,
        status: 400, // Default to a client error if not specific
        json: async () => ({
          error: "Mocked fetch: Unhandled registration path or error",
        }),
      });
    });
  });

  test("shows error if fields are empty on submit", async () => {
    render(
      <Register
        onRegisterSuccess={mockOnRegisterSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );
    const formElement = screen.getByTestId("register-form");
    fireEvent.submit(formElement);
    await waitFor(
      () => {
        const errorMessageElement = screen.getByTestId(
          "register-error-message"
        );
        expect(errorMessageElement).toBeInTheDocument();
        expect(errorMessageElement).toHaveTextContent(
          /Please fill in all fields/i
        );
      },
      { timeout: 3000 }
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  test("renders registration form correctly", () => {
    render(
      <Register
        onRegisterSuccess={mockOnRegisterSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );
    expect(
      screen.getByRole("heading", { name: /Create Account/i })
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText("Password (min. 8 characters)")
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Create Account/i })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Log In/i })).toBeInTheDocument();
  });

  test("shows error if passwords do not match", async () => {
    render(
      <Register
        onRegisterSuccess={mockOnRegisterSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );
    await user.type(
      screen.getByLabelText(/Email Address/i),
      "test@example.com"
    );
    await user.type(
      screen.getByLabelText("Password (min. 8 characters)"),
      "password123"
    );
    await user.type(screen.getByLabelText(/Confirm Password/i), "password456");
    await user.click(screen.getByRole("button", { name: /Create Account/i }));
    const errorMessageElement = await screen.findByTestId(
      "register-error-message"
    );
    expect(errorMessageElement).toHaveTextContent(/Passwords do not match/i);
  });

  test("shows error if password is too short", async () => {
    render(
      <Register
        onRegisterSuccess={mockOnRegisterSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );
    await user.type(
      screen.getByLabelText(/Email Address/i),
      "test@example.com"
    );
    await user.type(
      screen.getByLabelText("Password (min. 8 characters)"),
      "pass"
    );
    await user.type(screen.getByLabelText(/Confirm Password/i), "pass");
    await user.click(screen.getByRole("button", { name: /Create Account/i }));
    const errorMessageElement = await screen.findByTestId(
      "register-error-message"
    );
    expect(errorMessageElement).toHaveTextContent(
      /Password must be at least 8 characters long/i
    );
  });

  test("calls onRegisterSuccess on successful registration", async () => {
    // The global fetch mock is already set up in beforeEach to simulate success
    render(
      <Register
        onRegisterSuccess={mockOnRegisterSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );
    await user.type(
      screen.getByLabelText(/Email Address/i),
      "test@example.com"
    );
    await user.type(
      screen.getByLabelText("Password (min. 8 characters)"),
      "ValidPassword123"
    );
    await user.type(
      screen.getByLabelText(/Confirm Password/i),
      "ValidPassword123"
    );
    await user.click(screen.getByRole("button", { name: /Create Account/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        EXPECTED_API_REGISTER_ENDPOINT,
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: "test@example.com",
            password: "ValidPassword123",
          }),
        })
      );
    });
    await waitFor(() => {
      expect(window.alert).toHaveBeenCalledWith(
        "Registration successful! Please log in."
      );
    });
    await waitFor(() => {
      expect(mockOnRegisterSuccess).toHaveBeenCalledTimes(1);
    });
  });

  test("shows server error message on failed registration", async () => {
    fetch.mockResolvedValueOnce({
      // Override for this test
      ok: false,
      status: 400,
      json: async () => ({ error: "Email already exists" }),
    });
    render(
      <Register
        onRegisterSuccess={mockOnRegisterSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );
    await user.type(
      screen.getByLabelText(/Email Address/i),
      "test@example.com"
    );
    await user.type(
      screen.getByLabelText("Password (min. 8 characters)"),
      "password123"
    );
    await user.type(screen.getByLabelText(/Confirm Password/i), "password123");
    await user.click(screen.getByRole("button", { name: /Create Account/i }));
    const errorMessageElement = await screen.findByTestId(
      "register-error-message"
    );
    expect(errorMessageElement).toHaveTextContent(/Email already exists/i);
  });

  test('calls onSwitchToLogin when "Log In" button is clicked', async () => {
    render(
      <Register
        onRegisterSuccess={mockOnRegisterSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );
    await user.click(screen.getByRole("button", { name: /Log In/i }));
    expect(mockOnSwitchToLogin).toHaveBeenCalledTimes(1);
  });
});
