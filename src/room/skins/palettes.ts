/**
 * Barevné palety skinů XChatu – převzato ze stránky „Nastavení místnosti".
 *
 * Pořadí hodnot v každé paletě odpovídá sémantice, kterou XChat používá:
 *   [0] = tmavé pozadí pravého sloupce (header/sidebar-dark)
 *   [1] = světlé pozadí pravého sloupce (sidebar-light)
 *   [2] = pozadí psacího pole dole (compose-bg)
 *   [3] = barva spodního proužku s informacemi o místnosti (info-strip)
 *   [4] = tmavší barva odkazu (hover / border)
 *   [5] = světlejší barva odkazu bez hover
 *   [6] = pozadí místnosti (content-bg)
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import type { SkinId } from '../../api/types';

export interface SkinPalette {
  sidebarDark: string;
  sidebarLight: string;
  composeBg: string;
  infoStrip: string;
  linkHover: string;
  link: string;
  contentBg: string;
}

export interface SkinMeta {
  id: SkinId;
  name: string;
  palette: SkinPalette;
}

/** Vytvoří paletu z 7-prvkového pole (pořadí viz hlavička). */
const palette = (raw: readonly [string, string, string, string, string, string, string]): SkinPalette => ({
  sidebarDark: raw[0],
  sidebarLight: raw[1],
  composeBg: raw[2],
  infoStrip: raw[3],
  linkHover: raw[4],
  link: raw[5],
  contentBg: raw[6],
});

export const SKINS: readonly SkinMeta[] = [
  { id: 2, name: 'šedý', palette: palette(['#6E7F98', '#C1C9D3', '#8291A5', '#E7E7E8', '#1B366B', '#3354DA', '#CCCCCD']) },
  { id: 3, name: 'červený', palette: palette(['#E1391B', '#EFB6B4', '#E2391B', '#EFB6B4', '#1B366B', '#3354DA', '#CCCCCD']) },
  { id: 4, name: 'zelený', palette: palette(['#648330', '#E8F6CE', '#648330', '#E8F6CE', '#1B366B', '#3354DA', '#CCCCCD']) },
  { id: 5, name: 'modrý', palette: palette(['#517BE2', '#C8E7FF', '#517BE2', '#C8E7FF', '#1B366B', '#3354DA', '#CCCCCD']) },
  { id: 6, name: 'oranžový', palette: palette(['#EA9328', '#F3CC8E', '#EA9328', '#F3CC8E', '#1B366B', '#3354DA', '#CCCCCD']) },
  { id: 7, name: 'VyVolení', palette: palette(['#AF4031', '#EAC555', '#AF4031', '#EAC555', '#CA8335', '#AF4031', '#EAEBED']) },
  { id: 8, name: 'xchat2006', palette: palette(['#E9974B', '#F3F4F5', '#E88E3F', '#FEFFFF', '#CCCCCD', '#3354DA', '#E0E1E3']) },
  { id: 9, name: '3D Párty', palette: palette(['#EA984E', '#333333', '#E88E3F', '#292929', '#666667', '#E67222', '#E0E1E3']) },
  { id: 10, name: 'Radox', palette: palette(['#B04132', '#EAC555', '#B04132', '#EAC555', '#E7E7E8', '#3354DA', '#CCCCCD']) },
  { id: 11, name: 'Fotbal', palette: palette(['#575657', '#090909', '#4D4D4E', '#101010', '#000000', '#71BD4F', '#71BD4F']) },
  { id: 12, name: 'HipHop', palette: palette(['#F3E585', '#1D1D1D', '#F2C94B', '#121212', '#E3D554', '#E3D554', '#2C2C2C']) },
  { id: 13, name: 'Hokej', palette: palette(['#CBDAE9', '#FEFFFF', '#AFC6DC', '#FEFFFF', '#FDFEFF', '#2C5581', '#98BCDC']) },
  { id: 14, name: 'Carbon', palette: palette(['#4D4D4E', '#111111', '#3F3F3F', '#0D0D0D', '#E67222', '#E67222', '#595859']) },
  { id: 15, name: 'Gothic', palette: palette(['#4D4D4E', '#111111', '#3F3F3F', '#0D0D0D', '#E67222', '#E67222', '#F2E7CE']) },
  { id: 16, name: 'Goth girl', palette: palette(['#E4EFF0', '#202020', '#C5DCDE', '#121212', '#79A18D', '#79A18D', '#396B6D']) },
];

export const DEFAULT_SKIN_ID: SkinId = 2;

/** Najde paletu podle ID; fallback na výchozí. */
export const getSkin = (id: number): SkinMeta => {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
};

/** Převede paletu na CSS custom properties objekt. */
export const paletteToCssVars = (p: SkinPalette): Record<string, string> => ({
  '--skin-sidebar-dark': p.sidebarDark,
  '--skin-sidebar-light': p.sidebarLight,
  '--skin-compose-bg': p.composeBg,
  '--skin-info-strip': p.infoStrip,
  '--skin-link-hover': p.linkHover,
  '--skin-link': p.link,
  '--skin-content-bg': p.contentBg,
});
