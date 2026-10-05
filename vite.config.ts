/// <reference types="vitest" />
import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { handleSharedAlbumRequest } from './server/sharedAlbum.mjs';

/**
 * Dev-server route for shared albums. The same handler runs in the production
 * helper (server/index.mjs), so both fetch Google directly instead of relying
 * on a public CORS relay.
 */
function sharedAlbumPlugin(): Plugin {
  return {
    name: 'shared-album-proxy',
    configureServer(server) {
      server.middlewares.use('/api/shared-album', (req, res, next) => {
        if (req.method !== 'POST') return next();
        void handleSharedAlbumRequest(req, res);
      });
    },
  };
}

const helper = { target: `http://localhost:${process.env.HELPER_PORT ?? 4000}`, changeOrigin: false };

export default defineConfig({
  // GitHub Pages serves a project site from /<repo-name>/, so the deploy
  // workflow sets VITE_BASE. Self-hosted builds (npm start) serve from root.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), sharedAlbumPlugin()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
  server: {
    port: 3000,
    host: true,
    // Routes that keep state (the phone-to-TV inbox, Google pairing) live in
    // the helper, a separate local process (npm run helper).
    proxy: {
      '/api/send': helper, // also /api/send-code
      '/api/inbox': helper,
      '/api/ambient': helper,
    },
  },
});
