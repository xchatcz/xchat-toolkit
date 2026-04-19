/**
 * Základní třída pro každou funkci rozšíření (non-React stránky).
 * Pro React aplikaci v místnosti existuje samostatný mount-point.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import type { SettingsCategory } from './categories';

export type RunAt = 'start' | 'end';
export type UrlMatcher = RegExp | string | ((href: string) => boolean);

export interface FeatureContext<O extends object = object> {
  options: O;
}

export abstract class Feature<O extends object = object> {
  /** Unikátní ID (např. "forum-favourite"). */
  abstract readonly id: string;
  /** Lidsky čitelný název pro Options. */
  abstract readonly name: string;
  /** Krátký popis pro Options. */
  abstract readonly description: string;
  /** Kategorie v Options stránce. */
  abstract readonly category: SettingsCategory;
  /** Matche URL, pro které se funkce aktivuje. */
  abstract readonly matches: readonly UrlMatcher[];
  /** Kdy se má funkce spustit. */
  readonly runAt: RunAt = 'end';
  /** Výchozí zapnuto. */
  readonly defaultEnabled: boolean = true;
  /** Výchozí volby specifické pro funkci. */
  readonly defaultOptions: O = {} as O;

  /** Vlastní logika funkce, přepisovaná v potomcích. */
  abstract run(ctx: FeatureContext<O>): void | Promise<void>;

  /**
   * Volitelný synchronní hook, který se zavolá ÚPLNĚ PRVNÍ – ještě před
   * načtením nastavení. Slouží pro případy, kdy musíme okamžitě zastavit
   * načítání stránky (např. zabít frameset dřív, než se vůbec začne
   * inicializovat).
   */
  prepare(): void {
    /* default no-op */
  }

  /** Otestuje, zda URL patří této funkci. */
  appliesTo(href: string): boolean {
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
}
