/**
 * useVzkazyCount – polling počtu nepřečtených vzkazů (offline zpráv).
 *
 * Jednou za 15 s stáhne domovskou stránku `https://www.xchat.cz/~{xhash}/`,
 * najde v HTML odkaz `<a title="Vzkazy">Vzkazy (X/Y)</a>` a vrátí číslo X
 * (počet před lomítkem = nepřečtené).
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useEffect, useState } from 'react';
import { XChatHttp, XChatUrls } from '../../api/XChatApi';

const POLL_MS = 15_000;

/** Vytáhne číslo před lomítkem z řetězce jako "Vzkazy (1/102)". */
const parseCount = (html: string): number | null => {
  // Hledáme link s title="Vzkazy" a z jeho obsahu čteme "(X/Y)".
  const m = html.match(/title="Vzkazy"[^>]*>\s*Vzkazy\s*\((\d+)\s*\/\s*\d+\)/i);
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  return Number.isFinite(n) ? n : null;
};

export const useVzkazyCount = (xhash: string | undefined): number | null => {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (!xhash) return;
    let cancelled = false;
    const url = `${XChatUrls.hashPrefix(xhash)}/`;

    const tick = async (): Promise<void> => {
      try {
        const html = await XChatHttp.fetchIsoText(url);
        if (cancelled) return;
        const n = parseCount(html);
        if (n !== null) setCount(n);
      } catch {
        // Tiché selhání – badge prostě zůstane na poslední známé hodnotě.
      }
    };

    void tick();
    const id = window.setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [xhash]);

  return count;
};
