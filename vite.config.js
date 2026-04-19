import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './src/manifest.config.js';

// POZOR: Vite 5.4+ ve výchozím stavu nepovolí CORS pro `chrome-extension://`
// origin, čímž se rozbije načítání service workeru i HMR z extension contentu.
// Níže uvedená konfigurace povoluje dev server pro MV3 rozšíření.
export default defineConfig({
  plugins: [crx({ manifest })],
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
    // Povolíme CORS pro localhost (dev náhled v prohlížeči) a pro jakékoli
    // chrome-extension:// origin (náš dev build v rozšíření).
    cors: {
      origin: [/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/, /^chrome-extension:\/\//],
    },
    // Bez explicitního originu posílá Vite dev server relativní URL,
    // což v MV3 service workeru selže. Nastavíme stabilní absolutní adresu.
    origin: 'http://localhost:5173',
    hmr: { port: 5174 },
  },
  // Vite 5.4 přidal ochranu WebSocket handshake tokenem, který v kontextu
  // rozšíření selhává – @crxjs pro dev používá `skipWebSocketTokenCheck`.
  legacy: {
    skipWebSocketTokenCheck: true,
  },
  publicDir: 'public',
});
