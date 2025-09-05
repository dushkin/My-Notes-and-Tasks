// src/components/tree/AccountPlanStatus.jsx
import React from "react";
import { Gem, Crown, Infinity, Shield } from "lucide-react";

const FREE_PLAN_ITEM_LIMIT = 100;

const AccountPlanStatus = ({ user, currentItemCount, fabComponent = null }) => {
  if (!user) return null;

  const isAdmin = () => {
    return user.role === "admin";
  };

  const isActivePlan = () => {
    if (user.subscriptionStatus === "active") return true;
    return (
      user.subscriptionStatus === "cancelled" &&
      user.subscriptionEndsAt &&
      new Date(user.subscriptionEndsAt) > new Date()
    );
  };

  const isPaidPlan = isActivePlan();
  const isFreePlan = !isAdmin() && !isPaidPlan;

  const getPlanDisplayName = () => {
    if (isAdmin()) {
      return "Admin";
    }
    if (isPaidPlan) {
      if (user.subscriptionStatus === "cancelled") {
        return "Pro (Ending Soon)";
      }
      return "Pro";
    }
    return "Free";
  };

  const getPlanIcon = () => {
    if (isAdmin()) {
      return <Shield className="w-4 h-4 text-purple-500" />;
    }
    if (isPaidPlan) {
      return <Crown className="w-4 h-4 text-yellow-500" />;
    }
    return <Gem className="w-4 h-4 text-blue-500" />;
  };

  const getItemCountDisplay = () => {
    if (isAdmin() || isPaidPlan) {
      return (
        <div className="flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400">
          <span>{currentItemCount} items</span>
          <span className="text-zinc-400 dark:text-zinc-500">•</span>
          <span className="flex items-center gap-1">
            <Infinity className="w-3 h-3" />
            <span>Unlimited</span>
          </span>
        </div>
      );
    }

    const percentage = (currentItemCount / FREE_PLAN_ITEM_LIMIT) * 100;
    const isNearLimit = percentage >= 80;
    const isAtLimit = currentItemCount >= FREE_PLAN_ITEM_LIMIT;

    return (
      <div className="space-y-1">
        <div className={`text-xs ${
          isAtLimit 
            ? "text-red-600 dark:text-red-400 font-medium" 
            : isNearLimit 
              ? "text-orange-600 dark:text-orange-400" 
              : "text-zinc-600 dark:text-zinc-400"
        }`}>
          {currentItemCount} / {FREE_PLAN_ITEM_LIMIT} items
        </div>
        {/* Progress bar */}
        <div className="w-full bg-zinc-200 dark:bg-zinc-700 rounded-full h-1.5">
          <div 
            className={`h-1.5 rounded-full transition-all duration-300 ${
              isAtLimit 
                ? "bg-red-500" 
                : isNearLimit 
                  ? "bg-orange-500" 
                  : "bg-blue-500"
            }`}
            style={{ width: `${Math.min(percentage, 100)}%` }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="sticky bottom-0 bg-zinc-50 dark:bg-zinc-800 border-t border-zinc-200 dark:border-zinc-600 p-3">
      <div className="space-y-2">
        {/* Plan Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getPlanIcon()}
            <span className={`text-sm font-medium ${
              isAdmin()
                ? "text-purple-700 dark:text-purple-400"
                : isPaidPlan 
                  ? "text-yellow-700 dark:text-yellow-400" 
                  : "text-blue-700 dark:text-blue-400"
            }`}>
              {getPlanDisplayName()}
            </span>
          </div>
          {fabComponent && (
            <div className="fab-inline-container">
              {fabComponent}
            </div>
          )}
        </div>

        {/* Instruction text for FAB */}
        {fabComponent && (
          <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
            To create a sub-item, first select a folder from the tree on the left.
          </div>
        )}

        {/* Item Count Display */}
        {getItemCountDisplay()}

        {/* Upgrade prompt for free plan only */}
        {isFreePlan && (
          <button
            onClick={() => {
              // Navigate to upgrade page - this will be handled by parent component
              window.dispatchEvent(new CustomEvent('upgrade-plan-requested'));
            }}
            className="w-full text-xs bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white py-2 px-3 rounded-md transition-all duration-200 font-medium"
          >
            Upgrade to Pro
          </button>
        )}

        {/* Expiration warning for cancelled premium */}
        {!isAdmin() && user.subscriptionStatus === "cancelled" && user.subscriptionEndsAt && (
          <div className="text-xs text-orange-600 dark:text-orange-400 text-center">
            Expires: {new Date(user.subscriptionEndsAt).toLocaleDateString()}
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountPlanStatus;