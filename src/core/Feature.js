/**
 * Základní třída pro každou funkci (bývalý userscript).
 *
 * Podtřídy přepisují statické pole (`id`, `name`, `description`, `matches`, ...)
 * a implementují `run(ctx)` metodu. Třída je perf-friendly: žádná instance se
 * nevytváří, dokud URL odpovídá a funkce je v nastavení zapnutá.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

export class Feature {
  /** Unikátní identifikátor funkce (např. `"forum-favourite"`). */
  static id = '';
  /** Lidsky čitelný název zobrazený v nastavení. */
  static name = '';
  /** Krátký popis funkce pro Options stránku. */
  static description = '';
  /** Pole regulárních výrazů nebo funkcí testujících `location.href`. */
  static matches = [];
  /** `"start"` (document_start) nebo `"end"` (DOMContentLoaded). */
  static runAt = 'end';
  /** Zda je funkce ve výchozím stavu zapnutá. */
  static defaultEnabled = true;
  /** Volitelná výchozí feature-specific nastavení. */
  static defaultOptions = undefined;

  /**
   * Otestuje, zda URL odpovídá některému z `matches`.
   * @param {string} href
   */
  static appliesTo(href) {
    for (const m of this.matches) {
      if (typeof m === 'function') {
        if (m(href)) return true;
      } else if (m instanceof RegExp) {
        if (m.test(href)) return true;
      } else if (typeof m === 'string') {
        if (href.includes(m)) return true;
      }
    }
    return false;
  }

  /**
   * Vlastní logika funkce – přepisováno v potomcích.
   * @param {{ options: Record<string, unknown> }} _ctx
   * @returns {void | Promise<void>}
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  run(_ctx) {
    throw new Error(`Feature ${this.constructor.name} nemá implementaci run().`);
  }
}
