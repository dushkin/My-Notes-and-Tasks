import React from 'react';

export default function Goodbye() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-lg text-center">
        <h1 className="text-3xl font-bold mb-4">We're sorry to see you go!</h1>
        <p className="mb-2">Your account has been permanently deleted.</p>
        <p>Thank you for trying out My Notes and Tasks.</p>
      </div>
    </div>
  );
}
