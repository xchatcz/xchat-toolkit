/**
 * Manifest V3 pro XChat Toolkit – generuje se z package.json.
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import type { ManifestV3Export } from '@crxjs/vite-plugin';

const pkg = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../package.json'), 'utf8'),
) as { version: string; author: { name: string } };

const manifest: ManifestV3Export = {
  manifest_version: 3,
  name: 'XChat Toolkit',
  short_name: 'XChat Toolkit',
  description: 'Kolekce vylepšení pro XChat.cz (autor: Jan Elznic)',
  version: pkg.version,
  author: { email: 'jan@elznic.com' },
  icons: {
    16: 'icons/icon-16.png',
    32: 'icons/icon-32.png',
    48: 'icons/icon-48.png',
    128: 'icons/icon-128.png',
    256: 'icons/icon-256.png',
  },
  action: {
    default_title: 'XChat Toolkit – Nastavení',
    default_icon: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
  },
  options_ui: {
    page: 'src/options/options.html',
    open_in_tab: true,
  },
  background: {
    service_worker: 'src/background/service-worker.ts',
    type: 'module',
  },
  permissions: ['storage', 'scripting'],
  host_permissions: [
    'https://www.xchat.cz/*',
    'https://xchat.cz/*',
    'https://scripts.xchat.cz/*',
    'https://x.ximg.cz/*',
    'https://x3.ximg.cz/*',
    'https://ximg.cz/*',
    'https://fotoalba.xchat.cz/*',
  ],
  content_scripts: [
    // MAIN-world stub – musí běžet ÚPLNĚ první, ještě před inline skripty
    // xchatu, jinak neutiší spam „document.domain mutation is ignored".
    {
      matches: ['https://www.xchat.cz/*', 'https://xchat.cz/*'],
      js: ['src/content/suppress-domain.ts'],
      run_at: 'document_start',
      world: 'MAIN',
      all_frames: true,
      match_about_blank: false,
    },
    // Pre-bootstrap (ISOLATED) – synchronní non-module script, který
    // okamžitě schová původní DOM a nahodí spinner. Musí běžet PŘED
    // bootstrap.ts, jinak async ES-modul loader nestihne zabránit
    // vykreslení původního framesetu.
    {
      matches: ['https://www.xchat.cz/*', 'https://xchat.cz/*'],
      js: ['src/content/pre-bootstrap.ts'],
      run_at: 'document_start',
      all_frames: false,
      match_about_blank: false,
    },
    {
      matches: ['https://www.xchat.cz/*', 'https://xchat.cz/*'],
      js: ['src/content/bootstrap.ts'],
      run_at: 'document_start',
      all_frames: false,
      match_about_blank: false,
    },
  ],
  web_accessible_resources: [
    {
      resources: ['assets/*', 'icons/*'],
      matches: ['https://www.xchat.cz/*', 'https://xchat.cz/*'],
      use_dynamic_url: false,
    },
  ],
};

export default manifest;
