/**
 * Skryje vyskakovací okno s potvrzením věku v seznamu místností.
 * Původní userscript: `xchat-disable-room-popup.user.js`.
 */

import { Feature } from '../core/Feature.js';

export class DisableRoomPopup extends Feature {
  static id = 'disable-room-popup';
  static name = 'Historie místností – skrýt popup';
  static description = 'Skryje vyskakovací okno s potvrzením věku v seznamu místností.';
  static matches = [/\/modchat\?.*op=roomlist/];
  static runAt = 'end';

  run() {
    const popup = document.querySelector('#modalwin');
    if (popup) popup.style.display = 'none';
  }
}
