/**
 * Feature „Místnost" – bootstrap React aplikace nad prázdným DOMem.
 *
 * Místo aby seděla v MAIN world nad existujícím frameset, React aplikace
 * běží v izolovaném content-script kontextu (má `chrome.*`) a přebírá
 * celé `<html>`. Stará DOM stránka se úplně zahazuje.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { Feature, type FeatureContext } from '../../core/Feature';
import { mountRoom } from '../../room/mount';
import type { XctHttpFlags } from '../../api/XChatApi';

export interface RoomDebugOptions {
  /**
   * Logování HTTP requestů – per kategorie (odeslání zprávy, refresh okna,
   * načtení textů pro šeptání atd.). Nezapnuté kategorie se vůbec netisknou.
   */
  logHttp: XctHttpFlags;
  /** Informační hlášky (parsery, kontext, submit OK …). */
  logInfo: boolean;
  /** Varování (retry WTKN, chyby parserů …). */
  logWarn: boolean;
  /** Při vstupu do místnosti vypsat získaný WTKN token do konzole. */
  logWtknOnLoad: boolean;
}

export interface RoomOptions {
  /**
   * Barevné schéma místnosti. Buď číslo skinu (z XChatu, viz `SKINS`),
   * nebo řetězec `'auto'` – pak se použije skin, který vrátí XChat v
   * kontextu místnosti (`ctx.skin`). Auto je výchozí.
   */
  skinId: number | 'auto';
  refreshIntervalSec: 5 | 10 | 15;
  defaultSidebarTab: 'users' | 'smilies' | 'settings' | 'ignore' | 'admin';
  /**
   * Pořadí zpráv ve výpisu:
   *  - `newest-first` (default, jako XChat) – nové nahoře, scroll nahoru
   *  - `newest-last` – nové dole, scroll dolů
   */
  messageOrder: 'newest-first' | 'newest-last';
  /** Zvýraznit šeptané zprávy (pozadí + proužek). */
  highlightWhispers: boolean;
  /**
   * Barva pozadí zvýraznění šeptů (rgba či hex). Uživatel si ji nastaví
   * v Options přes kapátko + posuvník průsvitnosti. Default = pastelově
   * žlutá s 35% krytím.
   */
  whisperBgColor: string;
  /** Zvýraznit můj nick žlutě ve všech příchozích zprávách. */
  highlightMyNick: boolean;
  /** Zvýraznit hlášky o vyhození z místnosti červenou barvou. */
  highlightKick: boolean;
  /**
   * Zvýraznit pozadí místnosti červeně 5 minut před automatickým vyhozením
   * (tj. když doba „nemluvil jsi" je ≥ 40 minut). Mění pozadí MessageBoardu
   * na `#C9BDBE` a barvu textu na `#C62828`.
   */
  highlightPreKickWarning: boolean;
  /** Skrýt systémové hlášky „Špatný příkaz" úplně z výpisu. */
  hideBadCommand: boolean;
  /** Patkové / bezpatkové písmo pro místnost. */
  fontFamily: 'serif' | 'sans';
  /**
   * Maximální povolená délka zprávy v MessageForm.
   *  - `'auto'` (default): 200 znaků pro běžné uživatele, 400 znaků pro
   *    uživatele s jakoukoli hvězdičkou (star > 0) a pro superadminy
   *    (viz {@link SUPER_ADMINS}).
   *  - Číslo: uživatelský override – platí bez ohledu na hvězdičku.
   */
  maxMessageLength: 'auto' | number;
  /** Debug/logovací přepínače – zobrazené úplně dole v Options. */
  debug: RoomDebugOptions;
}

/** URL vzoru `/~$.../modchat/room/{slug}`. */
const ROOM_URL_RE = /^\/~\$[^/]+\/modchat\/room\/[^/?#]+\/?$/;
/**
 * Alternativní vstup do místnosti – `modchat?op=mainframeset&rid=…`.
 * XChat občas odkazuje na místnost tímto URL (např. přes menu „Místnosti"
 * nebo z emailových notifikací). Cestu chytáme zvlášť a RID získáváme
 * z query stringu, ne ze slugu.
 */
const ROOM_MAINFRAMESET_PATH_RE = /^\/~\$[^/]+\/modchat\/?$/;

const matchesRoomUrl = (href: string): boolean => {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return false;
  }
  if (ROOM_URL_RE.test(url.pathname)) return true;
  if (
    ROOM_MAINFRAMESET_PATH_RE.test(url.pathname) &&
    url.searchParams.get('op') === 'mainframeset' &&
    /^\d+$/.test(url.searchParams.get('rid') ?? '')
  ) {
    return true;
  }
  return false;
};

