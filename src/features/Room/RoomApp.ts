/**
 * Feature „Místnost" – bootstrap React aplikace nad prázdným DOMem.
 *
 * Místo aby seděla v MAIN world nad existujícím frameset, React aplikace
 * běží v izolovaném content-script kontextu (má `chrome.*`) a přebírá
 * celé `<html>`. Stará DOM stránka se úplně zahazuje.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { Feature, type FeatureContext } from '../../core/Feature';
import { mountRoom } from '../../room/mount';

export interface RoomOptions {
  skinId: number;
  refreshIntervalSec: 5 | 10 | 15;
  defaultSidebarTab: 'users' | 'smilies' | 'settings' | 'ignore' | 'admin';
}

/** URL vzoru `/~$.../modchat/room/{slug}`. */
const ROOM_URL_RE = /^\/~\$[^/]+\/modchat\/room\/[^/?#]+\/?$/;

export class RoomApp extends Feature<RoomOptions> {
  readonly id = 'room-app';
  readonly name = 'Místnost – nový vzhled (React)';
  readonly description =
    'Kompletně přepsaná chatovací místnost v Reactu – postranní panely, zprávy, ignorace, smajlíci a správa.';
  readonly category = 'room' as const;
  readonly matches = [(href: string) => ROOM_URL_RE.test(new URL(href).pathname)];
  override readonly runAt = 'start';
  override readonly defaultOptions: RoomOptions = {
    skinId: 2,
    refreshIntervalSec: 5,
    defaultSidebarTab: 'users',
  };

  /**
   * Tabula rasa: dřív než cokoli začne, zabijeme načítání původní stránky
   * (frameset, inline scripty, všechno). Běží synchronně na document_start,
   * ještě před parsováním body.
   */
  override prepare(): void {
    try {
      window.stop();
    } catch {
      /* v některých prohlížečích window.stop v content scriptu hází */
    }

    const root = document.documentElement;
    // Smažeme úplně vše, co v dokumentu zatím je – <frameset>, <script>, ...
    while (root.firstChild) root.removeChild(root.firstChild);

    // Vložíme prázdné <head>/<body>, aby DOM byl validní a React měl kam mountovat.
    const head = document.createElement('head');
    const meta = document.createElement('meta');
    meta.setAttribute('charset', 'utf-8');
    head.appendChild(meta);
    const title = document.createElement('title');
    title.textContent = 'XChat – načítám místnost…';
    head.appendChild(title);

    const body = document.createElement('body');
    // Umístíme placeholder, aby stránka nebyla úplně bílá, než se React spustí.
    const placeholder = document.createElement('div');
    placeholder.id = 'xct-boot';
    placeholder.textContent = 'Načítám místnost…';
    placeholder.style.cssText =
      'padding:24px;font:14px/1.4 Segoe UI,Tahoma,sans-serif;color:#555';
    body.appendChild(placeholder);

    root.appendChild(head);
    root.appendChild(body);
  }

  run({ options }: FeatureContext<RoomOptions>): void {
    mountRoom(options);
  }
}
