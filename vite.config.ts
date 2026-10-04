/// <reference types="vitest" />
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleSharedAlbumRequest } from './server/sharedAlbumProxy.mjs';

/**
 * Dev-server route for shared albums. The same handler runs in the production
 * helper (server/index.mjs), so both fetch Google directly instead of relying
 * on a public CORS relay.
 */
function sharedAlbumProxyPlugin(): Plugin {
  return {
    name: 'shared-album-proxy',
    configureServer(server) {
      server.middlewares.use('/api/fetch-shared-album', (req, res) => {
        void handleSharedAlbumRequest(req, res);
      });
    },
  };
}

export default defineConfig({
  // GitHub Pages serves a project site from /<repo-name>/, so the deploy
  // workflow sets VITE_BASE. Self-hosted builds (npm start) serve from root.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), sharedAlbumProxyPlugin()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
  server: {
    port: 3000,
    host: true,
    proxy: {
      // The Ambient helper holds the Google client secret, which a browser
      // cannot. It runs as a separate local process (npm run helper).
      '/api/ambient': {
        target: `http://localhost:${process.env.HELPER_PORT ?? 4000}`,
        changeOrigin: false,
      },
    },
  },
});
