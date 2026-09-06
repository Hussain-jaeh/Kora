import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// /api/* is proxied to the server so the browser never needs CORS or a token
// in development. In production, point VITE_API_URL at the deployed API.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
});
