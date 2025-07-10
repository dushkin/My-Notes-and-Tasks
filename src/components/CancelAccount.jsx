import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { authFetch } from "../services/apiClient";

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

export default function CancelAccount() {
  const query = useQuery();
  const token = query.get('token');
  const navigate = useNavigate();
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const confirmDeletion = async (token) => {
    try {
      setStatus('loading');
      const res = await authFetch(`/api/account/delete?token=${token}`, {
        method: 'GET',
      });
      if (res.ok) {
        navigate('/goodbye');
      } else {
        const data = await res.json();
        throw new Error(data.message || 'Deletion failed');
      }
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  const requestDeletion = async () => {
    try {
      setStatus('loading');
      const res = await authFetch('/api/account/delete-request', { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Request failed');
      }
      setStatus('sent');
    } catch (err) {
      setError(err.message);
      setStatus('error');
    }
  };

  useEffect(() => {
    if (token) {
      confirmDeletion(token);
    }
  }, [token]);

  if (token) {
    if (status === 'loading') return <div>Deleting your account...</div>;
    if (status === 'error') return <div>Error: {error}</div>;
    return null;
  }

  return (
    <div className="p-4">
      {status === 'idle' && (
        <button
          className="px-4 py-2 bg-red-600 text-white rounded"
          onClick={requestDeletion}
        >
          Send account deletion email
        </button>
      )}
      {status === 'loading' && <div>Sending request...</div>}
      {status === 'sent' && <div>Check your email for the deletion link.</div>}
      {status === 'error' && <div className="text-red-600">Error: {error}</div>}
    </div>
  );
}
