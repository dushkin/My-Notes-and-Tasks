// src/components/Register.jsx
import React, { useState, useEffect } from "react";
import ConfirmDialog from "./ConfirmDialog";
import LoadingButton from "../ui/LoadingButton";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

const Register = ({ onRegisterSuccess, onSwitchToLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Beta user limit state
  const [betaLimitReached, setBetaLimitReached] = useState(false);
  const [betaLimitCheckLoading, setBetaLimitCheckLoading] = useState(true);
  const [betaInfo, setBetaInfo] = useState(null);

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

  // Check beta user limit on component mount
  useEffect(() => {
    const checkBetaUserLimit = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/meta/user-count`);
        if (response.ok) {
          const data = await response.json();
          setBetaInfo(data);

          // Check if beta limit is enabled and reached
          if (data.betaEnabled && data.userCount >= data.betaLimit) {
            setBetaLimitReached(true);
            setError(
              `Registration is temporarily disabled. Beta user limit of ${data.betaLimit} users has been reached. Please try again later.`
            );
          }
        }
      } catch (error) {
        console.error("Failed to check beta user limit:", error);
        // If we can't check the limit, allow registration (fail open)
        setBetaLimitReached(false);
      } finally {
        setBetaLimitCheckLoading(false);
      }
    };

    checkBetaUserLimit();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(""); // Clear previous errors

    // Check beta limit before proceeding
    if (betaLimitReached) {
      setError(
        `Registration is temporarily disabled. Beta user limit of ${
          betaInfo?.betaLimit || 50
        } users has been reached. Please try again later.`
      );
      return;
    }

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
        // Check for beta limit error specifically
        if (
          response.status === 403 &&
          data.error?.includes("Beta user limit")
        ) {
          setBetaLimitReached(true);
          setError(data.error);
          return;
        }
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

  // Show loading state while checking beta limit
  if (betaLimitCheckLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zinc-100 dark:bg-zinc-900">
        <div className="p-8 bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-md text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-zinc-600 dark:text-zinc-400">
            Checking registration availability...
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-center min-h-screen bg-zinc-100 dark:bg-zinc-900">
        <div className="p-8 bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-md">
          <h2 className="text-2xl font-semibold text-center text-zinc-900 dark:text-white mb-6">
            Create Account
          </h2>

          {/* Beta limit notification */}
          {betaInfo?.betaEnabled && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-md">
              <div className="flex items-center justify-between text-sm">
                <span className="text-blue-700 dark:text-blue-300 font-medium">
                  🚧 Beta Version
                </span>
              </div>
              {betaLimitReached && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                  Beta user limit reached. New registrations are temporarily
                  disabled.
                </p>
              )}
            </div>
          )}

          {error && (
            <p
              data-item-id="register-error-message"
              className={`text-sm mb-4 p-3 rounded ${
                error.includes("Beta user limit") || betaLimitReached
                  ? "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border border-red-300 dark:border-red-700"
                  : "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300"
              }`}
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
                disabled={isLoading || betaLimitReached}
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
                disabled={isLoading || betaLimitReached}
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
                disabled={isLoading || betaLimitReached}
              />
            </div>
            <LoadingButton
              type="submit"
              isLoading={isLoading}
              loadingText="Registering..."
              className="w-full"
              variant={betaLimitReached ? "secondary" : "success"}
              size="large"
              disabled={betaLimitReached}
            >
              {betaLimitReached ? "Registration Disabled" : "Create Account"}
            </LoadingButton>
          </form>
          <p className="mt-6 text-sm text-center text-zinc-600 dark:text-zinc-400">
            Already have an account?{" "}
            <button
              onClick={onSwitchToLogin}
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              disabled={isLoading}
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
