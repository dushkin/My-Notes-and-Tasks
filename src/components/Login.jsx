// src/components/Login.jsx
import React, { useState } from "react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5001/api/fallback";

const Login = ({ onLoginSuccess, onSwitchToRegister }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

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

      if (data.token) {
        localStorage.setItem("userToken", data.token);
        if (onLoginSuccess) {
          onLoginSuccess(data.user);
        }
      } else {
        setError("Login failed: No token received from server.");
      }
    } catch {
      setIsLoading(false);
      setError("Network error or server issue. Please try again.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-100 dark:bg-zinc-900">
      <div className="p-8 bg-white dark:bg-zinc-800 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-2xl font-semibold text-center text-zinc-900 dark:text-white mb-6">
          Login to Notes & Tasks
        </h2>
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
              placeholder="you@example.com"
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
            />
          </div>
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-2.5 px-4 rounded-md hover:bg-blue-700 transition duration-150 ease-in-out disabled:opacity-50"
          >
            {isLoading ? "Logging in..." : "Login"}
          </button>
        </form>
        <p className="mt-6 text-sm text-center text-zinc-600 dark:text-zinc-400">
          Don't have an account?{" "}
          <button
            onClick={onSwitchToRegister}
            className="font-medium text-blue-600 hover:text-blue-500"
          >
            Create one
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
