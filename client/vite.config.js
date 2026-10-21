import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    testTimeout: 15000,
    exclude: ['**/e2e/**', '**/node_modules/**']
  },
  server: {
    port: 5173,
    watch: {
      ignored: ['**/test-results/**', '**/e2e/**', '**/.git/**']
    },
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        timeout: 310000,
        proxyTimeout: 310000
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          charts: ['recharts'],
          motion: ['framer-motion'],
          vendor: ['react', 'react-dom', 'react-router-dom', 'axios', 'zustand']
        }
      }
    }
  }
});
