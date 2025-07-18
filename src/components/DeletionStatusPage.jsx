import React from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle } from 'lucide-react';
import BetaBanner from "./BetaBanner";

export default function DeletionStatusPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const wasSuccess = searchParams.get('success') === 'true';
  const errorCode = searchParams.get('error');

  let title = 'Account Permanently Deleted';
  let message = 'Your account and all associated data have been permanently removed. Thank you for using the application. Come back any time again!';
  let icon = <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />;

  if (!wasSuccess) {
    title = 'Account Deletion Failed';
    icon = <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />;
    switch (errorCode) {
      case 'UserNotFound':
        message = 'The user associated with this link could not be found or has already been deleted.';
        break;
      default:
        message = 'The link may be invalid or expired. Please try requesting deletion again from your settings page if you can still log in.';
        break;
    }
  }

  return (
    <>
      <BetaBanner variant="auth" />
      <div 
        className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4"
        style={{ paddingTop: "var(--beta-banner-height, 0px)" }}
      >
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          {icon}
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            {title}
          </h2>
          <div className={`text-left ${wasSuccess ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'} rounded-lg p-4 mb-6 border`}>
            <p className={`${wasSuccess ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'} text-sm`}>
              {message}
            </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/login')}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Go to Login Page
            </button>
          </div>
        </div>
      </div>
    </>
  );
}