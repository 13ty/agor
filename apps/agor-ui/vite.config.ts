import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import viteCompression from 'vite-plugin-compression';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // Pre-compress assets with Brotli (best compression, supported by all modern browsers)
    // Deletes originals to keep npm package small: 21M → 3M
    // Main bundle served to users: 851KB (vs 3.5MB uncompressed)
    // Requires browsers from 2016+ (Chrome 50, Firefox 44, Safari 11, Edge 15)
    viteCompression({
      algorithm: 'brotliCompress',
      ext: '.br',
      threshold: 1024, // Only compress files > 1KB
      deleteOriginFile: true, // Delete uncompressed files (Brotli-only)
    }),
  ],

  // Polyfill Node.js globals for browser compatibility
  define: {
    global: 'globalThis',
  },

  // Set base path for production builds (served from /ui by daemon)
  // In development, this is ignored (uses default /)
  base: process.env.NODE_ENV === 'production' ? '/ui/' : '/',

  // Mark Node.js-only packages as external so they're not bundled
  build: {
    rollupOptions: {
      external: ['@openai/codex-sdk', '@anthropic-ai/claude-agent-sdk', '@google/gemini-cli-core'],
    },
  },

  server: {
    // Bind to 0.0.0.0 for Codespaces/Docker accessibility
    host: '0.0.0.0',
    port: 5173,
    // Watch for changes in workspace packages
    watch: {
      // Watch the @agor/core dist directory for changes
      ignored: ['!**/node_modules/@agor/core/**'],
    },
    fs: {
      // Allow serving files from the monorepo root
      allow: ['../..'],
    },
  },
});
