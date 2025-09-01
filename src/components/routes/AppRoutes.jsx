import React, { useState, useEffect } from "react";
import { useNavigate, Navigate, Routes, Route } from "react-router-dom";
import BetaBanner from "../BetaBanner";
import LandingPage from "../LandingPage";
import Login from "../dialogs/Login";
import Register from "../dialogs/Register";
import LoadingSpinner from "../ui/LoadingSpinner.jsx";
import MainApp from "../MainApp";
import EditorPage from "../pages/EditorPage.jsx";
import { getAccessToken, clearTokens } from "../../services/authService";
import { authFetch } from "../../services/apiClient";

export const LandingPageRoute = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = getAccessToken();
      if (token) {
        try {
          const data = await authFetch("/auth/verify-token");
          if (data.valid && data.user) {
            setCurrentUser(data.user);
          } else {
            // Token exists but is invalid, clear it
            clearTokens();
          }
        } catch (error) {
          console.log("Auth check failed:", error);
          // Clear tokens on network/auth errors
          clearTokens();
        }
      }
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, []);
  
  if (isCheckingAuth) {
    return <LoadingSpinner variant="overlay" text="Loading..." />;
  }

  if (currentUser) {
    return <Navigate to="/app" replace />;
  }

  return (
    <>
      <BetaBanner variant="landing" />
      <LandingPage
        onLogin={() => navigate("/login")}
        onSignup={() => navigate("/register")}
        currentUser={currentUser}
      />
    </>
  );
};

export const LoginRoute = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = getAccessToken();
      if (token) {
        try {
          const data = await authFetch("/auth/verify-token");
          if (data.valid && data.user) {
            setCurrentUser(data.user);
            if (typeof window.subscribeAfterLogin === "function") {
              window.subscribeAfterLogin();
            }
          } else {
            // Token exists but is invalid, clear it
            clearTokens();
          }
        } catch (error) {
          console.log("Auth check failed:", error);
          // Clear tokens on network/auth errors
          clearTokens();
        }
      }
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, []);

  if (isCheckingAuth) {
    return <LoadingSpinner variant="overlay" text="Loading..." />;
  }

  if (currentUser) {
    return <Navigate to="/app" replace />;
  }

  const handleLoginSuccess = (userData) => {
    console.log("[DEBUG] Login success - setting user:", userData);
    setCurrentUser(userData);

    if (typeof window.subscribeAfterLogin === "function") {
      window.subscribeAfterLogin();
    }

    console.log("[DEBUG] Navigating to /app");
    navigate("/app", { replace: true });
  };

  const handleSwitchToRegister = () => {
    navigate("/register", { replace: true });
  };

  return (
    <>
      <BetaBanner variant="auth" />
      <Login
        onLoginSuccess={handleLoginSuccess}
        onSwitchToRegister={handleSwitchToRegister}
      />
    </>
  );
};

export const RegisterRoute = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const token = getAccessToken();
      if (token) {
        try {
          const data = await authFetch("/auth/verify-token");
          if (data.valid && data.user) {
            setCurrentUser(data.user);
          } else {
            // Token exists but is invalid, clear it
            clearTokens();
          }
        } catch (error) {
          console.log("Auth check failed:", error);
          // Clear tokens on network/auth errors
          clearTokens();
        }
      }
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, []);
  
  if (isCheckingAuth) {
    return <LoadingSpinner variant="overlay" text="Loading..." />;
  }

  if (currentUser) {
    return <Navigate to="/app" replace />;
  }

  const handleRegisterSuccess = () => {
    navigate("/login");
  };
  
  return (
    <>
      <BetaBanner variant="auth" />
      <Register
        onRegisterSuccess={handleRegisterSuccess}
        onSwitchToLogin={() => navigate("/login")}
      />
    </>
  );
};

export const ProtectedAppRoute = () => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [isAuthCheckComplete, setIsAuthCheckComplete] = useState(false);
  
  useEffect(() => {
    const checkAuth = async () => {
      const initialToken = getAccessToken();
      if (initialToken) {
        try {
          const data = await authFetch("/auth/verify-token");
          if (data.valid && data.user) {
            const finalToken = getAccessToken();
            setCurrentUser(data.user);
            setAuthToken(finalToken);
            setIsAuthCheckComplete(true);
            return;
          }
        } catch (error) {
          console.log("Auth check failed:", error);
        }
      }
      clearTokens();
      navigate("/", { replace: true });
    };

    checkAuth();
  }, []);
  
  if (!isAuthCheckComplete || !currentUser) {
    return <LoadingSpinner variant="overlay" text="Loading application..." />;
  }

  return (
    <Routes>
      <Route
        index
        element={
          <MainApp
            currentUser={currentUser}
            setCurrentUser={setCurrentUser}
            authToken={authToken}
          />
        }
      />
      <Route path="item/:id" element={<EditorPage />} />
      <Route path="*" element={<Navigate to="" replace />} />
    </Routes>
  );
};