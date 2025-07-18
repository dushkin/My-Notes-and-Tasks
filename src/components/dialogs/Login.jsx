// src/components/Login.jsx
import React, { useState, useEffect } from "react";
import { storeTokens } from "../../services/authService";
import LoadingButton from "../ui/LoadingButton";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api";

const Login = ({ onLoginSuccess, onSwitchToRegister }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Beta user limit state
  const [betaLimitReached, setBetaLimitReached] = useState(false);
  const [betaLimitCheckLoading, setBetaLimitCheckLoading] = useState(true);
  const [betaInfo, setBetaInfo] = useState(null);

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
    setError("");
    setIsLoading(true);

    if (!email || !password) {
      setError("Please enter both email and password.");
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await response.json();
      setIsLoading(false);

      if (!response.ok) {
        setError(data.error || "Login failed. Please check your credentials.");
        return;
      }

      if (data.accessToken && data.refreshToken) {
        storeTokens(data.accessToken, data.refreshToken);

        console.log("[DEBUG Login] Tokens stored successfully");
        console.log(
          "[DEBUG Login] AccessToken exists:",
          !!localStorage.getItem("accessToken")
        );
        console.log(
          "[DEBUG Login] RefreshToken exists:",
          !!localStorage.getItem("refreshToken")
        );

        if (onLoginSuccess) {
          onLoginSuccess(data.user);
        }
      } else {
        setError("Login failed: Invalid token response from server.");
      }
    } catch (err) {
      setIsLoading(false);
      setError("Network error or server issue. Please try again.");
      console.error("Login request error:", err);
    }
  };

  const handleCreateAccountClick = () => {
    if (betaLimitReached) {
      return; // Do nothing if beta limit is reached
    }
    onSwitchToRegister();
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-100 dark:bg-zinc-900">
      <div className="p-8 bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-semibold text-center text-zinc-900 dark:text-white mb-6">
          Login to Notes & Tasks
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
            data-item-id="login-error-message"
            className="text-red-500 dark:text-red-400 text-sm mb-4"
          >
            {error}
          </p>
        )}
        <form onSubmit={handleSubmit} data-item-id="login-form" noValidate>
          <div className="mb-4">
            <label
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              htmlFor="email-login"
            >
              Email Address
            </label>
            <input
              type="email"
              id="email-login"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 border border-zinc-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              placeholder="you@e2e.com"
              autoComplete="email"
              disabled={isLoading}
            />
          </div>
          <div className="mb-6">
            <label
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1"
              htmlFor="password-login"
            >
              Password
            </label>
            <input
              type="password"
              id="password-login"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-zinc-300 dark:border-zinc-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white"
              placeholder="••••••••"
              autoComplete="current-password"
              disabled={isLoading}
            />
          </div>
          <LoadingButton
            type="submit"
            isLoading={isLoading}
            loadingText="Logging in..."
            className="w-full"
            variant="primary"
            size="large"
          >
            Login
          </LoadingButton>
        </form>
        <p className="mt-6 text-sm text-center text-zinc-600 dark:text-zinc-400">
          Don't have an account?{" "}
          {betaLimitCheckLoading ? (
            <span className="text-zinc-400 dark:text-zinc-500">Loading...</span>
          ) : betaLimitReached ? (
            <span
              className="text-zinc-400 dark:text-zinc-500 cursor-not-allowed"
              title="Registration temporarily disabled - beta user limit reached"
            >
              Create one
            </span>
          ) : (
            <button
              onClick={handleCreateAccountClick}
              className="font-medium text-blue-600 hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
              disabled={isLoading}
            >
              Create one
            </button>
          )}
        </p>
      </div>
    </div>
  );
};

export default Login;
