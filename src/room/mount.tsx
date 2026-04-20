/**
 * mount – entry point React aplikace pro stránku místnosti.
 *
 * Spouští se z RoomApp feature. Smaže původní DOM od XChatu (tabula rasa),
 * vloží <html class="xct-root"> → <body> → #xct-app a do něj zamountuje
 * celou React aplikaci.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import App from './App';
import type { RoomOptions } from '../features/Room/RoomApp';
import { paletteToCssVars, getSkin, DEFAULT_SKIN_ID } from './skins/palettes';
import { RoomController } from './services/RoomController';
import { NAMESPACE_CLASS } from './styles/namespace';
import './styles/global.scss';

let mounted: Root | null = null;
let controller: RoomController | null = null;

export const mountRoom = (opts: RoomOptions): void => {
  if (mounted) return; // Idempotentní – feature bootstrap může volat víckrát.
  // eslint-disable-next-line no-console
  console.log('[XChat Toolkit] mountRoom', { url: location.href, opts });

  // Prepare() už nám zajistil prázdné <head>/<body>. Pro jistotu sem tam
  // znovu pročistíme (pro případ, že run() běží bez prepare fáze, třeba
  // po navigaci v rámci SPA).
  //
  // POZOR: <style> tagy NESMAZAT – to jsou styly injektované Vite/CRXJS
  // z našich SCSS importů. Smažeme jen <link> stylesheety mimo naši origin
  // (tj. xchat.cz CSS).
  document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach((n) => {
    const href = n.href || '';
    if (!href) return;
    if (href.startsWith('chrome-extension://')) return;
    if (href.startsWith('http://localhost:') || href.startsWith('http://127.0.0.1')) return;
    n.remove();
  });
  if (!document.body) {
    document.documentElement.appendChild(document.createElement('body'));
  }
  // Odstraníme jen případné cizí elementy v body; naše <div id="xct-app">
  // pak stejně znovu vytvoříme.
  document.body.querySelectorAll(':scope > :not(style)').forEach((n) => n.remove());
  document.documentElement.classList.add(NAMESPACE_CLASS);

  // Inicializujeme CSS proměnné z vybrané skin palety.
  const skin = getSkin(opts.skinId ?? DEFAULT_SKIN_ID);
  applyCssVars(document.documentElement, paletteToCssVars(skin.palette));

  // Kontejner pro React app.
  const host = document.createElement('div');
  host.id = 'xct-app';
  document.body.appendChild(host);

  controller = new RoomController();
  mounted = createRoot(host);
  mounted.render(
    <React.StrictMode>
      <App options={opts} controller={controller} />
    </React.StrictMode>,
  );
};

const applyCssVars = (el: HTMLElement, vars: Record<string, string>): void => {
  for (const [k, v] of Object.entries(vars)) {
    el.style.setProperty(k, v);
  }
};

export default mountRoom;
