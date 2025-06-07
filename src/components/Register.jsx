// src/components/Register.jsx
import React, { useState } from "react";
import ConfirmDialog from "./ConfirmDialog";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";

const Register = ({ onRegisterSuccess, onSwitchToLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
    onCancel: () => {},
    variant: "default",
    confirmText: "OK",
    cancelText: "Cancel",
  });

  const showConfirm = (options) => {
    setConfirmDialog({
      isOpen: true,
      title: options.title || "Success",
      message: options.message || "Registration successful!",
      onConfirm:
        options.onConfirm ||
        (() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))),
      onCancel:
        options.onCancel ||
        (() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))),
      variant: options.variant || "default",
      confirmText: options.confirmText || "OK",
      cancelText: options.cancelText || "Cancel",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); // Clear previous errors

    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      setIsLoading(false);

      if (!response.ok) {
        setError(data.error || "Registration failed. Please try again.");
        return;
      }

      showConfirm({
        title: "Registration Successful",
        message:
          "Your account has been created successfully! Please log in with your credentials.",
        variant: "default",
        confirmText: "Go to Login",
        onConfirm: () => {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
          if (onRegisterSuccess) {
            onRegisterSuccess();
          }
        },
      });
    } catch (err) {
      setIsLoading(false);
      setError("Network error or server issue. Please try again.");
      console.error("Registration request error:", err);
    }
  };

  return (
    <>
      <div className="flex items-center justify-center min-h-screen bg-zinc-100 dark:bg-zinc-900">
        <div className="p-8 bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-md">
          <h2 className="text-2xl font-semibold text-center text-zinc-900 dark:text-white mb-6">
            Create Account
          </h2>
          {error && (
            <p
              data-item-id="register-error-message"
              className="text-red-500 dark:text-red-400 text-sm mb-4 p-3 bg-red-100 dark:bg-red-900/30 rounded"
            >
              {error}
            </p>
          )}
          <form onSubmit={handleSubmit} data-item-id="register-form" noValidate>
            <div className="mb-4">
              <label
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                htmlFor="email-register"
              >
                Email Address
              </label>
              <input
                type="email"
                id="email-register"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-zinc-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                placeholder="you@e2e.com"
              />
            </div>
            <div className="mb-4">
              <label
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                htmlFor="password-register"
              >
                Password (min. 8 characters)
              </label>
              <input
                type="password"
                id="password-register"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-zinc-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                placeholder="••••••••"
              />
            </div>
            <div className="mb-6">
              <label
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
                htmlFor="confirmPassword-register"
              >
                Confirm Password
              </label>
              <input
                type="password"
                id="confirmPassword-register"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-zinc-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
                placeholder="••••••••"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-green-600 text-white py-2.5 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-800 transition duration-150 ease-in-out disabled:opacity-50"
            >
              {isLoading ? "Registering..." : "Create Account"}
            </button>
          </form>
          <p className="mt-6 text-sm text-center text-zinc-600 dark:text-zinc-400">
            Already have an account?{" "}
            <button
              onClick={onSwitchToLogin}
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
            >
              Log In
            </button>
          </p>
        </div>
      </div>
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmText={confirmDialog.confirmText}
        cancelText={confirmDialog.cancelText}
        variant={confirmDialog.variant}
        onConfirm={confirmDialog.onConfirm}
        onCancel={confirmDialog.onCancel}
      />
    </>
  );
};

export default Register;
