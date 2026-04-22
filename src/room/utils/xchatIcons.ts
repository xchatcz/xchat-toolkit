/**
 * XChat ikonky uživatelů – hvězdička a pohlaví + lidsky čitelné popisky.
 *
 * Centralizováno pro opakované použití v UsersTab, AdminsOnlineTab a všude,
 * kde kreslíme user-řádek ve stylu původního XChatu (ximg.cz GIFy).
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import type { Sex, Star } from '../../api/types';

const XCHAT_IMG = 'https://ximg.cz/x4';

export const XCHAT_ICONS = {
  star: {
    none: `${XCHAT_IMG}/star/x0.gif`,
    black: `${XCHAT_IMG}/star/x1.gif`,
    blue: `${XCHAT_IMG}/star/x2.gif`,
    green: `${XCHAT_IMG}/star/x4.gif`,
    yellow: `${XCHAT_IMG}/star/x8.gif`,
    red: `${XCHAT_IMG}/star/x16.gif`,
  },
  sex: {
    male: `${XCHAT_IMG}/rm/mn.gif`,
    female: `${XCHAT_IMG}/rm/wn.gif`,
    maleCert: `${XCHAT_IMG}/rm/mn_c.gif`,
    femaleCert: `${XCHAT_IMG}/rm/wn_c.gif`,
  },
} as const;

/** URL hvězdičky podle číselného flagu z XChatu (0 = prázdný pixel). */
export const starUrl = (star: Star | number): string => {
  switch (star) {
    case 1: return XCHAT_ICONS.star.black;
    case 2: return XCHAT_ICONS.star.blue;
    case 4: return XCHAT_ICONS.star.green;
    case 8: return XCHAT_ICONS.star.yellow;
    case 16: return XCHAT_ICONS.star.red;
    default: return XCHAT_ICONS.star.none;
  }
};

/** Popisek hvězdičky pro title atribut. */
export const starTitle = (star: Star | number): string => {
  switch (star) {
    case 1: return 'VIP uživatel';
    case 2: return 'Premium uživatel';
    case 4: return 'Administrátor ve zkušební době';
    case 8: return 'Administrátor';
    case 16: return 'Administrátor – Vedení XChat týmu';
    default: return '';
  }
};

/** URL pohlaví: certifikovaná verze má sufix `_c`. */
export const sexUrl = (sex: Sex | number, certified: boolean): string => {
  if (sex === 1) return certified ? XCHAT_ICONS.sex.femaleCert : XCHAT_ICONS.sex.female;
  return certified ? XCHAT_ICONS.sex.maleCert : XCHAT_ICONS.sex.male;
};

/** Popisek pohlaví pro title atribut. */
export const sexTitle = (sex: Sex | number, certified: boolean): string => {
  if (sex === 1) return certified ? 'Certifikovaná žena' : 'Žena';
  return certified ? 'Certifikovaný muž' : 'Muž';
};
