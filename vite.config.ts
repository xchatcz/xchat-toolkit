/**
 * Vite konfigurace pro Chrome MV3 rozšíření XChat Toolkit.
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import react from '@vitejs/plugin-react';
import manifest from './src/manifest.config';

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  css: {
    preprocessorOptions: {
      scss: {
        // Vypne Dart-Sass legacy JS API warning – použijeme modern compiler.
        api: 'modern-compiler',
        silenceDeprecations: ['legacy-js-api'],
      },
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome114',
    sourcemap: true,
    rollupOptions: {
      input: {
        options: 'src/options/options.html',
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
    cors: {
      origin: [/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/, /^chrome-extension:\/\//],
    },
    origin: 'http://localhost:5173',
    hmr: { port: 5174 },
  },
  // Vite 5.4+ token check selhává pro extension WS handshake – @crxjs workaround.
  legacy: {
    skipWebSocketTokenCheck: true,
  },
  publicDir: 'public',
});
