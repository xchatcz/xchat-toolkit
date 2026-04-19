/**
 * Oblíbení uživatelé (VIP z Poznámek) v seznamu uživatelů v místnosti.
 * Původní userscript: `xchat-room-favourite-users.js` (Elza).
 */

import { Feature } from '../core/Feature.js';
import { startFavouriteUsersLegacy } from './legacy/favouriteUsersLegacy.js';

export class FavouriteUsers extends Feature {
  static id = 'favourite-users';
  static name = 'Oblíbení uživatelé (VIP z Poznámek)';
  static description =
    'Přidá v seznamu uživatelů sekci „Oblíbení" s uživateli označenými jako VIP v Poznámkách, kteří jsou právě online v jiné místnosti.';
  static matches = [/\/modchat\?.*op=userspage/];
  static runAt = 'end';

  run() {
    startFavouriteUsersLegacy();
  }
}
