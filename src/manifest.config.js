// Vygeneruje manifest V3 pro @crxjs/vite-plugin.
// Autor: Jan Elznic <jan@elznic.com> (https://janelznic.cz)

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const pkg = JSON.parse(
  readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../package.json'), 'utf8'),
);

/** @type {chrome.runtime.ManifestV3} */
export default {
  manifest_version: 3,
  name: 'XChat Toolkit',
  short_name: 'XChat Toolkit',
  description: 'Kolekce vylepšení pro XChat.cz (autor: Jan Elznic)',
  version: pkg.version,
  author: pkg.author.name,
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
    service_worker: 'src/background/service-worker.js',
    type: 'module',
  },
  permissions: ['storage', 'scripting'],
  host_permissions: [
    'https://www.xchat.cz/*',
    'https://xchat.cz/*',
    'https://scripts.xchat.cz/*',
    'https://x.ximg.cz/*',
    'https://ximg.cz/*',
  ],
  content_scripts: [
    {
      matches: ['https://www.xchat.cz/*', 'https://xchat.cz/*'],
      js: ['src/content/bootstrap.js'],
      run_at: 'document_start',
      all_frames: true,
      match_about_blank: false,
    },
  ],
  web_accessible_resources: [
    {
      resources: ['src/page/*.js', 'icons/*'],
      matches: ['https://www.xchat.cz/*', 'https://xchat.cz/*'],
      use_dynamic_url: false,
    },
  ],
};
