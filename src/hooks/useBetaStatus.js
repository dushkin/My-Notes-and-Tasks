import { useState, useEffect } from 'react';

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
      const response = await fetch('/api/auth/beta-status');
      
      if (!response.ok) {
        throw new Error(`Failed to fetch beta status: ${response.status}`);
      }
      
      const data = await response.json();
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