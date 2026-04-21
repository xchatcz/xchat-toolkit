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
  /**
   * Volitelná barva hlavního textu zpráv v message boardu (`contentBg`).
   * Nastavuje se pouze u skinů, kde je i pozadí zpráv tmavé (Matrix, Černý,
   * Šedočerný). POZOR: 3D Párty má tmavou lištu, ale světlé pozadí zpráv,
   * takže tuto barvu nenastavuje – pro něj slouží jen `chromeText` níže.
   */
  textColor?: string;
  /**
   * Volitelná barva "tlumeného" textu v message boardu – časová známka,
   * systémové hlášky. Používá se tam, kde běžné `rgba(0,0,0,.5)` na tmavém
   * pozadí zpráv zmizí.
   */
  textMute?: string;
  /**
   * Volitelná barva textu v „chromu" aplikace (sidebar, infostrip, taby).
   * Používá se u skinů, které mají tmavou lištu, ale nemusí mít tmavé
   * pozadí zpráv (3D Párty). Pokud není uvedena, spadne se na `textColor`
   * a dál na hardcoded fallback v SCSS.
   */
  chromeText?: string;
  /** Tlumená varianta `chromeText` (labely, idle časy v sidebaru apod.). */
  chromeTextMute?: string;
}

export interface SkinMeta {
  id: SkinId;
  name: string;
  palette: SkinPalette;
}

