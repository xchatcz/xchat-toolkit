/**
 * Paleta SVG ikonek použitých v Room UI. Vše inline – žádné externí requesty.
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import type { FC, SVGProps } from 'react';

type Icon = FC<SVGProps<SVGSVGElement>>;

const make = (paths: readonly string[], viewBox = '0 0 24 24'): Icon => {
  const Comp: Icon = ({ width = 18, height = 18, ...rest }) => (
    <svg
      viewBox={viewBox}
      width={width}
      height={height}
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...rest}
    >
      {paths.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </svg>
  );
  return Comp;
};

// ── Ikonky (minimalistické, line-style) ────────────────────────────────────

/** Obálka – vzkazy. */
export const EnvelopeIcon = make([
  'M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11A1.5 1.5 0 0 1 19.5 19h-15A1.5 1.5 0 0 1 3 17.5v-11z',
  'M3.5 6.5L12 13l8.5-6.5',
]);

/** Dveře – opustit místnost. */
export const DoorExitIcon = make([
  'M9 4h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H9',
  'M3 12h11',
  'M10 8l4 4-4 4',
]);

/** Lidé / uživatelé – klasický „user" (hlava + ramena). */
export const UsersIcon = make([
  'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  'M4 20c0-4 4-6 8-6s8 2 8 6',
]);

/** Smajlík. */
export const SmileIcon = make([
  'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z',
  'M8 14s1.5 2 4 2 4-2 4-2',
  'M9 9h.01',
  'M15 9h.01',
]);

/** Ozubené kolo – nastavení. */
export const GearIcon = make([
  'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
  'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
]);

/** Zakázáno / ignorace. */
export const BanIcon = make([
  'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z',
  'M4.93 4.93l14.14 14.14',
]);

/** Štít – správce. */
export const ShieldIcon = make([
  'M12 2l8 4v6c0 5-3.5 9.25-8 10-4.5-.75-8-5-8-10V6l8-4z',
]);

/** Lupa – vyhledávání. */
export const SearchIcon = make([
  'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16z',
  'M21 21l-4.35-4.35',
]);

/** Šipka dolů – dropdown. */
export const ChevronDownIcon = make(['M6 9l6 6 6-6']);

/** Křížek – zavřít. */
export const CloseIcon = make(['M18 6L6 18', 'M6 6l12 12']);

/** Plus – přidat (ignorace). */
export const PlusIcon = make(['M12 5v14', 'M5 12h14']);

/** Znaménko odeslat – papírové letadlo. */
export const SendIcon = make(['M22 2L11 13', 'M22 2l-7 20-4-9-9-4 20-7z']);

/** Hvězdička (plněná) – star rating. */
export const StarIcon = make([
  'M12 2l2.92 6.26 6.84.73-5.14 4.7 1.56 6.74L12 17.27 5.82 20.43l1.56-6.74-5.14-4.7 6.84-.73L12 2z',
]);

/** Mars symbol (muž). */
export const MaleIcon = make([
  'M14 10l5-5',
  'M14 5h5v5',
  'M10 22a6 6 0 1 0 0-12 6 6 0 0 0 0 12z',
]);

/** Venus symbol (žena). */
export const FemaleIcon = make([
  'M12 14a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
  'M12 14v7',
  'M9 19h6',
]);

/** Koruna – VIP. */
export const CrownIcon = make([
  'M3 7l4 5 5-8 5 8 4-5-2 12H5L3 7z',
]);

/** Domeček – místnost. */
export const HomeIcon = make([
  'M3 11l9-8 9 8',
  'M5 10v10h14V10',
]);

/** Svazek klíčů – odkaz „Klíče v místnosti". */
export const KeysIcon = make([
  'M15 7.5a3.5 3.5 0 1 1-3.464 4H8v2H6v2H3v-3l8.536-8.536A3.5 3.5 0 0 1 15 7.5z',
  'M15.25 7.75h.01',
]);
