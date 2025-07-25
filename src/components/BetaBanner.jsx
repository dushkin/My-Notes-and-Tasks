import React, { useState, useEffect, useRef } from 'react';
import { authFetch } from '../services/apiClient'; // 👈 IMPORT apiClient
import '../styles/BetaBanner.css';
import packageJson from '../../package.json';

export default function BetaBanner({ variant }) {
  const [betaStatus, setBetaStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const bannerRef = useRef(null);

  useEffect(() => {
    const fetchBetaStatus = async () => {
      try {
        // 👇 USE authFetch, which handles the URL and /api prefix
        const response = await authFetch('/auth/beta-status');
        
        if (response.ok) {
           const data = await response.json();
          setBetaStatus(data);
        } else {
          console.warn('Beta API failed with status:', response.status);
        }
      } catch (error) {
        console.error('BetaBanner: Failed to fetch beta status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchBetaStatus();
  }, []);

  // Set CSS variable for banner height based on actual banner height
  useEffect(() => {
    if (!isLoading && betaStatus?.betaEnabled && bannerRef.current) {
      // Measure the actual height of the banner
      const bannerHeight = bannerRef.current.offsetHeight;
      document.documentElement.style.setProperty('--beta-banner-height', `${bannerHeight}px`);
    } else {
      // Banner is hidden, set height to 0
      document.documentElement.style.setProperty('--beta-banner-height', '0px');
    }

    // Cleanup on unmount
    return () => {
      document.documentElement.style.setProperty('--beta-banner-height', '0px');
    };
  }, [isLoading, betaStatus?.betaEnabled]);

  // Don't show banner if beta is not enabled or still loading
  if (isLoading || !betaStatus?.betaEnabled) {
    return null;
  }

  const appVersion = packageJson.version;
  const isFull = betaStatus.userCount >= betaStatus.limit;

  let statusText = '';
  if (isFull && (variant === 'landing' || variant === 'auth')) {
    // Only show "quota full" message on public/auth pages when full
    statusText = 'Registration quota is full. Check again later.';
  }

  return (
    <div 
      ref={bannerRef}
      className={`beta-banner ${variant ? `beta-banner--${variant}` : ''}`}
    >
      🚧 <strong>BETA v{appVersion}</strong> {statusText}
    </div>
  );
}