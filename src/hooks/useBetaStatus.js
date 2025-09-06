import { useState, useEffect } from 'react';
import { authFetch } from '../services/apiClient';

export const useBetaStatus = () => {
  const [betaStatus, setBetaStatus] = useState({
    userCount: 0,
    limit: 50,
    registrationOpen: true,
    betaEnabled: false,
    isLoading: true,
    error: null
  });

  const fetchBetaStatus = async () => {
    try {
      setBetaStatus(prev => ({ ...prev, isLoading: true, error: null }));
      
      // Use authFetch, path does NOT include /api
      // authFetch already handles all response parsing and error handling
      const data = await authFetch('/auth/beta-status');
      setBetaStatus(prev => ({
        ...prev,
        ...data,
        isLoading: false
      }));
      return data;
    } catch (error) {
      console.error('Error fetching beta status:', error);
      setBetaStatus(prev => ({
        ...prev,
        isLoading: false,
        error: error.message
      }));
      return null;
    }
  };

  useEffect(() => {
    fetchBetaStatus();
  }, []);

  return {
    ...betaStatus,
    refreshStatus: fetchBetaStatus
  };
};