/**
 * Oblíbení smajlíci – storage helpers nad `chrome.storage.sync`.
 *
 * Seznam je sdílený napříč:
 *   • stránkou `/settings/smiles.php` (checkbox „Oblíbený" v každém řádku +
 *     pravý box s náhledy),
 *   • Sidebarem v místnosti (tab „Smajlíci" → podzáložka „Oblíbení").
 *
 * Maximální počet je {@link FAVOURITE_SMILEYS_MAX} (viz `superAdmins.ts`).
 * Pořadí v poli odpovídá pořadí, jak uživatel přidával (nejstarší první).
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { FAVOURITE_SMILEYS_MAX } from './superAdmins';

export const FAVOURITE_SMILEYS_STORAGE_KEY = 'xchatToolkitFavouriteSmileys';

export interface FavouriteSmileys {
  /** Čísla smajlíků v pořadí přidání (nejstarší první). */
  nums: number[];
}

const EMPTY: FavouriteSmileys = { nums: [] };

const sanitize = (raw: unknown): FavouriteSmileys => {
  if (!raw || typeof raw !== 'object') return { nums: [] };
  const nums = (raw as { nums?: unknown }).nums;
  if (!Array.isArray(nums)) return { nums: [] };
  const out: number[] = [];
  const seen = new Set<number>();
  for (const v of nums) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) continue;
    const i = Math.floor(n);
    if (seen.has(i)) continue;
    seen.add(i);
    out.push(i);
    if (out.length >= FAVOURITE_SMILEYS_MAX) break;
  }
  return { nums: out };
};

export const loadFavouriteSmileys = async (): Promise<FavouriteSmileys> => {
  const raw = await chrome.storage.sync.get(FAVOURITE_SMILEYS_STORAGE_KEY);
  return sanitize(raw?.[FAVOURITE_SMILEYS_STORAGE_KEY]);
};

export const saveFavouriteSmileys = async (fav: FavouriteSmileys): Promise<void> => {
  await chrome.storage.sync.set({
    [FAVOURITE_SMILEYS_STORAGE_KEY]: sanitize(fav),
  });
};

export type FavouriteSmileysListener = (fav: FavouriteSmileys) => void;

export const onFavouriteSmileysChanged = (
  listener: FavouriteSmileysListener,
): (() => void) => {
  const handler = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: chrome.storage.AreaName,
  ): void => {
    if (area !== 'sync') return;
    const change = changes[FAVOURITE_SMILEYS_STORAGE_KEY];
    if (!change) return;
    listener(sanitize(change.newValue ?? EMPTY));
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
};

export type AddFavouriteResult = 'added' | 'exists' | 'full';

/** Přidá smajlíka mezi oblíbené. Neduplikuje; respektuje limit. */
export const addFavouriteSmiley = async (num: number): Promise<AddFavouriteResult> => {
  const fav = await loadFavouriteSmileys();
  if (fav.nums.includes(num)) return 'exists';
  if (fav.nums.length >= FAVOURITE_SMILEYS_MAX) return 'full';
  fav.nums.push(num);
  await saveFavouriteSmileys(fav);
  return 'added';
};

/** Odebere smajlíka z oblíbených. */
export const removeFavouriteSmiley = async (num: number): Promise<void> => {
  const fav = await loadFavouriteSmileys();
  const idx = fav.nums.indexOf(num);
  if (idx < 0) return;
  fav.nums.splice(idx, 1);
  await saveFavouriteSmileys(fav);
};
