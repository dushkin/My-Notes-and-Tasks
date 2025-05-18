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

const originalEnv = { ...process.env };
// Adjust this based on your test environment's VITE_API_BASE_URL resolution
const EXPECTED_API_BASE_URL =
  process.env.VITE_API_BASE_URL || "http://localhost:5001/api/test";
const EXPECTED_API_REGISTER_ENDPOINT = `${EXPECTED_API_BASE_URL}/auth/register`;

afterAll(() => {
  process.env = originalEnv;
  window.alert = originalAlert; // Restore original alert
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
    window.alert = jest.fn(); // Mock window.alert for each test
  });

  // Run this test in isolation first
  test("shows error if fields are empty on submit", async () => {
    render(
      <Register
        onRegisterSuccess={mockOnRegisterSuccess}
        onSwitchToLogin={mockOnSwitchToLogin}
      />
    );

    // const createAccountButton = screen.getByRole("button", { name: /Create Account/i });
    // await user.click(createAccountButton);
    // OR directly submit the form:
    const formElement = screen.getByTestId("register-form"); // Assumes data-item-id="register-form" on form
    fireEvent.submit(formElement);

    // ***** UNCOMMENT THE LINE BELOW TO DEBUG THE DOM *****
    // console.log("DEBUG FROM TEST (empty register fields): DOM state immediately after submit and before waitFor:");
    // screen.debug(undefined, 300000);
    // ***** *****

    // Check console for logs from Register.jsx's handleSubmit
    // Expecting: "[Register.jsx handleSubmit DEBUG] ENTRY - email: '', password: '', confirmPassword: ''"
    // And then: "[Register.jsx handleSubmit DEBUG] Empty fields validation hit! Setting error."

    await waitFor(
      () => {
        // Ensure Register.jsx uses data-item-id for the error message if your env expects it for getByTestId
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
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        user: { id: "newUser123", email: "test@example.com" },
        token: "new-token",
      }),
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
      "ValidPassword123"
    );
    await user.type(
      screen.getByLabelText(/Confirm Password/i),
      "ValidPassword123"
    );
    await user.click(screen.getByRole("button", { name: /Create Account/i }));

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        EXPECTED_API_REGISTER_ENDPOINT, // Use the corrected endpoint
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
      ok: false,
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
