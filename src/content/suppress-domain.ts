/**
 * MAIN-world content script, běží na document_start ještě před jakýmkoli
 * inline skriptem stránky xchat.cz.
 *
 * Účel: legacy skripty xchatu (xchat-1.12.js, cpex-cmp.js, cookie-consent
 * SDK) se pokouší nastavit `document.domain = 'xchat.cz'`. Moderní Chrome
 * má origin-keyed agent cluster, takže mutation se ignoruje a do konzole
 * teče zápis „document.domain mutation is ignored because the surrounding
 * agent cluster is origin-keyed." – a to desetkrát při každém načtení.
 *
 * Tiše ten setter polkneme: getter vrací aktuální hostname (což je to,
 * co legacy kód stejně čeká po úspěšném přiřazení), setter je no-op.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

(() => {
  try {
    Object.defineProperty(Document.prototype, 'domain', {
      configurable: true,
      get(): string {
        return location.hostname;
      },
      set(_v: string): void {
        /* no-op – origin-keyed agent cluster, přiřazení beztak neprojde */
      },
    });
  } catch {
    /* když se nepovede, vypadne jen ta jedna varovná hláška – nevadí */
  }
})();