/** Vytvoří paletu z 8-prvkového pole (pořadí viz hlavička). */
const palette = (
  raw: readonly [string, string, string, string, string, string, string, string],
  extras: Partial<Pick<SkinPalette, 'textColor' | 'textMute' | 'chromeText' | 'chromeTextMute'>> = {},
): SkinPalette => ({
  sidebarDark: raw[0],
  sidebarLight: raw[1],
  composeBg: raw[2],
  infoStrip: raw[3],
  linkHover: raw[4],
  link: raw[5],
  contentBg: raw[6],
  accent: raw[7],
  ...extras,
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
  { id: 9, name: '3D Párty', palette: palette(
    ['#EA984E', '#333333', '#E88E3F', '#292929', '#666667', '#E67222', '#E0E1E3', '#5A2F10'],
    // Tmavý sidebar + infostrip, ale SVĚTLÉ pozadí zpráv (#E0E1E3).
    // Proto NEnastavujeme textColor/textMute (ať systémové hlášky zůstanou
    // tmavé a čitelné na světlém boardu), jen chromeText pro lištu.
    { chromeText: '#F2F2F4', chromeTextMute: 'rgba(255, 255, 255, 0.55)' },
  ) },
  { id: 10, name: 'Radox', palette: palette(['#B04132', '#EAC555', '#B04132', '#EAC555', '#E7E7E8', '#3354DA', '#CCCCCD', '#5F1F12']) },
  { id: 11, name: 'Fotbal', palette: palette(
    ['#575657', '#090909', '#4D4D4E', '#101010', '#000000', '#71BD4F', '#71BD4F', '#000000'],
    // Tmavá lišta + infostrip, ale světlé pozadí zpráv (#71BD4F).
    // Nastavujeme jen chromeText – systémové hlášky v boardu zůstanou tmavé.
    { chromeText: '#F2F2F4', chromeTextMute: 'rgba(255, 255, 255, 0.55)' },
  ) },
  { id: 12, name: 'HipHop', palette: palette(
    ['#F3E585', '#1D1D1D', '#F2C94B', '#121212', '#E3D554', '#E3D554', '#2C2C2C', '#6B5F0D'],
    // Tmavý skin napříč – sidebar, infostrip i pozadí zpráv jsou tmavé.
    // Texty všude bílé, systémové hlášky lehce šedé.
    {
      textColor: '#FFFFFF', textMute: 'rgba(255, 255, 255, 0.6)',
      chromeText: '#FFFFFF', chromeTextMute: 'rgba(255, 255, 255, 0.6)',
    },
  ) },
  { id: 13, name: 'Hokej', palette: palette(['#CBDAE9', '#FEFFFF', '#AFC6DC', '#FEFFFF', '#FDFEFF', '#2C5581', '#98BCDC', '#1B366B']) },
  { id: 14, name: 'Carbon', palette: palette(
    ['#4D4D4E', '#111111', '#3F3F3F', '#0D0D0D', '#E67222', '#E67222', '#595859', '#1A1A1A'],
    // Plně tmavý skin – vše bílé, systémové hlášky lehce šedé.
    {
      textColor: '#FFFFFF', textMute: 'rgba(255, 255, 255, 0.6)',
      chromeText: '#FFFFFF', chromeTextMute: 'rgba(255, 255, 255, 0.6)',
    },
  ) },
  { id: 15, name: 'Gothic', palette: palette(
    ['#4D4D4E', '#111111', '#3F3F3F', '#0D0D0D', '#E67222', '#E67222', '#F2E7CE', '#1A1A1A'],
    // Tmavá lišta + infostrip, ale světlé pozadí zpráv (#F2E7CE).
    // Nastavujeme jen chromeText – texty v boardu zůstanou tmavé.
    { chromeText: '#FFFFFF', chromeTextMute: 'rgba(255, 255, 255, 0.6)' },
  ) },
  { id: 16, name: 'Goth girl', palette: palette(
    ['#E4EFF0', '#202020', '#C5DCDE', '#121212', '#79A18D', '#79A18D', '#396B6D', '#1F3A3C'],
    // Tmavá lišta + infostrip, ale světlé pozadí zpráv.
    // Nastavujeme jen chromeText – texty v boardu zůstanou tmavé.
    { chromeText: '#FFFFFF', chromeTextMute: 'rgba(255, 255, 255, 0.6)' },
  ) },
  // Custom skin – tmavomodrá verze Toolkitu (v2.0.41).
  // sidebarDark = tišší tmavomodrá (lišta tabů + MessageForm),
  // sidebarLight = světlý panel/uživatelé, infoStrip = TopBar + procházka info.
  { id: 26, name: 'Dark Blue', palette: palette(['#313D50', '#ECF0F1', '#313D50', '#E7E7E8', '#1B366B', '#3354DA', '#ECF0F1', '#1B366B']) },

  // ─── Tmavé/monochromatické skiny (v2.0.103) ────────────────────────────
  // Matrix: černé pozadí, zářivě zelený text – klasika.
  { id: 44, name: 'Matrix', palette: palette(
    ['#001A00', '#002B00', '#001A00', '#002B00', '#7BF244', '#7BF244', '#000000', '#003300'],
    {
      textColor: '#7BF244', textMute: '#48922E',
      chromeText: '#7BF244', chromeTextMute: '#48922E',
    },
  ) },
  // Tmavě šedý: tmavé lišty, psací pole ponechává charakteristické #CCCCCE.
  { id: 45, name: 'Tmavě šedý', palette: palette(
    ['#3A3A3C', '#54545A', '#3A3A3C', '#4A4A4E', '#1B366B', '#3354DA', '#CCCCCE', '#1A1A1C'],
    // Tmavé lišty, ale světlé pozadí zpráv (#CCCCCE).
    // Nastavujeme jen chromeText – texty v boardu zůstanou tmavé.
    { chromeText: '#FFFFFF', chromeTextMute: 'rgba(255, 255, 255, 0.6)' },
  ) },
  // Šedočerný: velmi tmavé šedé pozadí s bílým textem a teplým akcentem.
  { id: 46, name: 'Šedočerný', palette: palette(
    ['#18181A', '#2B2B2E', '#18181A', '#222224', '#FF9933', '#FFAA55', '#2B2B2E', '#0F0F10'],
    {
      textColor: '#E4E4E7', textMute: 'rgba(255, 255, 255, 0.5)',
      chromeText: '#E4E4E7', chromeTextMute: 'rgba(255, 255, 255, 0.5)',
    },
  ) },
  // Černý: plně černý skin. Texty bílé, šepty default oranžové (viz
  // override v App.scss), vlastní nick žlutě (`.xct-msg__hl` = #FFFF00).
  { id: 47, name: 'Černý', palette: palette(
    ['#050505', '#141416', '#050505', '#0E0E10', '#FF9933', '#FFA64D', '#000000', '#141416'],
    {
      textColor: '#F2F2F4', textMute: 'rgba(255, 255, 255, 0.55)',
      chromeText: '#F2F2F4', chromeTextMute: 'rgba(255, 255, 255, 0.55)',
    },
  ) },
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
export const paletteToCssVars = (p: SkinPalette): Record<string, string> => {
  const vars: Record<string, string> = {
    '--xct-sidebar-dark': p.sidebarDark,
    '--xct-sidebar-light': p.sidebarLight,
    '--xct-compose-bg': p.composeBg,
    '--xct-info-strip': p.infoStrip,
    '--xct-link-hover': p.linkHover,
    '--xct-link': p.link,
    '--xct-content-bg': p.contentBg,
    '--xct-accent': p.accent,
  };
  // Volitelné – tmavé skiny si nastavují vlastní barvy textu.
  // `--xct-text` / `--xct-text-mute` = barva v message boardu (obsahu zpráv).
  // `--xct-chrome-text` / `--xct-chrome-text-mute` = barva v liště (sidebar,
  // infostrip) – používá se samostatně, protože některé skiny (3D Párty)
  // mají tmavou lištu, ale světlé pozadí zpráv.
  if (p.textColor) vars['--xct-text'] = p.textColor;
  if (p.textMute) vars['--xct-text-mute'] = p.textMute;
  if (p.chromeText) vars['--xct-chrome-text'] = p.chromeText;
  if (p.chromeTextMute) vars['--xct-chrome-text-mute'] = p.chromeTextMute;
  return vars;
};
