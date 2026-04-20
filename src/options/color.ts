/**
 * Color helpers – převody mezi hex/rgba a rozparsování uložené barvy.
 *
 * `<input type="color">` umí jen `#rrggbb` (bez alpha kanálu). Průhlednost
 * řešíme zvlášť přes range slider a výsledek skládáme do `rgba(r, g, b, a)`.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  /** Alpha 0–1. */
  a: number;
}

/** Vyparsuje `#rrggbb`, `#rgb`, `rgb(...)` nebo `rgba(...)` do složek. */
export const parseColor = (value: string): RgbaColor | null => {
  const v = value.trim();
  const rgbaMatch = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/i);
  if (rgbaMatch) {
    return {
      r: Number(rgbaMatch[1]),
      g: Number(rgbaMatch[2]),
      b: Number(rgbaMatch[3]),
      a: rgbaMatch[4] != null ? Number(rgbaMatch[4]) : 1,
    };
  }
  const hex6 = v.match(/^#([0-9a-f]{6})$/i);
  if (hex6) {
    const n = parseInt(hex6[1], 16);
    return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff, a: 1 };
  }
  const hex3 = v.match(/^#([0-9a-f]{3})$/i);
  if (hex3) {
    const s = hex3[1];
    const r = parseInt(s[0] + s[0], 16);
    const g = parseInt(s[1] + s[1], 16);
    const b = parseInt(s[2] + s[2], 16);
    return { r, g, b, a: 1 };
  }
  return null;
};

/** Převede RGB složky na `#rrggbb` (pro `<input type="color">`). */
export const toHex = (r: number, g: number, b: number): string => {
  const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
};

/** Složí `rgba(r, g, b, a)` (alpha zaokrouhlená na 2 desetinná místa). */
export const toRgba = (r: number, g: number, b: number, a: number): string => {
  const alpha = Math.round(a * 100) / 100;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
