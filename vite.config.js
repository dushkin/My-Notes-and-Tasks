import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [react(), basicSsl()],
  resolve: {
    alias: {
      
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    headers: {
      'Content-Security-Policy': `
        default-src 'self';
		script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.paddle.com https://www.googletagmanager.com;
        frame-src 'self' https://sandbox-buy.paddle.com https://www.youtube.com http://googleusercontent.com;
        frame-ancestors 'self' http://localhost:5173 https://localhost:5173 https://sandbox-buy.paddle.com;
        connect-src 'self' http://localhost:5001 https://localhost:5001 https://my-notes-and-tasks-backend.onrender.com https://checkout.paddle.com https://checkout-service.paddle.com https://sandbox-checkout-service.paddle.com https://play.google.com;
        img-src 'self' data: https: http://localhost:5001;
        style-src 'self' 'unsafe-inline' https://cdn.paddle.com https://sandbox-cdn.paddle.com;
      `.replace(/\s+/g, ' ').trim(),
    },
  },
});