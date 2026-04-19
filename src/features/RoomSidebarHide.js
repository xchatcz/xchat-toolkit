/**
 * Skryje černý rozevírací sidebar v místnosti (elementy #ffc a #ffd).
 * Původní userscript: `xchat-room-sidebar-hide.user.js`.
 */

import { Feature } from '../core/Feature.js';

const CSS = '#ffc, #ffd { display: none !important; }';

export class RoomSidebarHide extends Feature {
  static id = 'room-sidebar-hide';
  static name = 'Skrýt sidebar v místnosti';
  static description = 'Skryje černý rozevírací sidebar v místnosti.';
  static matches = [/\/modchat(?:$|[/?])/];
  static runAt = 'start';

  run() {
    const style = document.createElement('style');
    style.textContent = CSS;
    style.dataset.xchatToolkit = 'room-sidebar-hide';
    (document.head || document.documentElement).appendChild(style);
  }
}
