import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle, Loader } from 'lucide-react';
import BetaBanner from './BetaBanner';
export default function ConfirmDeletion() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('confirming'); // confirming, success, error
  const [errorMessage, setErrorMessage] = useState('');
  useEffect(() => {
    const confirmDeletion = async () => {
      try {
        const response = await fetch(`/api/account/delete-confirm/${token}`, {
          method: 'DELETE',
          credentials: 'include'
        });
        
        if (response.ok) {
          const data = await response.json();
          setStatus('success');
        } else {
          let errorText = 'Failed to confirm deletion';
          try {
            const errorData = await response.json();
            if (errorData && errorData.message) {
              errorText = errorData.message;
            }
          } catch (e) {
             errorText = response.statusText || 'An unknown server error occurred.';
          }
          setErrorMessage(errorText);
          setStatus('error');
        }
      } catch (error) {
        console.error('Confirmation error:', error);
        setErrorMessage('Network error occurred');
        setStatus('error');
      }
    };

    if (token) {
      confirmDeletion();
    } else {
      setStatus('error');
      setErrorMessage('No token provided');
    }
  }, [token]);
  if (status === 'confirming') {
    return (
      <>
        <BetaBanner variant="auth" />
        <div 
          className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4"
          style={{
            paddingTop: "var(--beta-banner-height, 0px)"
          }}
        >
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <Loader className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              Confirming Account Deletion
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Please wait while we process your request...
            </p>
          </div>
        </div>
      </>
    );
  }

  if (status === 'success') {
    return (
      <>
        <BetaBanner variant="auth" />
        <div 
          className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4"
          style={{
            paddingTop: "var(--beta-banner-height, 0px)"
          }}
        >
          <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Account Deletion Confirmed
            </h2>
            <div className="text-left bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
              <h3 className="font-medium text-yellow-800 dark:text-yellow-200 mb-2">
                What happens next:
              </h3>
              <ul className="text-sm text-yellow-700 dark:text-yellow-300 space-y-1">
                <li>• Your account is now marked for deletion</li>
                <li>• You have <strong>7 days</strong> to restore it</li>
                <li>• After 7 days, all data will be permanently deleted</li>
                <li>• You can restore your account from the settings page</li>
              </ul>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/login')}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Go to Login
              </button>
              <button
                onClick={() => navigate('/')}
                className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <BetaBanner variant="auth" />
      <div 
        className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4"
        style={{
          paddingTop: "var(--beta-banner-height, 0px)"
        }}
      >
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Invalid or Expired Link
          </h2>
          <div className="text-left bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <p className="text-red-700 dark:text-red-300 text-sm">
              <strong>Error:</strong> {errorMessage}
            </p>
            <p className="text-red-600 dark:text-red-400 text-sm mt-2">
              This deletion confirmation link may be invalid, expired, or you may not have permission to use it. </p>
          </div>
          <div className="space-y-3">
            <button
              onClick={() => navigate('/login')}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Go to Login
            </button>
            <button
              onClick={() => navigate('/')}
              className="w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              Go to Home
              </button>
          </div>
        </div>
      </div>
    </>
  );
}