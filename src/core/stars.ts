/**
 * Pořadí hvězdiček na XChatu.
 *
 * Hodnoty hvězdiček jsou bitové flagy z URL obrázku `…/star/x{N}.gif`,
 * takže je NELZE porovnávat číselně – nejvyšší hodnost (černá) má
 * nejnižší číslo (1). Řazení proto řešíme přes explicitní žebříček.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import type { Star } from '../api/types';

/** Vzestupně podle hodnosti: žádná → modrá → zelená → žlutá → červená → černá. */
export const STAR_ORDER: readonly Star[] = [0, 2, 4, 8, 16, 1];

/** Pořadí hvězdičky v žebříčku (0 = žádná, 5 = černá). */
export const starRank = (star: Star | number): number => {
  const i = STAR_ORDER.indexOf(star as Star);
  return i < 0 ? 0 : i;
};

/** Zelená a vyšší (zelená, žlutá, červená, černá) = administrátor XChatu. */
export const isAdminStar = (star: Star | number): boolean =>
  starRank(star) >= STAR_ORDER.indexOf(4);