export class RoomApp extends Feature<RoomOptions> {
  readonly id = 'room-app';
  readonly name = 'Místnost – nový vzhled (React)';
  readonly description =
    'Kompletně přepsaná chatovací místnost v Reactu – postranní panely, zprávy, ignorace, smajlíci a správa.';
  readonly category = 'room' as const;
  readonly matches = [matchesRoomUrl];
  override readonly runAt = 'start';
  override readonly defaultOptions: RoomOptions = {
    skinId: 'auto',
    refreshIntervalSec: 5,
    defaultSidebarTab: 'users',
    messageOrder: 'newest-first',
    highlightWhispers: true,
    whisperBgColor: 'rgba(255, 235, 59, 0.35)',
    highlightMyNick: false,
    highlightKick: true,
    highlightPreKickWarning: false,
    hideBadCommand: false,
    fontFamily: 'sans',
    maxMessageLength: 'auto',
    debug: {
      logHttp: {
        send: false,
        messages: false,
        users: false,
        'text-page': false,
        context: false,
        favourites: false,
        other: false,
      },
      logInfo: false,
      logWarn: true,
      logWtknOnLoad: false,
    },
  };

  /**
   * Tabula rasa: dřív než cokoli začne, zabijeme načítání původní stránky
   * (frameset, inline scripty, všechno). Běží synchronně na document_start,
   * ještě před parsováním body.
   *
   * POZOR 1: `<style>` tagy v hlavičce pocházejí od Vite/CRXJS (injektované
   * při evaluaci SCSS importů našich modulů). Musíme je zachovat, jinak
   * React aplikace nabootuje bez CSS.
   *
   * POZOR 2: `pre-bootstrap.ts` už přilepil na `<html>` přímého potomka
   * `#xct-pre-boot-style` (inline CSS pro spinner) a `#xct-pre-boot`
   * (overlay se spinnerem). Tyto elementy MUSÍME zachovat, ať spinner
   * běží plynule, dokud se React nenamountuje a nevykreslí svůj stav.
   */
  override prepare(): void {
    try {
      window.stop();
    } catch {
      /* v některých prohlížečích window.stop v content scriptu hází */
    }

    const root = document.documentElement;

    // Zachráníme naše styly (`<style>` od Vite) a pre-boot overlay + jeho CSS.
    const preserved: Node[] = [];
    if (document.head) {
      document.head.querySelectorAll('style').forEach((s) => preserved.push(s));
    }
    root.childNodes.forEach((node) => {
      if (node.nodeType !== Node.ELEMENT_NODE) return;
      const el = node as Element;
      if (el.id === 'xct-pre-boot' || el.id === 'xct-pre-boot-style') {
        preserved.push(el);
      } else if (el.tagName === 'STYLE') {
        preserved.push(el);
      }
    });

    while (root.firstChild) root.removeChild(root.firstChild);

    // Vložíme validní <head> / <body>.
    const head = document.createElement('head');
    const meta = document.createElement('meta');
    meta.setAttribute('charset', 'utf-8');
    head.appendChild(meta);
    const title = document.createElement('title');
    title.textContent = 'XChat – načítám místnost…';
    head.appendChild(title);
    preserved
      .filter((n) => n.nodeName === 'STYLE' && (n as Element).id !== 'xct-pre-boot-style')
      .forEach((s) => head.appendChild(s));

    const body = document.createElement('body');

    root.appendChild(head);
    root.appendChild(body);

    // Pre-boot overlay a jeho keyframes <style> vrátíme jako přímé děti <html>.
    preserved
      .filter(
        (n) =>
          (n as Element).id === 'xct-pre-boot' ||
          (n as Element).id === 'xct-pre-boot-style',
      )
      .forEach((o) => root.appendChild(o));

    // Po manipulacích s DOMem prohlížeč občas resetuje inline style. Ujistíme
    // se, že <html> zůstává skrytý – odhalíme ho až mount.tsx po prvním
    // Reactovém renderu.
    root.style.setProperty('visibility', 'hidden', 'important');
    root.style.setProperty('background', '#1e1e20', 'important');
  }

  run({ options }: FeatureContext<RoomOptions>): void {
    mountRoom(options);
  }
}
