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
 *   [7] = tmavý akcent skinu (bordery / ikony v Sidebaru) – doplňkové,
 *         XChat sám ho nemá, my si ho ladíme do tónu každého skinu
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
  /**
   * Tmavý akcent skinu – používá se na bordery/ikony tabů v pravém Sidebaru.
   * Pro každý skin je laděn do příslušného tónu (pro šedý = tmavomodrá,
   * pro zelený = tmavozelená, pro červený = tmavočervená atd.), aby
   * Sidebar vypadal konzistentně s daným motivem.
   */
  accent: string;
}

export interface SkinMeta {
  id: SkinId;
  name: string;
  palette: SkinPalette;
}

/** Vytvoří paletu z 8-prvkového pole (pořadí viz hlavička). */
const palette = (
  raw: readonly [string, string, string, string, string, string, string, string],
): SkinPalette => ({
  sidebarDark: raw[0],
  sidebarLight: raw[1],
  composeBg: raw[2],
  infoStrip: raw[3],
  linkHover: raw[4],
  link: raw[5],
  contentBg: raw[6],
  accent: raw[7],
});

export const SKINS: readonly SkinMeta[] = [
  // Poslední hodnota v každé paletě = tmavý akcent laděný do tónu skinu.
  { id: 2, name: 'šedý', palette: palette(['#6E7F98', '#C1C9D3', '#8291A5', '#E7E7E8', '#1B366B', '#3354DA', '#CCCCCD', '#1B366B']) },
  { id: 3, name: 'červený', palette: palette(['#E1391B', '#EFB6B4', '#E2391B', '#EFB6B4', '#1B366B', '#3354DA', '#CCCCCD', '#6B1B12']) },
  { id: 4, name: 'zelený', palette: palette(['#648330', '#E8F6CE', '#648330', '#E8F6CE', '#1B366B', '#3354DA', '#CCCCCD', '#4A5926']) },
  { id: 5, name: 'modrý', palette: palette(['#517BE2', '#C8E7FF', '#517BE2', '#C8E7FF', '#1B366B', '#3354DA', '#CCCCCD', '#1B366B']) },
  { id: 6, name: 'oranžový', palette: palette(['#EA9328', '#F3CC8E', '#EA9328', '#F3CC8E', '#1B366B', '#3354DA', '#CCCCCD', '#7A4A10']) },
  { id: 7, name: 'VyVolení', palette: palette(['#AF4031', '#EAC555', '#AF4031', '#EAC555', '#CA8335', '#AF4031', '#EAEBED', '#5F1F12']) },
  { id: 8, name: 'xchat2006', palette: palette(['#E9974B', '#F3F4F5', '#E88E3F', '#FEFFFF', '#CCCCCD', '#3354DA', '#E0E1E3', '#7A4A10']) },
  { id: 9, name: '3D Párty', palette: palette(['#EA984E', '#333333', '#E88E3F', '#292929', '#666667', '#E67222', '#E0E1E3', '#5A2F10']) },
  { id: 10, name: 'Radox', palette: palette(['#B04132', '#EAC555', '#B04132', '#EAC555', '#E7E7E8', '#3354DA', '#CCCCCD', '#5F1F12']) },
  { id: 11, name: 'Fotbal', palette: palette(['#575657', '#090909', '#4D4D4E', '#101010', '#000000', '#71BD4F', '#71BD4F', '#000000']) },
  { id: 12, name: 'HipHop', palette: palette(['#F3E585', '#1D1D1D', '#F2C94B', '#121212', '#E3D554', '#E3D554', '#2C2C2C', '#6B5F0D']) },
  { id: 13, name: 'Hokej', palette: palette(['#CBDAE9', '#FEFFFF', '#AFC6DC', '#FEFFFF', '#FDFEFF', '#2C5581', '#98BCDC', '#1B366B']) },
  { id: 14, name: 'Carbon', palette: palette(['#4D4D4E', '#111111', '#3F3F3F', '#0D0D0D', '#E67222', '#E67222', '#595859', '#1A1A1A']) },
  { id: 15, name: 'Gothic', palette: palette(['#4D4D4E', '#111111', '#3F3F3F', '#0D0D0D', '#E67222', '#E67222', '#F2E7CE', '#1A1A1A']) },
  { id: 16, name: 'Goth girl', palette: palette(['#E4EFF0', '#202020', '#C5DCDE', '#121212', '#79A18D', '#79A18D', '#396B6D', '#1F3A3C']) },
  // Custom skin – tmavomodrá verze Toolkitu (v2.0.41).
  // sidebarDark = tišší tmavomodrá (lišta tabů + MessageForm),
  // sidebarLight = světlý panel/uživatelé, infoStrip = TopBar + procházka info.
  { id: 26, name: 'Toolkit Dark Blue', palette: palette(['#313D50', '#ECF0F1', '#313D50', '#E7E7E8', '#1B366B', '#3354DA', '#ECF0F1', '#1B366B']) },
];

export const DEFAULT_SKIN_ID: SkinId = 2;

/** Najde paletu podle ID; fallback na výchozí. */
export const getSkin = (id: number): SkinMeta => {
  return SKINS.find((s) => s.id === id) ?? SKINS[0];
};

/**
 * Převede paletu na CSS custom properties objekt.
 *
 * Názvy proměnných odpovídají těm, které konzumují SCSS soubory
 * (`--xct-*`), aby paleta reálně ovlivnila vzhled. Dříve zde byly
 * `--skin-*` názvy, které nikdo nečet a paleta byla de-facto mrtvá.
 */
export const paletteToCssVars = (p: SkinPalette): Record<string, string> => ({
  '--xct-sidebar-dark': p.sidebarDark,
  '--xct-sidebar-light': p.sidebarLight,
  '--xct-compose-bg': p.composeBg,
  '--xct-info-strip': p.infoStrip,
  '--xct-link-hover': p.linkHover,
  '--xct-link': p.link,
  '--xct-content-bg': p.contentBg,
  '--xct-accent': p.accent,
});
