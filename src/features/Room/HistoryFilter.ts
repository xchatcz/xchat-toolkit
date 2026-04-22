/**
 * HistoryFilter – filtr „klasické" historie místnosti (room/history.html).
 *
 * Stránka sype obsah přes `document.write()` z `window.opener.top.histbuff`.
 * Výstup je plochý proud textových uzlů (čas) + `<font color>` obalujících
 * `<span class="umsg_wsystem">` zpráv + `<br>` oddělovač.
 *
 * V historii se opakovaně vyskytují „System->Nick: Špatný příkaz" hlášky,
 * které uživatele nezajímají. Tento feature je po načtení stránky odstraní
 * i se zbytkovým časem a odřádkováním.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { Feature } from '../../core/Feature';

/**
 * Text, který jednoznačně identifikuje spam „Špatný příkaz" od systému.
 * Matchujeme trim() rovnost (žádné substring – ať nezasáhneme zprávu,
 * která by to měla jen v textu od uživatele).
 */
const SPAM_TEXT = 'Špatný příkaz';

export class HistoryFilter extends Feature {
  readonly id = 'history-filter';
  readonly name = 'Historie – schovat „Špatný příkaz"';
  readonly description =
    'V klasické historii místnosti (room/history.html) nezobrazovat ' +
    'systémové zprávy „System->Nick: Špatný příkaz".';
  readonly category = 'room' as const;
  readonly matches = [/\/room\/history\.html(?:$|[?#])/];
  override readonly runAt = 'end';

  run(): void {
    this.removeBadCommands();
  }

  private removeBadCommands(): void {
    const spans = document.querySelectorAll<HTMLSpanElement>('span.umsg_wsystem');
    let removed = 0;
    spans.forEach((span) => {
      // Text zprávy je vše v `.umsg_wsystem` mimo úvodní bold „System->Nick:".
      // Trik: vezmeme textContent celého spanu a ořízneme prefix do první
      // mezery za „:". Pokud to nevyjde, fallback na innerText spanu bez boldu.
      const full = (span.textContent ?? '').trim();
      const idx = full.indexOf(':');
      const body = (idx >= 0 ? full.slice(idx + 1) : full).trim();
      if (body !== SPAM_TEXT) return;

      // Vyhledáme nejbližší obalový `<font>` (jeden společný rodič pro umsg_wsystem).
      const font = span.closest('font') as HTMLElement | null;
      const node: ChildNode = font ?? span;

      // Odstraníme předchozí textový uzel s časem (např. „20:37:58 ") +
      // následný <br>, aby po filtraci nezbyly prázdné řádky s časy.
      const prev = node.previousSibling;
      if (prev && prev.nodeType === Node.TEXT_NODE) {
        prev.parentNode?.removeChild(prev);
      }
      const next = node.nextSibling;
      if (next && next.nodeType === Node.ELEMENT_NODE && (next as HTMLElement).tagName === 'BR') {
        next.parentNode?.removeChild(next);
      }
      node.parentNode?.removeChild(node);
      removed += 1;
    });

    if (removed > 0) {
      // eslint-disable-next-line no-console
      console.log(`[XChat Toolkit] HistoryFilter: odstraněno ${removed} zpráv „Špatný příkaz".`);
    }
  }
}
