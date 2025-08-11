import React, { useState, useEffect, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { App as CapacitorApp } from '@capacitor/app';
import { authFetch } from '../services/apiClient';
import '../styles/BetaBanner.css';
import packageJson from '../../package.json';

export default function BetaBanner({ variant }) {
  const [appVersion, setAppVersion] = useState(packageJson?.version || window.APP_VERSION || '0.0.0');
  const [betaStatus, setBetaStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const bannerRef = useRef(null);

  // Get native app version once (if running inside Capacitor)
  useEffect(() => {
    let cancelled = false;
    if (Capacitor?.isNativePlatform?.()) {
      CapacitorApp.getInfo()
        .then(info => {
          if (!cancelled && info?.version) setAppVersion(info.version);
        })
        .catch(() => {});
    }
    return () => { cancelled = true; };
  }, []);

  // Fetch beta status; fall back gracefully if request fails
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch('/auth/beta-status', { method: 'GET' });
        const data = await res.json();
        if (!cancelled) setBetaStatus(data);
      } catch (err) {
        console.error('BetaBanner: beta-status fetch failed:', err);
        // Fallback: keep banner visible
        if (!cancelled) setBetaStatus({ betaEnabled: true, userCount: 0, limit: Infinity });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Update CSS var for banner height when visible
  useEffect(() => {
    const el = bannerRef.current;
    const betaEnabled = betaStatus?.betaEnabled ?? true;
    if (el && !isLoading && betaEnabled) {
      const h = el.offsetHeight || el.scrollHeight || 0;
      document.documentElement.style.setProperty('--beta-banner-height', `${h}px`);
    } else {
      document.documentElement.style.setProperty('--beta-banner-height', '0px');
    }
    return () => {
      document.documentElement.style.setProperty('--beta-banner-height', '0px');
    };
  }, [isLoading, betaStatus, variant]);

  // Loading gate
  if (isLoading) return null;

  // Respect flag if backend disables banner explicitly
  const betaEnabled = betaStatus?.betaEnabled ?? true;
  if (!betaEnabled) return null;

  const userCount = Number(betaStatus?.userCount ?? 0);
  const limit = Number.isFinite(Number(betaStatus?.limit)) ? Number(betaStatus.limit) : Infinity;
  const isFull = userCount >= limit;

  let statusText = '';
  if (isFull && (variant === 'landing' || variant === 'auth')) {
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
