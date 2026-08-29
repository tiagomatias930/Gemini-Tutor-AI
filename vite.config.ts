import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      // Proxy /api requests to the backend server during local development
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
          ws: true,
        },
      },
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;
            if (id.includes('@excalidraw')) return 'whiteboard-vendor';
            if (id.includes('@react-three') || id.includes('/three/')) return 'three-vendor';
            if (id.includes('/motion/')) return 'motion-vendor';
            if (id.includes('/react/') || id.includes('/react-dom/')) return 'react-vendor';
          },
        },
      },
    },
  };
});
