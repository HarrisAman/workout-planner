import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Proxies /api to the Express server so the browser never needs CORS or secrets.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:4000' } },
});
