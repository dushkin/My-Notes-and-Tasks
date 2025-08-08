import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: './', // Use relative paths for assets in production builds
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version || '14.14.0'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true
      }
    },
    headers: {
      'Content-Security-Policy': `
       default-src 'self';
       script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.paddle.com https://cdn.jsdelivr.net http://cdn.jsdelivr.net https://www.googletagmanager.com https://unpkg.com https://connect.facebook.net;
       frame-src 'self' https://sandbox-buy.paddle.com https://www.youtube.com http://googleusercontent.com;
       frame-ancestors 'self' http://localhost:5173 https://sandbox-buy.paddle.com;
       connect-src 'self' http://localhost:5001 ws://localhost:5001 wss://my-notes-and-tasks-backend-dev.onrender.com wss://my-notes-and-tasks-backend.onrender.com https://my-notes-and-tasks-backend.onrender.com https://checkout.paddle.com https://checkout-service.paddle.com https://sandbox-checkout-service.paddle.com https://cdn.paddle.com https://sandbox-cdn.paddle.com http://cdn.jsdelivr.net https://cdn.jsdelivr.net https://play.google.com https://www.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://connect.facebook.net;
       img-src 'self' data: https: http://localhost:5001;
       style-src 'self' 'unsafe-inline' https://cdn.paddle.com https://sandbox-cdn.paddle.com;
       font-src 'self' data: https: http:;
     `.replace(/\s+/g, ' ').trim(),
    },
  },
  envDir: '.', // Look for .env files in the root directory
  envPrefix: 'VITE_', // Load variables prefixed with VITE_
}));