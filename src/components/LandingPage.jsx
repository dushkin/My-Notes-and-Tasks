import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { PRICING_PLANS, getAvailablePlans } from "../config/pricing";
import Button from "./ui/button";
import { Card, CardContent } from "./ui/card";
import logo from "../assets/logo_dual_48x48.png";

export default function LandingPage({ onLogin, onSignup, currentUser }) {
  const [billingCycle, setBillingCycle] = useState("yearly");
  const [showPricing, setShowPricing] = useState(true);
  const [paddleInitialized, setPaddleInitialized] = useState(false);
  const [notification, setNotification] = useState("");
  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  useEffect(() => {
    if (window.__PADDLE_INITIALIZED__) {
      setPaddleInitialized(true);
      return;
    }

    const initializePaddle = () => {
      try {

        console.log('[DEBUG] ENV', {
          token: import.meta.env.VITE_PADDLE_CLIENT_TOKEN,
          seller: import.meta.env.VITE_PADDLE_SELLER_ID,
        });

        const paddleToken = import.meta.env.VITE_PADDLE_CLIENT_TOKEN;
        const sellerId = import.meta.env.VITE_PADDLE_SELLER_ID;

        if (!paddleToken || !sellerId) {
          console.error(
            "❌ Paddle client token or seller ID not found. Please set VITE_PADDLE_CLIENT_TOKEN and VITE_PADDLE_SELLER_ID in your .env file."
          );
          return;
        }

        // Sandbox on localhost, Production otherwise
        window.Paddle.Environment.set(isLocalhost ? "sandbox" : "production");
        window.Paddle.Initialize({
          token: paddleToken,
          eventCallback: (event) => {
            if (event.name === "checkout.complete") {
              setNotification(
                "Payment successful! Redirecting to your private area..."
              );
              setTimeout(() => (window.location.href = "/app"), 2000);
            }
            if (event.name === "checkout.loaded") {
              console.log("✅ Paddle checkout loaded");
            }
            if (event.name === "checkout.error") {
              console.error("❌ Paddle checkout error:", event.data);
            }
          },
        });

        window.__PADDLE_INITIALIZED__ = true;
        setPaddleInitialized(true);
        console.log(
          `✅ Paddle ${
            isLocalhost ? "sandbox" : "production"
          } initialized successfully`
        );
        console.log(`Environment: ${isLocalhost ? "sandbox" : "production"}`);
        console.log("Debug mode:", isLocalhost ? "enabled" : "disabled");
      } catch (error) {
        console.error(
          `❌ Failed to initialize Paddle ${
            isLocalhost ? "sandbox" : "production"
          }:`,
          error
        );
        if (error.message?.includes("token")) {
          console.error(
            "💡 Ensure VITE_PADDLE_CLIENT_TOKEN and VITE_PADDLE_SELLER_ID are set in your .env file"
          );
        }
        if (error.message?.includes("403")) {
          console.error(
            "💡 Verify your domain is approved in the Paddle Dashboard under Live → Website Approval"
          );
        }
      }
    };

    initializePaddle();
  }, []);

  const handleCheckout = async (planId) => {
    console.log("handleCheckout called with:", planId);

    const availablePlans = getAvailablePlans();
    const plan = availablePlans[planId];
    console.log("Plan details:", plan);

    if (!paddleInitialized || !window.Paddle) {
      console.error("❌ Paddle not initialized");
      alert("Payment system is loading. Please try again in a moment.");
      return;
    }

    if (!plan?.paddleProductId) {
      console.error("❌ No paddle product ID for plan:", planId);
      alert("This plan is not available for purchase yet.");
      return;
    }

    const token = localStorage.getItem("accessToken");
    if (!token) {
      console.error("❌ No access token found. User must be logged in.");
      alert("Please log in to proceed with the purchase.");
      return;
    }

    try {
      console.log("🚀 Opening Paddle checkout with backend transaction...");
      const requestBody = {
        priceId: plan.paddleProductId,
        quantity: 1,
        customerEmail: currentUser?.email || "",
        customData: { plan: planId },
        successUrl: `${window.location.origin}/app`,
        cancelUrl: `${window.location.href}`,
      };
      console.log("Sending request body:", requestBody);

      const response = await fetch(
        isLocalhost
          ? "http://localhost:5001/api/paddle/create-transaction"
          : "https://my-notes-and-tasks-backend.onrender.com/api/paddle/create-transaction",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        console.error("❌ Backend error:", data);
        throw new Error(data.error || "Failed to create transaction");
      }

      window.Paddle.Checkout.open({
        successCallback: () => {
          setNotification(
            "Payment successful! Redirecting to your private area..."
          );
          setTimeout(() => (window.location.href = "/app"), 2000);
        },
        transactionId: data.transactionId,
        email: currentUser?.email || "",
        settings: {
          displayMode: "overlay",
          theme: "light",
          allowLogout: true,
          showAddDiscounts: true,
          allowDiscountRemoval: true,
          showAddTaxId: true,
          variant: "multi-page",
          sourcePage: window.location.href,
          referrer: window.location.hostname,
        },
      });

      console.log(
        "✅ Paddle checkout opened with transaction ID:",
        data.transactionId
      );
    } catch (error) {
      console.error("❌ Error opening Paddle checkout:", error);
      alert("There was an error processing your payment. Please try again.");
    }
  };

  useEffect(() => {
    if (window.location.hash === "#pricing") {
      setShowPricing(true);
      setTimeout(() => {
        document
          .getElementById("pricing")
          ?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, []);

  return (
    <>
      {notification && (
        <div className="fixed top-0 left-0 w-full bg-green-100 text-green-800 text-center py-2 z-50">
          {notification}
        </div>
      )}

      <div
        className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 via-white to-purple-50"
        style={{ paddingTop: "var(--beta-banner-height, 0px)" }}
      >
        {/* Banner Notice */}
        <div className="bg-yellow-100 border-b border-yellow-200 text-yellow-800 text-center py-1 text-sm">
          Currently supports Desktop and Android only; iOS support coming soon.
        </div>
        <header className="relative z-10 backdrop-blur-sm bg-white/80 border-b border-gray-200/50">
          <div className="block sm:hidden">
            <div className="flex justify-center items-center p-4 border-b border-gray-200/30">
              <div className="flex items-center space-x-2">
                <img
                  src={logo}
                  alt="Notes & Tasks Logo"
                  className="w-10 h-10"
                />
                <h1 className="text-lg font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  Notes & Tasks
                </h1>
              </div>
            </div>
            <div className="px-4 py-3 overflow-x-auto">
              <nav className="flex items-center justify-center">
                {currentUser ? (
                  <div className="flex items-center gap-3 min-w-max">
                    <div className="text-xs text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full text-center whitespace-nowrap">
                      👋 Welcome,{" "}
                      <span className="font-medium">
                        {currentUser.email.split("@")[0]}
                      </span>
                    </div>
                    <a
                      href="/app"
                      className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-full hover:shadow-lg transform hover:scale-105 transition-all duration-200 font-medium text-sm whitespace-nowrap"
                    >
                      Go to App →
                    </a>
                  </div>
                ) : (
                  <button
                    onClick={onLogin}
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-4 py-2 rounded-full font-semibold hover:shadow-xl hover:shadow-blue-500/25 transform hover:scale-105 transition-all duration-200 border-2 border-transparent hover:border-blue-300 text-sm whitespace-nowrap"
                  >
                    🔐 Personal Area
                  </button>
                )}
              </nav>
            </div>
          </div>
          <div className="hidden sm:flex justify-between items-center p-6 max-w-7xl mx-auto w-full">
            <div className="flex items-center space-x-3">
              <img src={logo} alt="Notes & Tasks Logo" className="w-12 h-12" />
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Notes & Tasks
              </h2>
            </div>
            <nav>
              {currentUser ? (
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1.5 rounded-full">
                    👋 Welcome back,{" "}
                    <span className="font-medium">{currentUser.email}</span>
                  </span>
                  <a
                    href="/app"
                    className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2.5 rounded-full hover:shadow-lg transform hover:scale-105 transition-all duration-200 font-medium"
                  >
                    Go to App →
                  </a>
                </div>
              ) : (
                <button
                  onClick={onLogin}
                  className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-full font-semibold hover:shadow-xl hover:shadow-blue-500/25 transform hover:scale-105 transition-all duration-200 border-2 border-transparent hover:border-blue-300"
                >
                  🔐 Personal Area
                </button>
              )}
            </nav>
          </div>
        </header>

        <main className="flex-grow">
          <section className="relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600/5 to-purple-600/5"></div>
            <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 right-10 w-96 h-96 bg-purple-400/10 rounded-full blur-3xl"></div>
            <div className="relative max-w-7xl mx-auto px-6 py-20 lg:py-32">
              <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
                <div className="lg:w-1/2 space-y-8">
                  <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6 }}
                  >
                    <h2 className="text-5xl lg:text-6xl font-bold leading-tight text-zinc-900">
                      Organize Your{" "}
                      <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                        Digital Life
                      </span>{" "}
                      & To‑Dos
                    </h2>
                  </motion.div>
                  <motion.p
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.6 }}
                    className="text-xl text-gray-600 leading-relaxed"
                  >
                    A powerful, intuitive platform that transforms how you
                    capture ideas, build knowledge bases, manage tasks, and stay
                    productive. Everything you need to turn thoughts into
                    action.
                  </motion.p>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4, duration: 0.6 }}
                    className="flex flex-col sm:flex-row gap-4"
                  >
                    {currentUser ? (
                      <a
                        href="/app"
                        className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-full hover:shadow-xl hover:shadow-blue-500/25 transform hover:scale-105 transition-all duration-200"
                      >
                        ✨ Access Your Notes & Tasks
                      </a>
                    ) : (
                      <>
                        <button
                          onClick={onSignup}
                          className="inline-flex items-center justify-center px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-full hover:shadow-xl hover:shadow-blue-500/25 transform hover:scale-105 transition-all duration-200"
                        >
                          🚀 Sign up free! (Up to 100 items)
                        </button>
                      </>
                    )}
                  </motion.div>
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6, duration: 0.6 }}
                    className="flex flex-wrap gap-x-6 gap-y-3 pt-6"
                  >
                    {[
                      "🎯 Smart Organization",
                      "⚡ Lightning Fast",
                      "🔒 Secure & Private",
                      "🛡️ No Malicious Code",
                    ].map((feature, index) => (
                      <div
                        key={index}
                        className="flex items-center space-x-2 text-gray-600"
                      >
                        <span className="text-lg">{feature.split(" ")[0]}</span>
                        <span className="font-medium">
                          {feature.split(" ").slice(1).join(" ")}
                        </span>
                      </div>
                    ))}
                    <p className="text-xs text-gray-500 w-full pt-1">
                      No spyware, no malware, no adware. Ever.
                    </p>
                  </motion.div>
                </div>
                <motion.div
                  className="lg:w-1/2 flex flex-col gap-8"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3, duration: 0.8 }}
                >
                  <div className="relative">
                    <div className="absolute -inset-2 bg-gradient-to-r from-blue-500 to-purple-500 rounded-3xl blur-2xl opacity-20 transform -rotate-3"></div>
                    <div className="relative aspect-video rounded-2xl shadow-2xl overflow-hidden border border-gray-200/50">
                      <iframe
                        className="w-full h-full"
                        src="https://www.youtube.com/embed/UTLnBwecwrc?autoplay=1&loop=1&controls=1&mute=0&modestbranding=1"
                        title="My Notes & Tasks Intro"
                        frameBorder="0"
                        allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        loading="lazy"
                        onError={(e) => {
                          console.warn("YouTube embed failed to load");
                          e.target.style.display = "none";
                          e.target.parentElement.innerHTML = `
                            <div class="flex items-center justify-center h-full bg-gray-100 dark:bg-gray-800 rounded-2xl">
                              <div class="text-center p-8">
                                <div className="text-6xl mb-4">🎥</div>
                                <h3 className="text-lg font-semibold text-gray-700 dark:text-gray-300 mb-2">Demo Video</h3>
                                <p className="text-gray-500 dark:text-gray-400">Video temporarily unavailable</p>
                              </div>
                            </div>
                          `;
                        }}
                      ></iframe>
                    </div>
                  </div>
                  <div className="relative">
                    <div className="relative bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200/50">
                      <div className="bg-gradient-to-r from-blue-500 to-purple-500 h-10 flex items-center px-4">
                        <div className="flex space-x-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-white/30"></div>
                          <div className="w-2.5 h-2.5 rounded-full bg-white/30"></div>
                          <div className="w-2.5 h-2.5 rounded-full bg-white/30"></div>
                        </div>
                        <div className="ml-3 text-white text-xs font-medium">
                          Notes & Tasks
                        </div>
                      </div>
                      <div className="flex h-80">
                        <div className="w-1/2 p-4 bg-gray-50/50 border-r border-gray-200">
                          <div className="space-y-2 text-sm">
                            <div className="flex items-center space-x-2 text-gray-700">
                              <span className="text-blue-500">▾</span>
                              <span className="text-base">📁</span>
                              <span className="font-medium">Work Projects</span>
                            </div>
                            <div className="ml-6 space-y-1.5">
                              <div className="flex items-center space-x-2 text-gray-600 bg-blue-50 px-2 py-1 rounded">
                                <span className="text-base">📝</span>
                                <span className="text-blue-700 font-medium">
                                  Meeting Notes
                                </span>
                              </div>
                              <div className="flex items-center space-x-2 text-gray-600 px-2 py-1">
                                <span className="text-base">✅</span>
                                <span className="line-through opacity-60 text-xs">
                                  Setup repository
                                </span>
                              </div>
                              <div className="flex items-center space-x-2 text-gray-600 px-2 py-1">
                                <span className="text-base">⬜️</span>
                                <span className="text-xs">Review mockups</span>
                              </div>
                            </div>
                            <div className="flex items-center space-x-2 text-gray-700 mt-3">
                              <span className="text-blue-500">▸</span>
                              <span className="text-base">📁</span>
                              <span className="font-medium">Personal</span>
                            </div>
                            <div className="flex items-center space-x-2 text-gray-700">
                              <span className="text-blue-500">▾</span>
                              <span className="text-base">📁</span>
                              <span className="font-medium">
                                Knowledge Base
                              </span>
                            </div>
                            <div className="ml-6 space-y-1.5">
                              <div className="flex items-center space-x-2 text-gray-600 px-2 py-1">
                                <span className="text-blue-500">▸</span>
                                <span className="text-base">📁</span>
                                <span className="text-xs">React Dev</span>
                              </div>
                              <div className="flex items-center space-x-2 text-gray-600 px-2 py-1">
                                <span className="text-base">📝</span>
                                <span className="text-xs">API Docs</span>
                              </div>
                              <div className="flex items-center space-x-2 text-gray-600 px-2 py-1">
                                <span className="text-base">📝</span>
                                <span className="text-xs">Resources</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="w-1/2 p-4 bg-white">
                          <div className="h-full">
                            <div className="text-xs text-gray-500 mb-3 flex items-center space-x-2">
                              <span>📝</span>
                              <span>Meeting Notes</span>
                            </div>
                            <div className="space-y-3">
                              <div className="h-2 bg-gray-200 rounded w-full"></div>
                              <div className="h-2 bg-gray-200 rounded w-5/6"></div>
                              <div className="h-2 bg-gray-200 rounded w-4/6"></div>
                              <div className="mt-4 space-y-2">
                                <div className="text-xs font-medium text-gray-700 mb-2">
                                  Action Items:
                                </div>
                                <div className="flex items-center space-x-2">
                                  <div className="w-2 h-2 bg-gray-700 rounded-full"></div>
                                  <div className="h-1.5 bg-gray-200 rounded w-3/5"></div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <div className="w-2 h-2 bg-gray-700 rounded-full"></div>
                                  <div className="h-1.5 bg-gray-200 rounded w-4/5"></div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <div className="w-2 h-2 bg-gray-700 rounded-full"></div>
                                  <div className="h-1.5 bg-gray-200 rounded w-2/5"></div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </section>

          {showPricing && (
            <section id="pricing" className="py-20 bg-white/50">
              <div className="max-w-4xl mx-auto px-6">
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  viewport={{ once: true }}
                  className="text-center mb-16"
                >
                  <h3 className="text-4xl font-bold text-gray-900 mb-4">
                    Simple, Transparent Pricing
                  </h3>
                  <p className="text-xl text-gray-600">
                    Choose the plan that works best for you
                  </p>
                </motion.div>
                <div className="space-y-8">
                  {!currentUser && (
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.1 }}
                      viewport={{ once: true }}
                    >
                      <Card className="relative overflow-hidden border-2 border-gray-200 hover:border-blue-300 transition-all duration-300">
                        <CardContent className="p-8">
                          <div className="text-center mb-6">
                            <h4 className="text-2xl font-bold text-gray-900 mb-2">
                              Free Plan
                            </h4>
                            <div className="text-4xl font-bold text-blue-600 mb-1">
                              $0
                            </div>
                            <div className="text-gray-500">Forever free</div>
                          </div>
                          <ul className="space-y-4 mb-8">
                            {[
                              "Up to 100 tree items (Folders, notes & tasks)",
                              "Rich text & Markdown support",
                              "Advanced organization",
                              "Cloud sync",
                              "Export features",
                            ].map((feature, index) => (
                              <li
                                key={index}
                                className="flex items-center space-x-3"
                              >
                                <span className="text-green-500">✓</span>
                                <span className="text-gray-700">{feature}</span>
                              </li>
                            ))}
                          </ul>
                          <div className="flex justify-center">
                            <button
                              onClick={onSignup}
                              className="px-8 py-3 border-2 border-blue-600 text-blue-600 font-semibold rounded-full hover:bg-blue-50 transition-all duration-200"
                            >
                              Sign up free to try it out!
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                  {currentUser && (
                    <motion.div
                      initial={{ opacity: 0, y: 30 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                      viewport={{ once: true }}
                    >
                      <Card className="relative overflow-hidden border-2 border-blue-500 shadow-xl shadow-blue-500/25">
                        {billingCycle === "yearly" && (
                          <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-center py-2 text-sm font-medium">
                            ⭐ Most Popular
                          </div>
                        )}
                        <CardContent className="p-8 pt-12">
                          <div className="text-center mb-6">
                            <h4 className="text-2xl font-bold text-gray-900 mb-4">
                              Pro Plan
                            </h4>
                            <div className="p-1 bg-gray-100 rounded-full flex items-center mb-6 max-w-md mx-auto">
                              <button
                                onClick={() => setBillingCycle("monthly")}
                                className={`flex-1 py-1.5 text-sm font-semibold rounded-full transition-colors ${
                                  billingCycle === "monthly"
                                    ? "bg-white shadow text-blue-600"
                                    : "text-gray-500 hover hover:text-gray-700"
                                }`}
                              >
                                Monthly
                              </button>
                              <button
                                onClick={() => setBillingCycle("yearly")}
                                className={`flex-1 py-1.5 text-sm font-semibold rounded-full transition-colors ${
                                  billingCycle === "yearly"
                                    ? "bg-white shadow text-blue-600"
                                    : "text-gray-500 hover:text-gray-700"
                                }`}
                              >
                                Yearly
                              </button>
                              <button
                                onClick={() => setBillingCycle("lifetime")}
                                className={`flex-1 py-1.5 text-sm font-semibold rounded-full transition-colors ${
                                  billingCycle === "lifetime"
                                    ? "bg-white shadow text-blue-600"
                                    : "text-gray-500 hover:text-gray-700"
                                }`}
                              >
                                Lifetime
                              </button>
                            </div>
                            <div className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-1">
                              ${PRICING_PLANS[billingCycle].price}
                            </div>
                            <div className="text-gray-500 h-10 flex items-center justify-center">
                              {billingCycle === "monthly" &&
                                PRICING_PLANS.monthly.description}
                              {billingCycle === "yearly" &&
                                PRICING_PLANS.yearly.description}
                              {billingCycle === "lifetime" &&
                                PRICING_PLANS.lifetime.description}
                            </div>
                          </div>
                          <ul className="space-y-4 mb-8">
                            {[
                              "All in free plan",
                              "Unlimited tree items (Folders, notes & tasks)",
                            ].map((feature, index) => (
                              <li
                                key={index}
                                className="flex items-center space-x-3"
                              >
                                <span className="text-green-500">✓</span>
                                <span className="text-gray-700">{feature}</span>
                              </li>
                            ))}
                          </ul>
                          <div className="flex justify-center">
                            <button
                              onClick={() => handleCheckout(billingCycle)}
                              disabled={!paddleInitialized}
                              className={`px-8 py-3 font-semibold rounded-full transition-all duration-200 ${
                                paddleInitialized
                                  ? "bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg transform hover:scale-105"
                                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
                              }`}
                            >
                              {!paddleInitialized
                                ? "Loading..."
                                : billingCycle === "lifetime"
                                ? "Buy Lifetime Access"
                                : `Start ${
                                    billingCycle === "monthly"
                                      ? "Monthly"
                                      : "Yearly"
                                  } Plan`}
                            </button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </div>
              </div>
            </section>
          )}
        </main>

        <footer className="bg-gray-50 border-t border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-8">
            <div className="text-center text-gray-600">
              <p>
                © {new Date().getFullYear()} Notes & Tasks. Made with ❤️ for
                productivity enthusiasts.
              </p>
              <p className="mt-2 text-sm">
  <a href="/privacy_policy.html" className="hover:underline">Privacy Policy</a>
  <span className="mx-2">·</span>
  <a href="/terms_of_service.html" className="hover:underline">Terms of Service</a>
  <span className="mx-2">·</span>
  <a href="https://github.com/dushkin/My-Notes-and-Tasks" target="_blank" rel="noopener noreferrer" className="hover:underline">GitHub</a>
  <span className="mx-2">·</span>
  <a href="mailto:support@notask.co" className="hover:underline">Support</a>
</p>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}
