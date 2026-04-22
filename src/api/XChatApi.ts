/**
 * XChatApi – jednotná knihovna pro veškerou komunikaci s XChat.cz.
 *
 * Sjednocuje původní PHP třídy (phplib/*) i JS funkce do jediné
 * TypeScript stavebnice. Každá třída řeší jednu doménu:
 *
 *  - {@link XChatApi}           … fasáda nad všemi třídami (jeden přístupový bod).
 *  - {@link XChatHttp}          … fetch přes service-worker proxy + ISO-8859-2 dekódování.
 *  - {@link XChatUrls}          … stavba všech URL adres (nic neposílá).
 *  - {@link XChatUsers}         … uživatelé (user.php, wonline.php, profile).
 *  - {@link XChatRooms}         … místnosti (rooms.php, room.php, infopage, messages …).
 *  - {@link XChatMessages}      … parsování okna zpráv (op=roomtopng) a šeptů.
 *  - {@link XChatAdmins}        … administrátoři (admin.php).
 *  - {@link XChatEmoji}         … mapa a dekódování emoji (class.xchat-emoji.php).
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { proxyFetch } from '../content/fetchBridge';
import type {
  AdminInfo,
  FavouriteUser,
  OnlineHelpPage,
  OnlineHelpUser,
  RoomContext,
  RoomDetail,
  RoomInfoDialog,
  RoomListItem,
  RoomMessage,
  RoomMessageKind,
  RoomUser,
  Sex,
  SkinId,
  Star,
  UserDetail,
  WhereOnline,
} from './types';

// ─── HTTP vrstva ────────────────────────────────────────────────────────────

/**
 * Kategorie HTTP requestů – uživatel si v Nastavení může zapnout/vypnout
 * každou nezávisle. Klasifikuje se podle URL ({@link classifyHttpUrl}).
 */
export type XctHttpCategory =
  | 'send'        // POST op=send (odeslání zprávy)
  | 'messages'    // op=roomtopng (refresh okna se zprávami)
  | 'users'       // op=wwpageng (refresh seznamu uživatelů)
  | 'text-page'   // op=textpageng (WTKN, šeptání, smajlíci)
  | 'context'     // /modchat/room/{slug} (vstupní stránka místnosti)
  | 'favourites'  // /notes/ (VIP / oblíbení)
  | 'other';      // ostatní (admin, ignore, info …)

export type XctHttpFlags = Record<XctHttpCategory, boolean>;

export const HTTP_CATEGORY_LABELS: Record<XctHttpCategory, string> = {
  send: 'Odeslání zprávy',
  messages: 'Refresh okna se zprávami',
  users: 'Refresh seznamu uživatelů',
  'text-page': 'Načtení textů (WTKN, šeptání)',
  context: 'Vstup do místnosti',
  favourites: 'Oblíbení / VIP',
  other: 'Ostatní (admin, ignore …)',
};

/** Pořadí pro UI v Options. */
export const HTTP_CATEGORY_ORDER: readonly XctHttpCategory[] = [
  'send',
  'messages',
  'users',
  'text-page',
  'context',
  'favourites',
  'other',
];

/** Defaultně vše zapnuté – aktivuje se až podle uživatelského nastavení. */
const DEFAULT_HTTP_FLAGS: XctHttpFlags = {
  send: true,
  messages: true,
  users: true,
  'text-page': true,
  context: true,
  favourites: true,
  other: true,
};

/** Klasifikace URL na HTTP kategorii podle `op=*` parametru / cesty. */
export const classifyHttpUrl = (url: string): XctHttpCategory => {
  if (/[?&]op=send\b/.test(url)) return 'send';
  if (/[?&]op=roomtopng\b/.test(url)) return 'messages';
  if (/[?&]op=wwpageng\b/.test(url)) return 'users';
  if (/[?&]op=textpageng\b/.test(url)) return 'text-page';
  if (/\/notes\//.test(url)) return 'favourites';
  if (/\/modchat\/room\//.test(url)) return 'context';
  return 'other';
};

/**
 * Globální přepínač debug-logů. Jednotlivé kategorie se dají zapínat/
 * vypínat nezávisle v Options stránce; `error` se vypisuje vždy.
 */
export interface XctLogFlags {
  /** Granulární přepínače pro HTTP requesty podle kategorie. */
  http: XctHttpFlags;
  /** Informační logy (parser summary, getRoomContext, submit OK …). */
  info: boolean;
  /** Varování (retry WTKN, chybějící kontext …). */
  warn: boolean;
}

export interface XctLogConfigure {
  http?: Partial<XctHttpFlags>;
  info?: boolean;
  warn?: boolean;
}

export const XCT_LOG = {
  prefix: '[XChat Toolkit]',
  flags: {
    http: { ...DEFAULT_HTTP_FLAGS },
    info: true,
    warn: true,
  } as XctLogFlags,
  configure(partial: XctLogConfigure): void {
    if (partial.http) {
      this.flags.http = { ...this.flags.http, ...partial.http };
    }
    if (typeof partial.info === 'boolean') this.flags.info = partial.info;
    if (typeof partial.warn === 'boolean') this.flags.warn = partial.warn;
  },
  /**
   * Zaloguje HTTP request – kategorie se odvodí automaticky z URL.
   * `method` je volitelný (např. POST u submitMessageToRoom).
   */
  http(
    url: string | URL,
    status: number,
    bytes: number,
    ms: number,
    method = 'GET',
  ): void {
    const u = String(url);
    const cat = classifyHttpUrl(u);
    if (!this.flags.http[cat]) return;
    // eslint-disable-next-line no-console
    console.log(
      `${this.prefix} HTTP %c${status}%c ${method} [${cat}]`,
      status >= 200 && status < 300 ? 'color:#2a7' : 'color:#c33',
      'color:inherit',
      `${ms.toFixed(0)} ms, ${bytes} B`,
      u,
    );
  },
  info(...args: unknown[]): void {
    if (!this.flags.info) return;
    // eslint-disable-next-line no-console
    console.log(this.prefix, ...args);
  },
  warn(...args: unknown[]): void {
    if (!this.flags.warn) return;
    // eslint-disable-next-line no-console
    console.warn(this.prefix, ...args);
  },
  error(...args: unknown[]): void {
    // eslint-disable-next-line no-console
    console.error(this.prefix, ...args);
  },
};

/** Primitivní HTTP klient nad {@link proxyFetch} se správným dekódováním. */
export class XChatHttp {
  private static readonly ISO_DECODER = new TextDecoder('iso-8859-2');
  private static readonly UTF_DECODER = new TextDecoder('utf-8');

  /** Provede GET a vrátí odpověď (Response-like přes fetch bridge). */
  static async fetch(url: string | URL, init: RequestInit = {}): Promise<Response> {
    const t0 = performance.now();
    const res = await proxyFetch(url, { credentials: 'include', cache: 'no-cache', ...init });
    XCT_LOG.http(url, res.status, Number(res.headers.get('content-length')) || -1, performance.now() - t0);
    return res;
  }

  /** Stáhne obsah ve známém ISO-8859-2 kódování (všechny XChat stránky). */
  static async fetchIsoText(url: string | URL, init: RequestInit = {}): Promise<string> {
    const t0 = performance.now();
    const res = await proxyFetch(url, { credentials: 'include', cache: 'no-cache', ...init });
    if (!res.ok) {
      XCT_LOG.error(`HTTP ${res.status} při načítání`, String(url));
      throw new Error(`HTTP ${res.status} při načítání ${String(url)}`);
    }
    const buf = await res.arrayBuffer();
    XCT_LOG.http(url, res.status, buf.byteLength, performance.now() - t0);
    return this.ISO_DECODER.decode(buf);
  }

  /** Stáhne plain-text ve výchozím kódování XChatu (ISO-8859-2). */
  static fetchPlain(url: string | URL, init: RequestInit = {}): Promise<string> {
    return this.fetchIsoText(url, init);
  }

  /** Stáhne HTML a rovnou z něj vyrobí {@link Document}. */
  static async fetchDocument(url: string | URL, init: RequestInit = {}): Promise<Document> {
    const html = await this.fetchIsoText(url, init);
    return new DOMParser().parseFromString(html, 'text/html');
  }

  /** Dekóduje UTF-8 ArrayBuffer. */
  static decodeUtf8(buf: ArrayBuffer): string {
    return this.UTF_DECODER.decode(buf);
  }
}

// ─── URL buildery ───────────────────────────────────────────────────────────

/** Stavba URL adres XChat.cz. Metody nic neposílají, jen vrací stringy. */
export class XChatUrls {
  static readonly SCRIPTS_BASE = 'https://scripts.xchat.cz/scripts';
  static readonly WHOISWHO_BASE = 'https://www.xchat.cz/whoiswho';
  static readonly IMG_BASE = 'https://ximg.cz';

  /**
   * Normalizuje xhash – odstraní případný úvodní `~` a bílé znaky.
   * XChat někdy ukládá `my_auth` jako `~$xxx~yyy`, jindy jen `$xxx~yyy`.
   */
  static normalizeXhash(xhash: string): string {
    return (xhash || '').trim().replace(/^~+/, '');
  }

  /** `{origin}/~{xhash}` prefix. */
  static hashPrefix(xhash: string): string {
    return `${location.origin}/~${this.normalizeXhash(xhash)}`;
  }

  // Scripts (cross-origin, přes fetch proxy):
  static userInfo(nick: string): string {
    return `${this.SCRIPTS_BASE}/user.php?nick=${encodeURIComponent(nick)}`;
  }
  static wonline(nick: string): string {
    return `${this.SCRIPTS_BASE}/wonline.php?nick=${encodeURIComponent(nick)}`;
  }
  static onlineText(nick: string): string {
    return `${this.SCRIPTS_BASE}/online_txt.php?nick=${encodeURIComponent(nick)}`;
  }
  static timeText(nick: string, withSeconds = false): string {
    return `${this.SCRIPTS_BASE}/time_txt.php?nick=${encodeURIComponent(nick)}${withSeconds ? '&sec=1' : ''}`;
  }
  static roomInfo(rid: number): string {
    return `${this.SCRIPTS_BASE}/room.php?rid=${rid}`;
  }
  /** Ve\u0159ejn\u00e1 intro str\u00e1nka m\u00edstnosti \u2013 obsahuje podm\u00ednky/pravidla. */
  static roomIntro(rid: number): string {
    return `https://www.xchat.cz/~guest~/room/intro.php?rid=${rid}`;
  }
  static roomAdmins(rid: number): string {
    return `${this.SCRIPTS_BASE}/ss.php?rid=${rid}`;
  }
  static admins(): string {
    return `${this.SCRIPTS_BASE}/admin.php`;
  }
  static roomsList(): string {
    return `${this.SCRIPTS_BASE}/rooms.php`;
  }

  // Avatar a obrázky:
  static avatar(nick: string, sex: Sex | -1 = -1): string {
    return `${this.WHOISWHO_BASE}/perphoto.php?nick=${encodeURIComponent(nick)}&sex=${sex}`;
  }

  // Stránka místnosti (přes xhash prefix – s autentizací):
  static roomEntry(xhash: string, slug: string): string {
    return `${this.hashPrefix(xhash)}/modchat/room/${encodeURIComponent(slug)}`;
  }
  static modchatOp(xhash: string, params: Record<string, string | number>): string {
    const qs = new URLSearchParams(
      Object.entries(params).map(([k, v]) => [k, String(v)]),
    ).toString();
    return `${this.hashPrefix(xhash)}/modchat?${qs}`;
  }
  static roomMessages(xhash: string, rid: number, skin: SkinId): string {
    // `_t` je anti-cache – server XChatu sice posílá no-cache hlavičky, ale
    // proxy/CDN by ho mohly cachovat; unique URL vždy projde čerstvá.
    return this.modchatOp(xhash, { op: 'roomtopng', rid, js: 0, skin, _t: Date.now() });
  }
  static roomInfoPage(xhash: string, rid: number, skin: SkinId, roomName: string): string {
    return this.modchatOp(xhash, {
      op: 'infopage',
      rid,
      skin,
      js: 1,
      roomname: roomName,
    });
  }
  /**
   * Dialog „Informace o místnosti" – `op=roominfo&rid=…`. Obsahuje HTML
   * tabulku s názvem, kategorií, popisem (včetně smajlíků), jazykem,
   * správcem, stálým správcem, odkazem na fórum, srazy a filtry.
   */
  static roomInfoDialog(xhash: string, rid: number): string {
    return this.modchatOp(xhash, { op: 'roominfo', rid });
  }
  static roomTextPage(xhash: string, rid: number, skin: SkinId): string {
    // KRITICKÉ: anti-cache (`_t`). Pokud by se cachoval, dostaneme starý WTKN
    // a odeslání zprávy bude vracet „neplatný token" / spadne mlčky.
    return this.modchatOp(xhash, { op: 'textpageng', rid, skin, js: 1, _t: Date.now() });
  }
  static roomAdminPage(xhash: string, rid: number, skin: SkinId): string {
    return this.modchatOp(xhash, { op: 'adminpageng', rid, skin, js: 0 });
  }
  static roomIgnorePage(xhash: string, rid: number, skin: SkinId): string {
    return this.modchatOp(xhash, { op: 'ignorepage', rid, skin, js: 1 });
  }
  static roomOnlineHelpPage(xhash: string, rid: number, skin: SkinId): string {
    return this.modchatOp(xhash, { op: 'onlinehelppage', rid, skin, js: 1 });
  }
  static roomUsersPage(xhash: string, rid: number, skin: SkinId): string {
    // `op=wwpageng` je stránka "Výpis uživatelů v místnosti" (Menu → Místnosti).
    // Oproti `userspage` obsahuje tabulku s hvězdičkou, pohlavím, online/idle časy.
    return this.modchatOp(xhash, { op: 'wwpageng', rid, skin, js: 1, _t: Date.now() });
  }
  static roomSwitchPage(xhash: string, rid: number, skin: SkinId): string {
    return this.modchatOp(xhash, { op: 'menupage', rid, skin, js: 1 });
  }
  static notesPage(xhash: string, page = 1): string {
    return `${this.hashPrefix(xhash)}/notes/?page=${page}`;
  }
  /**
   * Stránka `Nastavení XChatu → Nastavení smajlíků` – tabulka smajlíků s
   * čísly, obrázky a popisky. Podporuje `page`, `search` (přesné číslo) a
   * `search-txt` (fulltext v popisku).
   */
  static smilesPage(
    xhash: string,
    opts: { page?: number; searchNum?: number | ''; searchTxt?: string } = {},
  ): string {
    const qs = new URLSearchParams();
    if (opts.page && opts.page > 0) qs.set('page', String(opts.page));
    if (opts.searchNum !== undefined && opts.searchNum !== '') {
      qs.set('search', String(opts.searchNum));
    }
    if (opts.searchTxt) qs.set('search-txt', opts.searchTxt);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return `${this.hashPrefix(xhash)}/settings/smiles.php${suffix}`;
  }
  static logout(xhash: string): string {
    return `${this.hashPrefix(xhash)}/room/logout.php`;
  }
  static roomLeave(xhash: string, rid: number, cid: number, skin: SkinId): string {
    return this.modchatOp(xhash, {
      op: 'mainframeset',
      menuaction: 'leave',
      leftroom: rid,
      js: 1,
      skin,
      cid,
    });
  }
}

// ─── Parsery ────────────────────────────────────────────────────────────────

/** Uživatelé. */
export class XChatUsers {
  /** Naparsuje výstup `scripts/user.php` (řádky oddělené \n). */
  static parseUserDetail(text: string, nick: string): UserDetail | null {
    if (!text) return null;
    const lines = text.split(/\r?\n/).map((l) => l.trim());
    if (lines.length < 12) return null;
    const sex = (Number(lines[4]) === 1 ? 1 : 0) as Sex;
    const starRaw = Number(lines[5]) || 0;
    const star = ([0, 1, 2, 4, 8, 16].includes(starRaw) ? starRaw : 0) as Star;
    return {
      firstName: lines[0] ?? '',
      lastName: lines[1] ?? '',
      age: Number(lines[2]) || null,
      certified: lines[3] === '1',
      sex,
      star,
      email: lines[6] ?? '',
      createdAt: this.parseDate(lines[7] ?? ''),
      spokenSeconds: Number(lines[8]) || 0,
      lastOnlineAt: this.parseDate(lines[9] ?? ''),
      topPosition: Number(lines[10]) || 0,
      nick: (lines[11] ?? nick).trim() || nick,
      photoUrl: XChatUrls.avatar(nick, sex),
    };
  }

  /** Parser `scripts/wonline.php`. */
  static parseWhereOnline(text: string): WhereOnline {
    const t = (text || '').trim();
    if (!t) return { online: false, rooms: [] };
    const lines = t.split('\n');
    const count = Number(lines[0]);
    if (!count || count <= 0) return { online: false, rooms: [] };
    const rooms: WhereOnline['rooms'] = [];
    for (let i = 1; i < lines.length; i++) {
      const m = lines[i].match(/^(\d+)\s+(\S+)\s+(\S+)\s+(.+)$/);
      if (!m) continue;
      rooms.push({
        rid: Number(m[1]),
        idle: m[2],
        guestLink: m[3],
        roomName: m[4].trim(),
      });
    }
    return { online: rooms.length > 0, rooms };
  }

  /** Převod „YYYY-MM-DD HH:MM:SS" na unix timestamp (ms) – null při chybě. */
  private static parseDate(s: string): number | null {
    const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
    if (!m) return null;
    return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  }
}

// ─── Místnosti + zprávy ─────────────────────────────────────────────────────

/**
 * Mapa znak → bajt pro ISO-8859-2 (Latin-2, Central European). Generujeme
 * ji invertováním `TextDecoder('iso-8859-2')` na všech 256 bajtech.
 * Standardní `TextEncoder` umí jen UTF-8, proto ji máme ručně.
 */
const ISO_8859_2_MAP: Map<string, number> = (() => {
  const dec = new TextDecoder('iso-8859-2');
  const m = new Map<string, number>();
  for (let i = 0; i < 256; i++) {
    const ch = dec.decode(new Uint8Array([i]));
    if (!m.has(ch)) m.set(ch, i);
  }
  return m;
})();

/**
 * URL-encode řetězce v ISO-8859-2 přesně tak, jak to dělá HTML form
 * s `accept-charset="ISO-8859-2"`: mezera → `+`, ne-alfanum znaky → `%XX`
 * (kde XX je 1bajtová hodnota v ISO-8859-2). Znaky, které ISO-8859-2
 * neumí vyjádřit (např. „ " české „typo" uvozovky, emoji 👌, 😀 atp.),
 * nahrazujeme HTML numeric character reference `&#N;` – přesně tak to
 * dělají prohlížeče při submitu formuláře s non-UTF-8 `accept-charset`
 * (HTML5 spec). XChat server to pak uloží a při zpětném vykreslení nám
 * přijde zpátky jako čitelný znak, ne jako `?`.
 */
const encodeIso88592UrlEncoded = (value: string): string => {
  // Pomocná funkce: jeden char na jeden znak URL-encoded výstupu.
  const encodeByte = (b: number): string => {
    if (
      (b >= 0x30 && b <= 0x39) || // 0-9
      (b >= 0x41 && b <= 0x5a) || // A-Z
      (b >= 0x61 && b <= 0x7a) || // a-z
      b === 0x2d ||
      b === 0x2e ||
      b === 0x5f ||
      b === 0x7e // - . _ ~
    ) {
      return String.fromCharCode(b);
    }
    if (b === 0x20) return '+';
    return '%' + b.toString(16).toUpperCase().padStart(2, '0');
  };

  let out = '';
  for (const ch of value) {
    const b = ISO_8859_2_MAP.get(ch);
    if (b !== undefined) {
      out += encodeByte(b);
      continue;
    }
    // Znak mimo ISO-8859-2 → HTML entita `&#N;` (tak to dělá formulář
    // s accept-charset). Všechny znaky entity (&#0-9;) jsou ASCII, tudíž
    // přímo v mapě.
    const entity = `&#${ch.codePointAt(0)};`;
    for (let i = 0; i < entity.length; i++) {
      out += encodeByte(entity.charCodeAt(i));
    }
  }
  return out;
};

/**
 * Analog PHP `strip_tags($s, '<b><u><i>')` \u2013 odstran\u00ed v\u0161echny HTML
 * tagy kr\u011bm\u011b `<b>`, `<u>`, `<i>` (v\u010detn\u011b jejich uzav\u00edrac\u00edch variant).
 */
const stripTagsKeepSome = (input: string): string =>
  input.replace(/<\/?([a-zA-Z][\w:-]*)[^>]*>/g, (tag, name: string) => {
    const n = name.toLowerCase();
    return n === 'b' || n === 'u' || n === 'i' ? tag : '';
  });

export class XChatRooms {
  /** Parser `scripts/rooms.php` – seznam všech místností. */
  static parseRoomsList(text: string): RoomListItem[] {
    const out: RoomListItem[] = [];
    for (const raw of (text || '').split('\n')) {
      const line = raw.trim();
      if (!line) continue;
      const m = line.match(/^(\d+)\s+(\d+)\s+(\d+)\s+(.+)$/);
      if (!m) continue;
      out.push({
        rid: Number(m[1]),
        permanent: m[2] === '1',
        userCount: Number(m[3]),
        name: m[4].trim(),
      });
    }
    return out;
  }

  /**
   * Parser ve\u0159ejn\u00e9 intro str\u00e1nky m\u00edstnosti (`~guest~/room/intro.php`).
   * Vrac\u00ed HTML \u0159et\u011bzec s t\u0159emi sekcemi:
   *   1) `<span class="sexwarn">` \u2013 18+ varov\u00e1n\u00ed s `<ol>` podm\u00ednkami,
   *   2) `<p class="disclaimer">` po `<h2>Podm\u00ednky pro vstup:</h2>`,
   *   3) `<ul>` omezen\u00ed vstupu po `<h2>Do m\u00edstnosti mohou vstoupit\u2026</h2>`.
   * Smajl\u00edci `/x4/sm/NUMBER/NUMBER.gif` se nahrazuj\u00ed `*NUMBER*`. Zachov\u00e1vaj\u00ed\n   * se tagy `<b><u><i>`, \u0159\u00e1dky se odd\u011bluj\u00ed `<br>`.
   */
  static parseRoomRulesHtml(html: string): string | null {
    if (!html) return null;
    // Smajlíci → `*NUMBER*` marker (druhé číslo z cesty `/sm/FOLDER/NUM.gif`).
    // Regex je úmyslně velmi tolerantní – intro.php XChatu používá různé
    // varianty URL (absolutní `https://…`, relativní `/images/…`, i bez
    // protokolu `//…`). Číslo (NUM) pak projde přes `XChatEmoji.enrich`
    // (=> správná cesta `/sm/<prefix>/<NUM>.gif`), takže i když intro.php
    // vrací např. `/sm/44/44.gif`, výsledné URL bude `/sm/4/44.gif`.
    let src = html.replace(
      /<img\b[^>]*\bsrc\s*=\s*["'][^"']*\/sm\/\d+\/(\d+)\.gif[^"']*["'][^>]*>/gi,
      (_all, n: string) => `*${n}*`,
    );
    // Pro zjednodu\u0161en\u00ed regexp\u016f p\u0159edem odstran\u00edme p\u016fvodn\u00ed \u0159\u00e1dkov\u00e1n\u00ed.
    src = src.replace(/[\r\n]+/g, '');

    const parts: string[] = [];

    // 1) sexwarn blok.
    const mWarn = src.match(/<span\s+class="sexwarn">([\s\S]*?)<\/span>/i);
    if (mWarn) {
      const inner = mWarn[1];
      let block = '';
      const pRe = /<p\s+class="sexwarn"[^>]*>([\s\S]*?)<\/p>/gi;
      let mp: RegExpExecArray | null;
      while ((mp = pRe.exec(inner)) !== null) {
        block += mp[1].trim() + '\n';
      }
      const mOl = inner.match(/<ol>([\s\S]*?)<\/ol>/i);
      if (mOl) {
        let ol = mOl[1];
        ol = ol.replace(/<li[^>]*>/gi, '- ').replace(/<\/li>/gi, '\n');
        block += stripTagsKeepSome(ol).trim() + '\n';
      }
      if (block.trim()) parts.push(block.trim());
    }

    // 2) Podm\u00ednky pro vstup \u2013 disclaimer.
    const mCond = src.match(
      /<h2>\s*Podm\u00ednky pro vstup:\s*<\/h2>\s*<fieldset>([\s\S]*?)<\/fieldset>/i,
    );
    if (mCond) {
      const mDis = mCond[1].match(
        /<p\s+class="disclaimer"[^>]*>([\s\S]*?)<\/p>/i,
      );
      if (mDis) parts.push(mDis[1].trim());
    }

    // 3) Omezen\u00ed vstupu (ul/li).
    const mUl = src.match(
      /<h2>\s*Do m\u00edstnosti mohou vstoupit pouze u\u017eivatel\u00e9:\s*<\/h2>\s*<ul>([\s\S]*?)<\/ul>/i,
    );
    if (mUl) {
      let ul = mUl[1];
      ul = ul.replace(/<li[^>]*>/gi, '- ').replace(/<\/li>/gi, '\n');
      parts.push(stripTagsKeepSome(ul).trim());
    }

    if (!parts.length) return null;

    let result = parts.join('\n\n');
    // `<br>` \u2192 `\n`, pak tagy ponech\u00e1me jen whitelist.
    result = result.replace(/<br\s*\/?\s*>/gi, '\n');
    result = stripTagsKeepSome(result);
    result = result.replace(/\n{3,}/g, '\n\n').trim();

    // Markery `*NUMBER*` přeložíme na `<img>` XChat smajlíka. Děláme to
    // až po stripTagsKeepSome, aby se nově vložený `<img>` nesmazal.
    result = XChatEmoji.enrich(result);

    // Pro React vykreslen\u00ed p\u0159ev\u00e1d\u00edme \u0159\u00e1dkov\u00e1n\u00ed na `<br>`.
    return result.replace(/\n/g, '<br>');
  }

  /** Parser `scripts/room.php`. */
  static parseRoomDetail(text: string): RoomDetail | null {
    const lines = (text || '').split(/\r?\n/);
    if ((lines[0] ?? '').trim() !== '1') return null;
    return {
      rid: Number(lines[2]) || 0,
      name: (lines[3] ?? '').trim(),
      description: (lines[4] ?? '').trim(),
      createdAt: XChatRooms.parseRoomCreatedAt(lines[5] ?? ''),
      userCount: Number(lines[6]) || 0,
      admin: (lines[7] ?? '').trim(),
      permanentAdmins: (lines[8] ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      www: (lines[9] ?? '').trim(),
      map: (lines[10] ?? '').trim(),
      cid: Number(lines[11]) || 0,
    };
  }

  /**
   * Normalizace „createdAt" z `scripts/room.php` na unix timestamp
   * v sekundách. XChat posílá podle verze buď:
   *   – unix timestamp v sekundách (`1215000000`),
   *   – ISO-like date string (`2008-07-02 13:20:00`),
   *   – český formát (`2.7.2008 13:20[:00]`).
   * Původní `Number(lines[5]) || null` fungovalo jen pro první variantu,
   * u date stringů vracelo `null` → v overlay byla jen pomlčka.
   */
  static parseRoomCreatedAt(raw: string): number | null {
    const s = (raw ?? '').trim();
    if (!s) return null;

    // 1) Unix timestamp (pouze cifry).
    if (/^\d+$/.test(s)) {
      const n = Number(s);
      return Number.isFinite(n) && n > 0 ? n : null;
    }

    // 2) ISO-like: „YYYY-MM-DD HH:MM[:SS]".
    let m = s.match(
      /^(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/,
    );
    if (m) {
      const d = new Date(
        +m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? '0'),
      );
      const t = d.getTime();
      return Number.isFinite(t) ? Math.floor(t / 1000) : null;
    }

    // 3) České: „D.M.YYYY HH:MM[:SS]" i „D. M. YYYY HH:MM".
    m = s.match(
      /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/,
    );
    if (m) {
      const d = new Date(
        +m[3], +m[2] - 1, +m[1],
        +(m[4] ?? '0'), +(m[5] ?? '0'), +(m[6] ?? '0'),
      );
      const t = d.getTime();
      return Number.isFinite(t) ? Math.floor(t / 1000) : null;
    }

    return null;
  }

  /**
   * Parser dialogu `modchat?op=roominfo&rid=…`.
   *
   * HTML má strukturu `<table><tr><td class="blu">popisek:</td><td>hodnota</td></tr>…</table>`.
   * Jednotlivé řádky detekujeme podle textu v `.blu` buňce (case-insensitive,
   * bez dvojtečky). Popis necháváme jako HTML kvůli smajlíkům `<img>`.
   */
  static parseRoomInfoDialog(doc: Document): RoomInfoDialog {
    const rows = Array.from(doc.querySelectorAll<HTMLTableRowElement>('tr'));
    const pairs: Record<string, HTMLTableCellElement> = {};
    for (const tr of rows) {
      const tds = tr.querySelectorAll<HTMLTableCellElement>('td');
      if (tds.length < 2) continue;
      const lbl = tds[0];
      if (!lbl.classList.contains('blu')) continue;
      const key = (lbl.textContent ?? '')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .replace(/:$/, '');
      pairs[key] = tds[1];
    }

    const txt = (cell?: HTMLTableCellElement): string =>
      (cell?.textContent ?? '').trim().replace(/\s+/g, ' ');
    const html = (cell?: HTMLTableCellElement): string =>
      (cell?.innerHTML ?? '').trim();

    let forum: RoomInfoDialog['forum'] = null;
    const forumCell = pairs['fórum místnosti'] ?? pairs['forum místnosti'];
    const forumLink = forumCell?.querySelector<HTMLAnchorElement>('a');
    if (forumLink) {
      forum = {
        label: (forumLink.textContent ?? '').trim(),
        href: forumLink.getAttribute('href') ?? '',
      };
    }

    return {
      name: txt(pairs['název']),
      category: txt(pairs['kategorie']),
      descriptionHtml: html(pairs['popis']),
      descriptionText: txt(pairs['popis']),
      language: txt(pairs['jazyk']),
      admin: txt(pairs['správce']),
      permanentAdmin: txt(pairs['stálý správce']),
      forum,
      meetings: txt(pairs['srazy místnosti']),
      filters: {
        minutes: txt(pairs['nachatovaných minut']),
        allowed: txt(pairs['mohou sem']),
        stars: txt(pairs['hvězdičky']),
        sex: txt(pairs['pohlaví']),
        phone: txt(pairs['telefon']),
      },
    };
  }

  /**
   * Vyparsuje z HTML (libovolné stránky XChatu, kde jsou JS proměnné nebo
   * URL s `rid=…`) aktuální kontext místnosti.
   *
   * Tři stupně fallbacku:
   *   1) přímé JS přiřazení: `var rid = 1234;`
   *   2) URL ve `<frame src="…">` / `<iframe src="…">`
   *   3) jakýkoli výskyt `rid=\d+` v HTML (query string uvnitř scriptu atd.)
   *
   * Stejně pro `cid`, `skin`, `uid`.
   */
  static parseRoomContext(html: string, fallbackXhash: string): RoomContext | null {
    // 1) JS proměnné. Povolujeme volitelné mezery kolem `=` i `var`/`let`/`const`.
    const varNum = (name: string): number => {
      const re = new RegExp(`\\b(?:var|let|const)?\\s*${name}\\s*=\\s*(\\d+)`, 'i');
      const m = html.match(re);
      return m ? Number(m[1]) : 0;
    };
    const varStr = (name: string): string | null => {
      const re = new RegExp(
        `\\b(?:var|let|const)?\\s*${name}\\s*=\\s*['"]([^'"]*)['"]`,
        'i',
      );
      const m = html.match(re);
      return m ? m[1] : null;
    };

    let rid = varNum('rid');
    let cid = varNum('cid');
    let skin = varNum('skin');
    const uid = varNum('uid');

    // 2) <frame src="...">
    if (!rid || !cid || !skin) {
      const frameSrcRe = /<i?frame[^>]*\bsrc\s*=\s*['"]([^'"]+)['"]/gi;
      for (const m of html.matchAll(frameSrcRe)) {
        const src = m[1];
        if (!rid) {
          const r = src.match(/[?&]rid=(\d+)/);
          if (r) rid = Number(r[1]);
        }
        if (!cid) {
          const c = src.match(/[?&]cid=(\d+)/);
          if (c) cid = Number(c[1]);
        }
        if (!skin) {
          const s = src.match(/[?&]skin=(\d+)/);
          if (s) skin = Number(s[1]);
        }
      }
    }

    // 3) Poslední možnost – jakýkoli `rid=...` v HTML (odkazy, scripty…).
    if (!rid) {
      const m = html.match(/[?&;\s]rid[=:]\s*['"]?(\d+)/i);
      if (m) rid = Number(m[1]);
    }
    if (!cid) {
      const m = html.match(/[?&;\s]cid[=:]\s*['"]?(\d+)/i);
      if (m) cid = Number(m[1]);
    }
    if (!skin) {
      const m = html.match(/[?&;\s]skin[=:]\s*['"]?(\d+)/i);
      if (m) skin = Number(m[1]);
    }

    if (!rid) return null;

    const skinClamped = skin >= 2 && skin <= 16 ? skin : 2;
    return {
      rid,
      cid: cid || 0,
      uid,
      xhash: XChatUrls.normalizeXhash(varStr('my_auth') ?? fallbackXhash),
      myNick: varStr('my_nick') ?? '',
      roomName: (varStr('roomname') ?? '').trim(),
      sex: (varNum('sex') === 1 ? 1 : 0) as Sex,
      skin: skinClamped as SkinId,
    };
  }

  /**
   * Najde WTKN token ze stránky `op=textpageng`. WTKN může být v HTML na
   * více místech; preferujeme `<input name="wtkn" value="...">` ze submit
   * formuláře – to je přesně ten token, který XChat očekává při odesílání
   * zprávy (ověřeno proti PHP knihovně, která bere výhradně tento zdroj).
   *
   * Vrací též zdroj (`source`) pro debug – díky tomu se v konzoli pozná,
   * odkud se token vytáhl.
   */
  static parseWtknWithSource(html: string): { wtkn: string; source: string } | null {
    // 1) <input name="wtkn" value="..."> – zdroj pravdy pro odeslání zprávy.
    const reInput = /<input\b[^>]*\bname\s*=\s*['"]?wtkn['"]?[^>]*\bvalue\s*=\s*['"]([^'"]+)/i;
    const m1 = html.match(reInput);
    if (m1) return { wtkn: m1[1], source: 'input-name-first' };

    // 2) <input value="..." name="wtkn"> (obrácené pořadí atributů)
    const reInput2 = /<input\b[^>]*\bvalue\s*=\s*['"]([^'"]+)['"][^>]*\bname\s*=\s*['"]?wtkn['"]?/i;
    const m2 = html.match(reInput2);
    if (m2) return { wtkn: m2[1], source: 'input-value-first' };

    // 3) <form action="...?wtkn=..."> – některé varianty HTML ho mají v URL.
    const reFormAction =
      /<form\b[^>]*\baction\s*=\s*['"][^'"]*[?&]wtkn=([^&"'\s]+)/i;
    const m3 = html.match(reFormAction);
    if (m3) return { wtkn: decodeURIComponent(m3[1]), source: 'form-action' };

    // 4) inline JS  var wtkn = '...'
    const reVar = /\bwtkn\s*=\s*['"]([^'"]+)['"]/i;
    const m4 = html.match(reVar);
    if (m4) return { wtkn: m4[1], source: 'js-var' };

    // 5) Last resort: první wtkn=... v jakékoli URL (může být z odkazu „Zpět").
    const reUrl = /[?&]wtkn=([^&"'\s<>]+)/i;
    const m5 = html.match(reUrl);
    if (m5) return { wtkn: decodeURIComponent(m5[1]), source: 'url-fallback' };

    return null;
  }

  /** Backward-compat wrapper. */
  static parseWtkn(html: string): string | null {
    return XChatRooms.parseWtknWithSource(html)?.wtkn ?? null;
  }

  // ── Odesílání zpráv (PHP XChatRooms::sendMessageToRoom ekvivalent) ─────
  //
  // Stará PHP knihovna měla 3 metody:
  //   - getWtknToken(xhash, rid)     – jednorázově po vstupu do místnosti
  //   - submitMessageToRoom(...)     – pošle zprávu, už zná WTKN
  //   - sendMessageToRoom(...)       – high-level (WTKN + submit + retry)
  //
  // WTKN se získává z `op=textpageng` (form `<input name="wtkn">` nebo
  // `var wtkn='...'` v inline skriptu) a vydrží do odchodu / odhlášení.

  /**
   * Získá WTKN token pro místnost.
   *
   * Pozor, formát requestů byl ověřen proti původní PHP knihovně a je kritický:
   * **POST** na `/modchat` s body `op=textpageng&rid=...&js=0&skin=2&`
   * (tedy NE GET s query-stringem!). GET sice také vrací HTML, ale v jiné
   * „read-only" variŁtě bez WTKN tokenu v submit formuláři – nebo s tokenem,
   * který server neakceptuje pro odeslání.
   *
   * Token se parsuje z `<input name="wtkn" value="...">`.
   */
  static async getWtknToken(
    xhash: string,
    rid: number,
    skin: SkinId,
  ): Promise<string | null> {
    const url = `${XChatUrls.hashPrefix(xhash)}/modchat`;
    const body = `op=textpageng&rid=${rid}&js=0&skin=${skin}&`;

    const t0 = performance.now();
    let res: Response;
    try {
      res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-cache',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch (err) {
      XCT_LOG.error('getWtknToken: fetch selhal', err);
      return null;
    }

    const buf = await res.arrayBuffer();
    const html = new TextDecoder('iso-8859-2').decode(buf);
    XCT_LOG.http(url, res.status, buf.byteLength, performance.now() - t0, 'POST');

    // Diagnostika – ať má user `copy(window.__XCT_TEXTPAGENG.html)`.
    try {
      (window as unknown as Record<string, unknown>).__XCT_TEXTPAGENG = {
        url,
        body,
        status: res.status,
        html,
      };
    } catch {
      /* ignore */
    }

    if (!res.ok) {
      XCT_LOG.warn('getWtknToken: HTTP', res.status);
      return null;
    }

    const wtknRes = XChatRooms.parseWtknWithSource(html);
    if (!wtknRes) {
      XCT_LOG.warn('getWtknToken: WTKN nenalezen v textpageng', {
        url,
        bytes: html.length,
      });
      return null;
    }
    XCT_LOG.info('getWtknToken ok', {
      wtknLen: wtknRes.wtkn.length,
      source: wtknRes.source,
    });
    return wtknRes.wtkn;
  }

  /**
   * Pošle zprávu do místnosti – volající již MÁ WTKN token.
   *
   * Formát POSTu je přesně stejný jako v původní PHP knihovně – ověřeno proti
   * reálnému XChat engine, jiný formát server tiché zahodí:
   *
   *   POST `/~$xhash/modchat`
   *   Content-Type: application/x-www-form-urlencoded
   *   Body (ISO-8859-2 url-encoded):
   *     op=textpageng
   *     rid=<RID>
   *     aid=6                 („Action ID" = submit zprávy)
   *     js=0
   *     skin=<SKIN>
   *     wtkn=<TOKEN>
   *     textarea=<TEXT>       (ISO-8859-2, url-encoded)
   *     target=<TARGET>       ("~" = všem, jinak nick příjemce)
   *
   * Pro české znaky kódujeme do ISO-8859-2 ručně, protože standardní
   * `TextEncoder` umí jen UTF-8.
   *
   * @param target `"~"` = všem na sklo; jinak nick konkrétního příjemce.
   */
  static async submitMessageToRoom(
    xhash: string,
    rid: number,
    skin: SkinId,
    wtkn: string,
    text: string,
    target: string,
  ): Promise<void> {
    const tgt = target && target !== '' ? target : '~';
    const action = `${XChatUrls.hashPrefix(xhash)}/modchat`;
    // Pořadí polí odpovídá PHP http_build_query($postData) – některé XChat
    // endpointy jsou na pořadí citlivé.
    const body =
      `op=textpageng` +
      `&rid=${rid}` +
      `&aid=6` +
      `&js=0` +
      `&skin=${skin}` +
      `&wtkn=${encodeURIComponent(wtkn)}` +
      `&textarea=${encodeIso88592UrlEncoded(text)}` +
      `&target=${encodeIso88592UrlEncoded(tgt)}`;

    XCT_LOG.info('submitMessageToRoom: POST', {
      action,
      bodyLen: body.length,
      target: tgt,
    });

    const t0 = performance.now();
    let res: Response;
    try {
      res = await fetch(action, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-cache',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch (err) {
      XCT_LOG.error('submitMessageToRoom: fetch selhal', err);
      throw new Error('Chyba sítě při odesílání zprávy.');
    }

    // Diagnostika – uložíme response pro `copy(window.__XCT_LAST_SEND.html)`.
    let respHtml = '';
    let respBytes = 0;
    try {
      const buf = await res.arrayBuffer();
      respBytes = buf.byteLength;
      respHtml = new TextDecoder('iso-8859-2').decode(buf);
      (window as unknown as Record<string, unknown>).__XCT_LAST_SEND = {
        action,
        body,
        text,
        target: tgt,
        status: res.status,
        html: respHtml,
      };
    } catch {
      /* ignore */
    }
    XCT_LOG.http(action, res.status, respBytes, performance.now() - t0, 'POST');

    if (!res.ok) {
      XCT_LOG.error('submitMessageToRoom: HTTP', res.status);
      throw new Error(`HTTP ${res.status} při odesílání zprávy.`);
    }

    // XChat při invalidním WTKN vrací stránku s hláškou typu „neplatný token".
    // Detekujeme to a rejectujeme, aby sendMessageToRoom mohl zkusit obnovit.
    if (/neplatn[ýy]?\s*(wtkn|token)|invalid\s*(wtkn|token)/i.test(respHtml)) {
      XCT_LOG.warn('submitMessageToRoom: server hlásí problém s WTKN');
      throw new Error('Neplatný WTKN token.');
    }

    XCT_LOG.info('submitMessageToRoom: OK', { status: res.status });
  }

  /**
   * High-level fasáda: ekvivalent PHP `XChatRooms::sendMessageToRoom`.
   * Když volající už zná WTKN (cachovaný), předá ho; jinak si ho sami
   * vytáhneme. Při chybě obnovíme WTKN a zkusíme ještě jednou.
   *
   * Vrací aktuální WTKN (aby si ho volající mohl zacachovat).
   */
  static async sendMessageToRoom(
    xhash: string,
    rid: number,
    skin: SkinId,
    text: string,
    target: string,
    cachedWtkn?: string | null,
  ): Promise<{ wtkn: string }> {
    let wtkn = cachedWtkn ?? null;
    if (!wtkn) {
      wtkn = await XChatRooms.getWtknToken(xhash, rid, skin);
      if (!wtkn) throw new Error('Nepodařilo se získat WTKN token.');
    }

    try {
      await XChatRooms.submitMessageToRoom(xhash, rid, skin, wtkn, text, target);
      return { wtkn };
    } catch (err) {
      XCT_LOG.warn('sendMessageToRoom: 1. pokus selhal, obnovuji WTKN', err);
      const fresh = await XChatRooms.getWtknToken(xhash, rid, skin);
      if (!fresh) throw err;
      await XChatRooms.submitMessageToRoom(xhash, rid, skin, fresh, text, target);
      return { wtkn: fresh };
    }
  }
}

// ─── Zprávy v místnosti ─────────────────────────────────────────────────────

export class XChatMessages {
  /** Výčet tříd, které označují tělo zprávy (podle původního XChat HTML). */
  private static readonly UMSG_SELECTOR =
    '.umsg_room, .umsg_roomi, .umsg_whisper, .umsg_whisperi, ' +
    '.umsg_wcross, .umsg_wcrossi, .umsg_wsystem, .umsg_advert, ' +
    '.umsg_whw, .umsg_whwi';

  private static readonly TIME_RE = /\b(\d{1,2}:\d{2}:\d{2})\b(?=\s*<)/g;

  /**
   * Parser stránky `op=roomtopng`.
   *
   * XChat nerenderuje zprávy do `<div>`. Všechny zprávy jsou sourozenci
   * uvnitř `<body><font face="…"><font size="…">…` a oddělené pouze
   * textovým časovým razítkem `HH:MM:SS`, které zprávu **předchází**
   * (uvnitř téhož `<font>`):
   *
   * ```
   * 22:20:59 <font color="#de356d"><span class="umsg_wcross">
   *   <b>Anitram89-&gt;Elza:</b> ahoj <img …>
   * </span></font>
   * 22:21:02 <span class="umsg_room"><b>Petr:</b> text</span>
   * ```
   *
   * Proto HTML rozdělíme podle času (jako oddělovače) a v každém kusu
   * najdeme **vnější** `.umsg_*` (vnořený nick-link `.umsg_wcross` uvnitř
   * ignorujeme) nebo `.systemtext`.
   */
  static parseMessagesPage(doc: Document): RoomMessage[] {
    const body = doc.body;
    if (!body) return [];
    const html = body.innerHTML;

    // split kept delimiter (čas) → [preamble, time1, chunk1, time2, chunk2, …]
    const parts = html.split(this.TIME_RE);
    const messages: RoomMessage[] = [];

    for (let i = 1; i < parts.length; i += 2) {
      const time = parts[i];
      const chunk = parts[i + 1] ?? '';
      if (!chunk.trim()) continue;
      const frag = doc.createElement('div');
      frag.innerHTML = chunk;

      // Najdeme první (tedy vnější) .umsg_* span, nebo .systemtext.
      const umsg = this.findOuterUmsg(frag);
      const sys = frag.querySelector('.systemtext') as HTMLElement | null;
      const parsed = umsg
        ? this.parseUmsg(umsg, time, i)
        : sys
          ? this.parseSystemText(sys, time, i)
          : null;
      if (parsed) messages.push(parsed);
    }

    return messages;
  }

  /** První `.umsg_*` element, který NENÍ vnořený uvnitř jiného `.umsg_*`. */
  private static findOuterUmsg(root: HTMLElement): HTMLElement | null {
    const all = root.querySelectorAll<HTMLElement>(this.UMSG_SELECTOR);
    for (const el of all) {
      if (!el.parentElement) continue;
      const parent = el.parentElement.closest(this.UMSG_SELECTOR);
      if (!parent) return el;
    }
    return null;
  }

  private static parseUmsg(
    umsg: HTMLElement,
    time: string,
    idx: number,
  ): RoomMessage {
    const cls = umsg.className;
    let kind: RoomMessageKind = 'message';
    if (/umsg_advert/.test(cls)) kind = 'advert';
    else if (/umsg_wsystem/.test(cls)) kind = 'system';
    else if (/umsg_whisper|umsg_wcross|umsg_whw/.test(cls)) kind = 'whisper';
    const outgoing = /umsg_roomi|umsg_whisperi|umsg_wcrossi|umsg_whwi/.test(cls);

    // `<font color="...">` obaluje umsg span – vytáhneme barvu.
    const fontEl = umsg.closest('font[color]');
    const color = fontEl ? fontEl.getAttribute('color') : null;

    // Reklama nemá klasický `<b>Nick:</b>` prefix – XChat ji formátuje jako
    //   `<img src="ikona"> <b>Text: <a href="…">odkaz</a></b>`
    // Chceme zachovat i obrázek i odkaz → necháme obsah beze změny.
    if (kind === 'advert') {
      return {
        id: `${kind}-${idx}-${time}`,
        kind,
        outgoing: false,
        time,
        nick: null,
        html: umsg.innerHTML.trim(),
        text: (umsg.textContent ?? '').trim(),
        color,
      };
    }

    // Formáty `<b>…</b>`, které XChat posílá:
    //   • `<b>Petr:</b>`                                              … zpráva v místnosti
    //   • `<b>Sender-&gt;Recipient:</b>`                              … šept v místnosti
    //   • `<b><a whisper_to='Sender'>Me</a>-&gt;[Room]Sender:</b>`    … **příchozí** šept z jiné místnosti
    //     (odkaz drží jen nick pro ODPOVĚĎ, zobrazovaný nick je v bold textu PŘED `->`)
    //
    // Proto nick i target čteme primárně z textu `<b>`, nikdy ne z
    // `whisper_to(...)` – ten slouží jen jako fallback, když bold nemá
    // šipku ani nic rozumného.
    const bold = umsg.querySelector('b');
    let nick: string | null = null;
    let targetNick: string | null = null;

    if (bold) {
      const boldText = (bold.textContent ?? '').trim().replace(/:$/, '');
      const arrow = boldText.match(/^(.+?)\s*->\s*(.+)$/);
      if (arrow) {
        nick = arrow[1].trim();
        targetNick = arrow[2].trim();
      } else {
        // Bez šipky – zahoďme případný prefix `[Role]` a zbytek je nick.
        nick = boldText.replace(/^\[[^\]]*\]\s*/, '').trim();
      }

      // Fallback: pokud se nick nepovedlo vytáhnout z textu, zkusíme
      // `javascript:whisper_to('X')` (nick pro odpověď, ne displayed).
      if (!nick) {
        const link = bold.querySelector<HTMLAnchorElement>('a[href*="whisper_to"]');
        const m = link
          ? (link.getAttribute('href') ?? '').match(
              /whisper_to\s*\(\s*['"]([^'"]+)['"]\s*\)/,
            )
          : null;
        if (m) nick = m[1];
      }
    }

    // Obsah za `<b>`: zachováme HTML včetně obrázků smajlíků.
    let contentHtml = '';
    let contentText = '';
    if (bold) {
      let n: ChildNode | null = bold.nextSibling;
      while (n) {
        if (n.nodeType === Node.TEXT_NODE) {
          contentHtml += (n as Text).data;
          contentText += (n as Text).data;
        } else if (n.nodeType === Node.ELEMENT_NODE) {
          contentHtml += (n as Element).outerHTML;
          contentText += (n as Element).textContent ?? '';
        }
        n = n.nextSibling;
      }
    } else {
      contentHtml = umsg.innerHTML;
      contentText = umsg.textContent ?? '';
    }
    contentHtml = contentHtml.trim();
    contentText = contentText.trim();

    // Detekce zvláštních systémových zpráv typu `System->Me: …`.
    let isBadCommand = false;
    let isSelfKickAttempt = false;
    let systemEvent: 'join' | 'leave' | 'kick' | null = null;
    if (kind === 'system') {
      const txt = contentText.toLowerCase();
      if (/špatný příkaz/i.test(contentText)) isBadCommand = true;
      if (/pokouší\s+vykopnout/.test(txt)) isSelfKickAttempt = true;

      // Veřejné vyhození administrátorem – chceme ho vizuálně červeně
      // jako standardní kick events. Typicky:
      //   „Uživatel(ka) X byl(a) vyhozen(a) administrátorem Y ze všech
      //    místností".
      // Potvrzení mého vlastního /kick (`Nick X byl vykopnut`) sem vědomě
      // NEpatří – to je jen systémová odpověď mně, nemá se zvýrazňovat.
      if (/\buživatel(?:ka)?\s+\S+\s+byl[a]?\s+vyhozen/i.test(contentText)) {
        systemEvent = 'kick';
      }
    }

    return {
      id: `${kind}-${idx}-${time}`,
      kind,
      outgoing,
      time,
      nick,
      targetNick,
      html: contentHtml,
      text: contentText,
      color,
      isBadCommand: isBadCommand || undefined,
      isSelfKickAttempt: isSelfKickAttempt || undefined,
      systemEvent,
    };
  }

  private static parseSystemText(
    sys: HTMLElement,
    time: string,
    idx: number,
  ): RoomMessage {
    // XChat ukládá typ události do třídy vnořeného `<b>`:
    //   `<b class="system in …">Nick</b>`     … vstup do místnosti
    //   `<b class="system out …">Nick</b>`    … odchod
    //   `<b class="system kicked …">Nick</b>` … vyhození admin/správcem
    let systemEvent: 'join' | 'leave' | 'kick' | null = null;
    const tag = sys.querySelector<HTMLElement>('b.system');
    if (tag) {
      const tc = tag.className;
      if (/\bin\b/.test(tc)) systemEvent = 'join';
      else if (/\bout\b/.test(tc)) systemEvent = 'leave';
      else if (/\bkicked\b/.test(tc)) systemEvent = 'kick';
    }

    // Heuristika pro admin-správcovské události, které nemají `b.system`
    // (XChat je posílá jen s obyčejným `<b>`): např. „Administrátor X předal
    // správcovství uživateli Y", „X sebral správcovství uživateli Y".
    // Vizuálně je chceme ve stejné kategorii jako kick (malé písmo + červená).
    if (!systemEvent) {
      const txt = (sys.textContent ?? '').toLowerCase();
      if (
        txt.includes('předal správcovství') ||
        txt.includes('sebral správcovství') ||
        txt.includes('odebral správcovství')
      ) {
        systemEvent = 'kick';
      }
      // Veřejná systémová hláška „Uživatel(ka) X byl(a) vyhozen(a)
      // administrátorem …" – tu XChat zobrazuje jako `.systemtext`, ne
      // jako `umsg_wsystem`. Taky ji chceme červeně (respektuje
      // přepínač „Zvýraznit vyhození z místnosti").
      if (/uživatel(?:ka)?\s+\S+\s+byl[a]?\s+vyhozen/i.test(txt)) {
        systemEvent = 'kick';
      }
    }

    return {
      id: `sys-${idx}-${time}`,
      kind: 'system',
      outgoing: false,
      time,
      nick: null,
      // XChat uvnitř závorek přidává mezeru před `)` (např.
      // „… (45 minut nepromluvil )"). Odstraníme ji kosmeticky v HTML i textu.
      html: sys.innerHTML.trim().replace(/ \)/g, ')'),
      text: (sys.textContent ?? '').trim().replace(/ \)/g, ')'),
      systemEvent,
    };
  }

  /**
   * Post-processing nad seznamem zpráv z XChatu:
   *
   *  1. **Šepty od `System` o pohybu uživatelů** (`System->Me: Uživatelka X
   *     vstoupila do místnosti Y`) → zobrazíme jako běžnou systémovou
   *     zprávu bez `System->Me:` prefixu. Nick uživatele v textu se stane
   *     klikatelným odkazem (data-atribut, klik zachytí MessageBoard
   *     a zavolá onSelectUser).
   *  2. **Výsledek /team broadcastu** (dvojice `Team: …` + `Zapsáno pro N
   *     administrátorů do celkem M místností`) → sloučíme do jedné
   *     odchozí whisper-zprávy `Elza->Team (N/M): …`.
   */
  static transformSystemWhispers(
    messages: RoomMessage[],
    myNick: string,
  ): RoomMessage[] {
    if (!myNick) return messages;

    // `my_nick` z XChatu chodí v lowercase – pro zobrazení u odchozích
    // Team whisperů vytáhneme správně napsaný nick z jakékoli odchozí
    // zprávy v seznamu (tam ho XChat posílá ve `<b>Nick:</b>` se
    // zachovanou velikostí písmen). Fallback: velké první písmeno.
    const myNickLower = myNick.toLowerCase();
    const displayNick =
      messages.find(
        (mm) =>
          mm.outgoing &&
          !!mm.nick &&
          mm.nick.toLowerCase() === myNickLower,
      )?.nick ||
      myNick.charAt(0).toUpperCase() + myNick.slice(1);

    const JOIN_FULL_RE = /vstoupil[a]?\s+do\s+místnosti/i;
    const LEAVE_FULL_RE = /opustil[a]?\s+(?:místnost|do\s+místnosti)/i;
    const NICK_IN_TEXT_RE = /^\s*Uživatel(?:ka)?\s+(\S+?)\s+(?:vstoupil|opustil)/i;
    const ZAPSANO_RE =
      /^Zapsáno\s+pro\s+(\d+)\s+administrátor\S*\s+do\s+celkem\s+(\d+)\s+místnost\S*/i;
    const TEAM_PREFIX_RE = /^Team:\s*/i;

    const isSystemFromSystem = (m: RoomMessage): boolean => {
      if (m.kind !== 'system' && m.kind !== 'whisper') return false;
      if (!m.nick || m.nick.toLowerCase() !== 'system') return false;
      if (!m.targetNick) return false;
      return m.targetNick.toLowerCase() === myNick.toLowerCase();
    };

    // 1) Najdeme dvojice Team + Zapsáno (stejný čas, v okolí ±3 indexů).
    const teamReplace = new Map<
      number,
      { html: string; text: string; n: number; m: number }
    >();
    const skip = new Set<number>();
    for (let i = 0; i < messages.length; i++) {
      if (skip.has(i)) continue;
      const msg = messages[i];
      if (!isSystemFromSystem(msg)) continue;
      const zm = ZAPSANO_RE.exec(msg.text);
      if (!zm) continue;
      let teamIdx = -1;
      const from = Math.max(0, i - 3);
      const to = Math.min(messages.length - 1, i + 3);
      for (let j = from; j <= to; j++) {
        if (j === i || skip.has(j) || teamReplace.has(j)) continue;
        const tm = messages[j];
        if (!isSystemFromSystem(tm)) continue;
        if (tm.time !== msg.time) continue;
        if (!TEAM_PREFIX_RE.test(tm.text)) continue;
        teamIdx = j;
        break;
      }
      if (teamIdx < 0) continue;
      const tmsg = messages[teamIdx];
      teamReplace.set(teamIdx, {
        html: tmsg.html.replace(TEAM_PREFIX_RE, ''),
        text: tmsg.text.replace(TEAM_PREFIX_RE, ''),
        n: Number(zm[1]),
        m: Number(zm[2]),
      });
      skip.add(i);
    }

    const result: RoomMessage[] = [];
    for (let i = 0; i < messages.length; i++) {
      if (skip.has(i)) continue;
      const m = messages[i];

      const merge = teamReplace.get(i);
      if (merge) {
        result.push({
          ...m,
          kind: 'whisper',
          outgoing: true,
          nick: displayNick,
          targetNick: `Team (${merge.n}/${merge.m})`,
          html: merge.html,
          text: merge.text,
          systemEvent: null,
        });
        continue;
      }

      if (isSystemFromSystem(m)) {
        const isJoin = JOIN_FULL_RE.test(m.text);
        const isLeave = LEAVE_FULL_RE.test(m.text);
        if (isJoin || isLeave) {
          const nickMatch = NICK_IN_TEXT_RE.exec(m.text);
          const userNick = nickMatch ? nickMatch[1] : null;
          const html = userNick
            ? XChatMessages.wrapNickClickable(m.html, userNick)
            : m.html;
          result.push({
            ...m,
            // Z whisperu vyrábíme systémovou zprávu – sjednotí styling
            // s ostatními join/leave hláškami (.xct-msg--system).
            kind: 'system',
            nick: null,
            targetNick: null,
            html,
            // Cíleně NEnastavujeme systemEvent – tato událost se odehrála
            // v JINÉ místnosti, nesmí triggerovat refresh našich uživatelů.
            systemEvent: null,
          });
          continue;
        }
      }
      result.push(m);
    }
    return result;
  }

  /**
   * Obalí první výskyt `nick` v textové části HTML klikatelným `<a>`
   * s data-atributem `data-xct-whisper-nick`. MessageBoard zachytí klik
   * přes event delegaci a zavolá `onSelectUser`. Pokud nick v HTML není
   * nebo parsing selže, vrátí původní HTML.
   */
  private static wrapNickClickable(html: string, nick: string): string {
    try {
      const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
      const root = doc.body.firstElementChild as HTMLElement | null;
      if (!root) return html;
      const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node: Node | null = walker.nextNode();
      while (node) {
        const t = node.textContent ?? '';
        const idx = t.indexOf(nick);
        if (idx < 0) {
          node = walker.nextNode();
          continue;
        }
        const parent = node.parentNode;
        if (!parent) break;
        const before = t.slice(0, idx);
        const after = t.slice(idx + nick.length);
        const a = doc.createElement('a');
        a.className = 'xct-msg__nick-click';
        a.setAttribute('data-xct-whisper-nick', nick);
        a.textContent = nick;
        if (before) parent.insertBefore(doc.createTextNode(before), node);
        parent.insertBefore(a, node);
        if (after) parent.insertBefore(doc.createTextNode(after), node);
        parent.removeChild(node);
        break;
      }
      return root.innerHTML;
    } catch {
      return html;
    }
  }
}

// ─── Uživatelé v místnosti (wwpageng) ───────────────────────────────────────

export class XChatRoomUsers {
  /** Parsne `HH:MM:SS` na sekundy; `""` / invalid → 0. */
  private static parseHms(s: string): number {
    const m = (s || '').trim().match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
    if (!m) return 0;
    return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }

  /**
   * Parser `op=wwpageng` – HTML s tabulkou uživatelů v místnosti.
   *
   * Každý `<tr>` má 7 `<td>`:
   *   0 = hvězdička `<img src="…/star/x{N}.gif">` (N=1..5; někdy x8)
   *   1 = pohlaví   `<img src="…/rm/{mn|wn}{_c}?.gif">`
   *                 mn = muž, wn = žena; `_c` = certifikovaný (ověřený)
   *   2 = nick (plain text)
   *   3 = online čas HH:MM:SS (jak dlouho je v místnosti)
   *   4 = nemluvil  HH:MM:SS (idle)
   *   5 = `<a>vzkaz</a>`
   *   6 = `<a>profil</a>`
   *
   * Header řádek (který má `<strong>Online</strong>`) přeskakujeme.
   */
  static parseUsersPage(doc: Document): RoomUser[] {
    const out: RoomUser[] = [];
    const seen = new Set<string>();

    const rows = doc.querySelectorAll<HTMLTableRowElement>('tr');
    let skippedHeader = false;
    let totalRows = 0;

    rows.forEach((tr) => {
      const tds = tr.querySelectorAll<HTMLTableCellElement>(':scope > td');
      if (tds.length < 7) return;

      // Header řádek má v buňkách <strong>Online</strong>, <strong>Nemluvil</strong>…
      if (!skippedHeader && tr.querySelector('strong')) {
        skippedHeader = true;
        return;
      }
      totalRows++;

      // 0 – star (x0=žádná, x1=černá, x2=modrá, x4=zelená, x8=žlutá, x16=červená)
      let star: Star = 0 as Star;
      const starImg = tds[0].querySelector<HTMLImageElement>('img[src*="/star/"]');
      if (starImg) {
        const m = starImg.getAttribute('src')?.match(/\/star\/x(\d+)\.gif/i);
        const n = m ? Number(m[1]) : 0;
        // Povolené hodnoty: 0, 1, 2, 4, 8, 16. Ostatní → 0.
        star = ([0, 1, 2, 4, 8, 16].includes(n) ? n : 0) as Star;
      }

      // 1 – pohlaví (mn/wn) + certifikace (_c)
      let sex: Sex = 0 as Sex;
      let certified = false;
      const sexImg = tds[1].querySelector<HTMLImageElement>('img[src*="/rm/"]');
      if (sexImg) {
        const src = sexImg.getAttribute('src') || '';
        // wn = žena (1), mn = muž (0); _c = certifikovaný
        const m = src.match(/\/rm\/(mn|wn)(_c)?\.gif/i);
        if (m) {
          sex = (m[1].toLowerCase() === 'wn' ? 1 : 0) as Sex;
          certified = Boolean(m[2]);
        }
      }

      // 2 – nick
      const nick = (tds[2].textContent ?? '').trim();
      if (!nick) return;
      const key = nick.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);

      // 3 – online od (HH:MM:SS)
      const onlineSince = (tds[3].textContent ?? '').trim();

      // 4 – idle (nemluvil) – tohle je to, co zobrazujeme v závorce
      const idleSeconds = XChatRoomUsers.parseHms((tds[4].textContent ?? ''));

      out.push({
        nick,
        idleSeconds,
        onlineSince,
        star,
        sex,
        certified,
        isAdmin: false,
        avatarUrl: undefined,
      });
    });

    XCT_LOG.info(
      `parseUsersPage: ${out.length} uživatelů (${totalRows} dat. řádků)`,
      out.map((u) => ({
        nick: u.nick,
        sex: u.sex,
        cert: u.certified,
        star: u.star,
        idle: u.idleSeconds,
      })),
    );

    return out;
  }

  /**
   * Parser dodatečných metadat ze stránky `op=wwpageng`:
   *  - `createdAgo` – text ze `<legend>` ve tvaru „107364:06:49 hod." (jak
   *    dlouho je místnost založena); může být i null, když legend není.
   *  - `descriptionHtml` – HTML popisku místnosti (vč. smajlíků `<img>`),
   *    vytažené z uzlu za `<strong>Popisek místnosti</strong>:`.
   */
  static parseRoomInfo(doc: Document): {
    createdAgo: string | null;
    descriptionHtml: string;
  } {
    // „Místnost (založena před: 107364:06:49 hod.)"
    let createdAgo: string | null = null;
    const legends = doc.querySelectorAll<HTMLLegendElement>('legend');
    legends.forEach((lg) => {
      const t = (lg.textContent ?? '').replace(/\u00a0/g, ' ').trim();
      const m = t.match(/zalo\u017eena p\u0159ed:\s*([^)]+)/i);
      if (m && !createdAgo) createdAgo = m[1].trim();
    });

    // Popisek místnosti – uzly za <strong>Popisek místnosti</strong>:
    // až do nejbližšího <br><br> (dvojice) nebo konce fieldsetu.
    let descriptionHtml = '';
    const strongs = doc.querySelectorAll<HTMLElement>('strong');
    for (const s of Array.from(strongs)) {
      const txt = (s.textContent ?? '').trim();
      if (!/^Popisek m\u00edstnosti$/i.test(txt)) continue;
      const parts: string[] = [];
      let node: Node | null = s.nextSibling;
      let brCount = 0;
      while (node) {
        // Přeskočíme první ": " hned za <strong>.
        if (node.nodeType === Node.TEXT_NODE) {
          const tv = (node.nodeValue ?? '').replace(/^\s*:\s*/, '');
          parts.push(tv);
          node = node.nextSibling;
          continue;
        }
        if (node.nodeType === Node.ELEMENT_NODE) {
          const el = node as HTMLElement;
          if (el.tagName === 'BR') {
            brCount++;
            if (brCount >= 2) break;
            node = node.nextSibling;
            continue;
          }
          brCount = 0;
          if (el.tagName === 'TABLE') break;
          parts.push(el.outerHTML);
        }
        node = node.nextSibling;
      }
      descriptionHtml = parts.join('').replace(/\u00a0/g, ' ').trim();
      break;
    }

    return { createdAgo, descriptionHtml };
  }
}

// ─── Administrátoři ─────────────────────────────────────────────────────────
export class XChatAdmins {
  /** Parser `scripts/admin.php`. */
  static parse(text: string): AdminInfo[] {
    const out: AdminInfo[] = [];
    const lines = (text || '').split('\n');
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].trim().split(/\s+/);
      if (parts.length < 4) continue;
      out.push({
        nick: parts[0],
        sex: (parts[1] === '1' ? 1 : 0) as Sex,
        star: (([0, 1, 2, 4, 8, 16].includes(Number(parts[2]) || 0)
          ? Number(parts[2])
          : 0) as Star),
        online: parts[3] === '1',
      });
    }
    return out;
  }
}

// ─── Emoji ──────────────────────────────────────────────────────────────────

/**
 * Mapa „číslo → IMG tag" pro emoji XChatu. Původní PHP funkce `numToEmoji()`
 * transformuje např. `*123*` na obrázek. V TS si uložíme jen pattern a
 * generátor URL; konkrétní seznam „oblíbených" smajlíků je věc Room UI.
 */
export class XChatEmoji {
  static readonly EMOJI_PATTERN = /\*(\d{1,4})\*/g;
  static readonly BASE = 'https://x.ximg.cz/images/x4/sm';

  /**
   * URL obrázku emoji podle čísla – přesný port původní PHP funkce
   * `XChatEmoji::numToEmoji()`.
   *
   * Formát URL je `/x4/sm/<folder>/<num>.gif`, kde `<folder>` určují
   * tři větve PHP regexu `(\d{1,2})|(\d+0\d)|(\d+)(\d{2})`:
   *
   *   1) `\d{1,2}` (1–2cifry)          → folder = celé číslo
   *      `44`   → `/sm/44/44.gif`
   *      `9`    → `/sm/9/9.gif`
   *   2) `\d+0\d` (3+cifry, předposlední je 0) → folder = jen poslední cifra
   *      `105`  → `/sm/5/105.gif`
   *      `100`  → `/sm/0/100.gif`
   *   3) `\d+\d{2}` (ostatní 3+cifry) → folder = poslední 2 cifry
   *      `123`  → `/sm/23/123.gif`
   *      `1234` → `/sm/34/1234.gif`
   *
   * Dřívější implementace (`s.length<=2 ? s[0] : s.substring(0,2)`) byla
   * chybná: pro `44` vracela `/sm/4/44.gif` (správně `/sm/44/44.gif`)
   * a pro `123` vracela `/sm/12/123.gif` (správně `/sm/23/123.gif`).
   */
  static url(num: number): string {
    const s = String(num);
    let folder: string;
    if (s.length <= 2) {
      folder = s;
    } else if (s.charAt(s.length - 2) === '0') {
      folder = s.charAt(s.length - 1);
    } else {
      folder = s.slice(-2);
    }
    return `${this.BASE}/${folder}/${num}.gif`;
  }

  /** Nahradí *123* v textu HTML obrázkem. */
  static enrich(text: string): string {
    return text.replace(this.EMOJI_PATTERN, (_m, num) => {
      const url = this.url(Number(num));
      return `<img src="${url}" alt="*${num}*" title="*${num}*" class="xchat-smile">`;
    });
  }
}

// ─── Katalog smajlíků (/settings/smiles.php) ────────────────────────────────

/** Jeden smajlík z katalogu nastavení – číslo, popisek a případná URL. */
export interface SmileCatalogEntry {
  /** Číslo smajlíka (např. 44 → používáme jako `*44*`). */
  num: number;
  /** Popisek ze stránky (např. „Skoro jako na kolotoči"). */
  desc: string;
  /**
   * URL obrázku. V katalogu XChatu je to `https://x.ximg.cz/images/x4/sm/…`,
   * ale stejně ho dopočítáme přes {@link XChatEmoji.url}; pole tu jen
   * zachovává původní URL, kdyby server vrátil něco jiného (XL varianty).
   */
  imgUrl: string;
}

/** Jedna stránka katalogu + informace o paginaci. */
export interface SmilesCatalogPage {
  items: SmileCatalogEntry[];
  page: number;
  maxPage: number;
}

/**
 * Parser stránky `Nastavení XChatu → Nastavení smajlíků`.
 * DOM: tabulka pod `<h1 class="nadpis4">Smajlíci</h1>`, řádky mají trojici
 * buněk `*N*` / `<img>` / popis. Paginátor je na konci tabulky a obsahuje
 * odkaz „Poslední" se stránkou v `?page=…`.
 */
export class XChatSmilesCatalog {
  static parseSmilesPage(doc: Document): SmilesCatalogPage {
    const items: SmileCatalogEntry[] = [];
    const rows = doc.querySelectorAll<HTMLTableRowElement>(
      '#stredni table tr, #telo-in table tr',
    );
    rows.forEach((row) => {
      const tds = row.querySelectorAll('td');
      if (tds.length < 3) return;
      const label = (tds[0]?.textContent ?? '').trim();
      const m = label.match(/^\*(\d{1,4})\*$/);
      if (!m) return;
      const num = Number(m[1]);
      const img = tds[1]?.querySelector('img');
      const imgUrl = img?.getAttribute('src') ?? XChatEmoji.url(num);
      const desc = (tds[2]?.textContent ?? '').trim();
      items.push({ num, desc, imgUrl });
    });

    // Paginátor: buď odkaz „Poslední" (strana = číslo), nebo nejvyšší page v odkazech.
    let maxPage = 1;
    doc
      .querySelectorAll<HTMLAnchorElement>('a[href*="smiles.php?"], a[href*="page="]')
      .forEach((a) => {
        const href = a.getAttribute('href') ?? '';
        const mm = href.match(/[?&]page=(\d+)/);
        if (!mm) return;
        const p = Number(mm[1]);
        if (p > maxPage) maxPage = p;
      });

    // Aktuální strana – z <input id="page"> uvnitř formuláře „Jdi".
    let page = 1;
    const pageInput = doc.querySelector<HTMLInputElement>('input#page');
    if (pageInput) {
      const p = Number(pageInput.value);
      if (Number.isFinite(p) && p > 0) page = p;
    }

    return { items, page, maxPage };
  }

  /**
   * Načte všechny stránky katalogu smajlíků (≈115 × ~50 položek) a vrátí
   * jednotné pole seřazené podle čísla. Použití zdůvodňuje `search-txt`
   * fulltext, který chceme mít lokálně v Sidebaru bez dalších requestů.
   *
   * Volající by si měl výsledek zcachovat (in-memory nebo `chrome.storage`),
   * protože každý fetch = 1 request na XChat.
   */
  static async fetchAll(xhash: string): Promise<SmileCatalogEntry[]> {
    const firstDoc = await XChatHttp.fetchDocument(
      XChatUrls.smilesPage(xhash, { page: 1 }),
    );
    const first = this.parseSmilesPage(firstDoc);
    const all: SmileCatalogEntry[] = [...first.items];
    if (first.maxPage > 1) {
      for (let p = 2; p <= first.maxPage; p++) {
        const doc = await XChatHttp.fetchDocument(
          XChatUrls.smilesPage(xhash, { page: p }),
        );
        all.push(...this.parseSmilesPage(doc).items);
      }
    }
    // Deduplikace (server občas odpadky opakuje) + seřazení vzestupně.
    const seen = new Set<number>();
    const out: SmileCatalogEntry[] = [];
    for (const e of all) {
      if (seen.has(e.num)) continue;
      seen.add(e.num);
      out.push(e);
    }
    out.sort((a, b) => a.num - b.num);
    return out;
  }
}

// ─── Ignorace (seznam ignorovaných uživatelů) ───────────────────────────────

/**
 * Parser a endpointy pro stránku `modchat?op=ignorepage`.
 *
 * Výpis:  sekvence `<p><em><a href="...ign_delete=NICK&rid=…"><img …/></a></em>NICK\n</p>`.
 * Přidání: GET `modchat?op=ignorepage&inick=NICK&ign_submit=Přidat&rid=…&js=1&skin=…`.
 * Smazání: GET `modchat?op=ignorepage&ign_delete=NICK&rid=…&js=1&skin=…`.
 *
 * XChat vrací znovu tu samou ignorepage s aktualizovaným seznamem –
 * po každé mutaci znovu naparsujeme odpověď, abychom viděli autoritativní
 * stav bez dalšího roundtripu.
 */
export class XChatIgnore {
  /**
   * Vrátí pole nicků ze stránky `op=ignorepage`. Jako zdroj pravdy bereme
   * atribut `ign_delete=…` v odkazech – uvnitř je v URL zakódovaný původní
   * nick (XChat za něj připojuje LF, který ořežeme).
   */
  static parseIgnoreList(doc: Document): string[] {
    const seen = new Set<string>();
    const nicks: string[] = [];
    const anchors = doc.querySelectorAll<HTMLAnchorElement>('a[href*="ign_delete="]');
    for (const a of anchors) {
      const href = a.getAttribute('href') ?? '';
      const m = href.match(/[?&]ign_delete=([^&]+)/);
      if (!m) continue;
      let nick = '';
      try {
        nick = decodeURIComponent(m[1].replace(/\+/g, ' '));
      } catch {
        nick = m[1];
      }
      nick = nick.replace(/[\r\n]+/g, '').trim();
      if (!nick || seen.has(nick)) continue;
      seen.add(nick);
      nicks.push(nick);
    }
    nicks.sort((a, b) => a.localeCompare(b, 'cs', { sensitivity: 'base' }));
    return nicks;
  }

  /** URL pro přidání nicku do ignorace. */
  static addUrl(xhash: string, rid: number, skin: SkinId, nick: string): string {
    return XChatUrls.modchatOp(xhash, {
      op: 'ignorepage',
      rid,
      skin,
      js: 1,
      inick: nick,
      ign_submit: 'Přidat',
    });
  }

  /** URL pro odebrání nicku z ignorace. */
  static deleteUrl(xhash: string, rid: number, skin: SkinId, nick: string): string {
    return XChatUrls.modchatOp(xhash, {
      op: 'ignorepage',
      rid,
      skin,
      js: 1,
      ign_delete: nick,
    });
  }
}

// ─── Online pomoc (op=onlinehelppage) ───────────────────────────────────────

/**
 * Parser stránky `modchat?op=onlinehelppage`.
 *
 * HTML má strukturu:
 *   <p class="nadpis">ONLINE POMOC</p>
 *   <p class="nadpis1">Stálí správci</p>
 *   <p><em><img src=".../star/xN.gif"><img src=".../rm/{mn|wn}[_c].gif"></em>
 *      <a onclick="userPopup('NICK',…)">NICK</a></p>
 *   …
 *   <p class="nadpis1">Administrátoři</p>
 *   …
 *
 * Nick bereme primárně z `onclick="userPopup('NICK',…"` (spolehlivé,
 * HTML entity rozparsované prohlížečem), fallback je textový obsah `<a>`.
 */
export class XChatOnlineHelp {
  private static readonly STAR_RE = /\/star\/x(\d+)\.gif/i;
  private static readonly SEX_RE = /\/rm\/(mn|wn)(_c)?\.gif/i;
  private static readonly USER_POPUP_RE = /userPopup\(\s*['"]([^'"]+)['"]/;

  static parse(doc: Document): OnlineHelpPage {
    const permanent: OnlineHelpUser[] = [];
    const admins: OnlineHelpUser[] = [];
    let section: 'permanent' | 'admins' | null = null;

    // Projdeme všechny <p> v pořadí a podle `class="nadpis1"` přepínáme
    // sekci. Zbytek jsou řádky s uživateli.
    const paragraphs = doc.querySelectorAll<HTMLParagraphElement>('p');
    for (const p of paragraphs) {
      if (p.classList.contains('nadpis1')) {
        const label = (p.textContent ?? '').trim().toLowerCase();
        if (label.startsWith('stálí správci') || label.startsWith('stali spravci')) {
          section = 'permanent';
        } else if (label.startsWith('administrátoři') || label.startsWith('administratori')) {
          section = 'admins';
        } else {
          section = null;
        }
        continue;
      }
      if (!section) continue;

      const user = this.parseRow(p);
      if (!user) continue;
      (section === 'permanent' ? permanent : admins).push(user);
    }

    return { permanent, admins };
  }

  private static parseRow(p: HTMLParagraphElement): OnlineHelpUser | null {
    // Platný user-řádek má <em> s dvěma ikonami (star + sex). Akční odkazy
    // v místnosti (např. „Šeptat") <em> nemají → takové řádky ignorujeme.
    const em = p.querySelector('em');
    if (!em) return null;

    let star: Star = 0;
    let sex: Sex = 0;
    let certified = false;
    let hasSex = false;

    const imgs = em.querySelectorAll<HTMLImageElement>('img');
    for (const img of imgs) {
      const src = img.getAttribute('src') ?? '';
      const starMatch = this.STAR_RE.exec(src);
      if (starMatch) {
        const n = Number(starMatch[1]);
        if (n === 1 || n === 2 || n === 4 || n === 8 || n === 16) star = n;
        continue;
      }
      const sexMatch = this.SEX_RE.exec(src);
      if (sexMatch) {
        sex = sexMatch[1].toLowerCase() === 'wn' ? 1 : 0;
        certified = Boolean(sexMatch[2]);
        hasSex = true;
      }
    }
    if (!hasSex) return null;

    const anchor = p.querySelector<HTMLAnchorElement>('a[onclick*="userPopup"]');
    if (!anchor) return null;
    const onclick = anchor.getAttribute('onclick') ?? '';
    const popupMatch = this.USER_POPUP_RE.exec(onclick);
    const nick = (popupMatch?.[1] ?? '').trim();
    if (!nick) return null;

    return { nick, star, sex, certified };
  }
}

// ─── Oblíbení uživatelé (Notes) ─────────────────────────────────────────────

export class XChatFavourites {
  /**
   * Parser stránky `/~$xhash/notes/?page=N`.
   * Řádky mají třídu `.notesl`; v nich:
   *  - `.notesw130 a[href*=profile.php]` – nick
   *  - `.notesw140 a[href*="/room/intro.php?rid="]` – místnosti (název + rid)
   *  - `.notesw210` – komentář (může obsahovat `<br>`)
   *  - `.notesw35` – 3 flagy (enter, vip, sms) jako `<img src="…1.gif|0.gif">`
   */
  static parseNotesPage(doc: Document): FavouriteUser[] {
    const out: FavouriteUser[] = [];
    doc.querySelectorAll<HTMLElement>('.notesl').forEach((row) => {
      const nickA = row.querySelector<HTMLAnchorElement>(
        '.notesw130 a[href*="profile.php"]',
      );
      const nick = (nickA?.textContent ?? '').trim();
      if (!nick) return;

      const rooms: FavouriteUser['rooms'] = [];
      row.querySelectorAll<HTMLAnchorElement>(
        '.notesw140 a[href*="/room/intro.php?rid="]',
      ).forEach((a) => {
        const m = (a.getAttribute('href') ?? '').match(/[?&]rid=(\d+)/);
        rooms.push({
          rid: m ? Number(m[1]) : 0,
          roomName: (a.textContent ?? '').trim(),
        });
      });

      const commentEl = row.querySelector<HTMLElement>('.notesw210');
      const comment: string[] = [];
      if (commentEl) {
        const raw = commentEl.innerHTML.replace(/<br\s*\/?>/gi, '\n');
        commentEl.innerHTML = raw;
        for (const line of (commentEl.textContent ?? '').split('\n')) {
          const t = line.trim();
          if (t) comment.push(t);
        }
      }

      const flags = row.querySelectorAll<HTMLImageElement>('.notesw35 img');
      const onFlag = (i: number): boolean => {
        const src = flags[i]?.getAttribute('src') ?? '';
        return /1\.(gif|png)/i.test(src);
      };

      out.push({
        nick,
        enter: onFlag(0),
        vip: onFlag(1),
        sms: onFlag(2),
        rooms,
        comment,
      });
    });
    return out;
  }

  /**
   * Vytáhne max. číslo stránky z paginátoru `#mn a[href*=page=]`.
   * Pokud ho nenajde, vrátí 1 (jediná stránka).
   */
  static parseMaxPage(doc: Document): number {
    let max = 1;
    doc.querySelectorAll<HTMLAnchorElement>('#mn a[href*="page="]').forEach((a) => {
      const m = (a.getAttribute('href') ?? '').match(/[?&]page=(\d+)/);
      if (m) max = Math.max(max, Number(m[1]));
    });
    return max;
  }
}

// ─── Fasáda ─────────────────────────────────────────────────────────────────

/**
 * Jeden vstupní bod pro veškerou komunikaci s XChat.cz.
 * Metody vrací už zparsované struktury; URL/HTTP/parsery jsou v třídách výše.
 */
export class XChatApi {
  // Re-export statických tříd pro pohodlné `XChatApi.Urls.xxx` …
  static readonly Http = XChatHttp;
  static readonly Urls = XChatUrls;
  static readonly Users = XChatUsers;
  static readonly Rooms = XChatRooms;
  static readonly Messages = XChatMessages;
  static readonly RoomUsers = XChatRoomUsers;
  static readonly Admins = XChatAdmins;
  static readonly Emoji = XChatEmoji;
  static readonly Favourites = XChatFavourites;
  static readonly SmilesCatalog = XChatSmilesCatalog;

  // ── Uživatelé ────────────────────────────────────────────────────────────

  /** Detail uživatele nebo `null`. */
  static async getUserDetail(nick: string): Promise<UserDetail | null> {
    const n = nick.trim();
    if (!n) return null;
    try {
      const text = await XChatHttp.fetchPlain(XChatUrls.userInfo(n));
      return XChatUsers.parseUserDetail(text, n);
    } catch {
      return null;
    }
  }

  /** Kde je uživatel online. */
  static async getWhereOnline(nick: string): Promise<WhereOnline> {
    const n = nick.trim();
    if (!n) return { online: false, rooms: [] };
    try {
      const text = await XChatHttp.fetchPlain(XChatUrls.wonline(n));
      return XChatUsers.parseWhereOnline(text);
    } catch {
      return { online: false, rooms: [] };
    }
  }

  /** Jednoduchá binární online/offline kontrola. */
  static async isOnline(nick: string): Promise<boolean> {
    try {
      const text = await XChatHttp.fetchPlain(XChatUrls.onlineText(nick));
      return text.trim() === '1';
    } catch {
      return false;
    }
  }

  // ── Místnosti ────────────────────────────────────────────────────────────

  static async getRoomsList(): Promise<RoomListItem[]> {
    const text = await XChatHttp.fetchPlain(XChatUrls.roomsList());
    return XChatRooms.parseRoomsList(text);
  }

  static async getRoomDetail(rid: number): Promise<RoomDetail | null> {
    const text = await XChatHttp.fetchPlain(XChatUrls.roomInfo(rid));
    return XChatRooms.parseRoomDetail(text);
  }

  /**
   * Na\u010dte ve\u0159ejnou intro str\u00e1nku m\u00edstnosti a vyt\u00e1hne z n\u00ed podm\u00ednky /
   * pravidla (sexwarn, disclaimer, omezen\u00ed vstupu). Vrac\u00ed HTML \u0159et\u011bzec,
   * kter\u00fd jde rovnou vsadit p\u0159es `dangerouslySetInnerHTML`.
   */
  static async getRoomRules(rid: number): Promise<string | null> {
    try {
      const html = await XChatHttp.fetchIsoText(XChatUrls.roomIntro(rid));
      return XChatRooms.parseRoomRulesHtml(html);
    } catch (err) {
      XCT_LOG.warn('getRoomRules selhal:', err);
      return null;
    }
  }

  /** Načte a naparsuje dialog `modchat?op=roominfo&rid=…`. */
  static async getRoomInfoDialog(xhash: string, rid: number): Promise<RoomInfoDialog> {
    const doc = await XChatHttp.fetchDocument(XChatUrls.roomInfoDialog(xhash, rid));
    return XChatRooms.parseRoomInfoDialog(doc);
  }

  static async getAdmins(): Promise<AdminInfo[]> {
    const text = await XChatHttp.fetchPlain(XChatUrls.admins());
    return XChatAdmins.parse(text);
  }

  /** Načte a naparsuje kontext místnosti ze `xhash/modchat/room/{slug}`. */
  static async getRoomContext(xhash: string, slug: string): Promise<RoomContext | null> {
    const url = XChatUrls.roomEntry(xhash, slug);
    XCT_LOG.info('getRoomContext: fetch', url);
    const html = await XChatHttp.fetchIsoText(url);
    const base = XChatRooms.parseRoomContext(html, xhash);
    if (!base) {
      XCT_LOG.warn(
        'roomEntry HTML neobsahuje rid – prvních 2000 znaků:\n',
        html.slice(0, 2000),
      );
      return null;
    }
    XCT_LOG.info('getRoomContext parsed', base);

    // Pokud nemáme jméno/auth, dotáhneme je z text-page (obsahuje var my_nick,
    // var my_auth atd.). Kotva je rid/skin, které už máme z framesetu.
    if (!base.myNick || !base.roomName) {
      try {
        const txtUrl = XChatUrls.roomTextPage(xhash, base.rid, base.skin);
        XCT_LOG.info('getRoomContext: enrich z textpage', txtUrl);
        const txt = await XChatHttp.fetchIsoText(txtUrl);
        const enrich = XChatRooms.parseRoomContext(txt, xhash);
        if (enrich) {
          const merged = {
            ...base,
            myNick: enrich.myNick || base.myNick,
            roomName: enrich.roomName || base.roomName,
            uid: enrich.uid || base.uid,
            sex: enrich.sex ?? base.sex,
            xhash: enrich.xhash || base.xhash,
            cid: enrich.cid || base.cid,
          };
          XCT_LOG.info('getRoomContext enrich ok', merged);
          return merged;
        }
      } catch (err) {
        XCT_LOG.warn('enrich room context selhal:', err);
      }
    }
    return base;
  }

  /**
   * Varianta {@link getRoomContext}, pokud uživatel přišel na místnost
   * přes URL `modchat?op=mainframeset&rid=…` (bez slugu). Načteme frameset,
   * ze kterého vytáhneme `rid`, `cid`, `skin`; případně doplníme `my_nick`
   * a `roomname` z `op=textpageng`.
   */
  static async getRoomContextByRid(
    xhash: string,
    rid: number,
  ): Promise<RoomContext | null> {
    const url = XChatUrls.modchatOp(xhash, { op: 'mainframeset', rid, js: 1 });
    XCT_LOG.info('getRoomContextByRid: fetch', url);
    const html = await XChatHttp.fetchIsoText(url);
    const base = XChatRooms.parseRoomContext(html, xhash);
    if (!base) {
      XCT_LOG.warn(
        'mainframeset HTML neobsahuje rid – prvních 2000 znaků:\n',
        html.slice(0, 2000),
      );
      return null;
    }
    // Rid ze serveru může být 0, pokud parser nenašel; použijeme jistý z URL.
    const withRid = base.rid ? base : { ...base, rid };
    if (withRid.myNick && withRid.roomName) return withRid;

    try {
      const txtUrl = XChatUrls.roomTextPage(xhash, withRid.rid, withRid.skin);
      const txt = await XChatHttp.fetchIsoText(txtUrl);
      const enrich = XChatRooms.parseRoomContext(txt, xhash);
      if (enrich) {
        return {
          ...withRid,
          myNick: enrich.myNick || withRid.myNick,
          roomName: enrich.roomName || withRid.roomName,
          uid: enrich.uid || withRid.uid,
          sex: enrich.sex ?? withRid.sex,
          xhash: enrich.xhash || withRid.xhash,
          cid: enrich.cid || withRid.cid,
        };
      }
    } catch (err) {
      XCT_LOG.warn('getRoomContextByRid enrich selhal:', err);
    }
    return withRid;
  }

  /** Načte HTML s výpisem zpráv a vrátí parsované zprávy. */
  static async getRoomMessages(
    xhash: string,
    rid: number,
    skin: SkinId,
  ): Promise<RoomMessage[]> {
    const url = XChatUrls.roomMessages(xhash, rid, skin);
    const html = await XChatHttp.fetchIsoText(url);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const messages = XChatMessages.parseMessagesPage(doc);
    if (messages.length === 0) {
      const hasBoard = !!doc.querySelector(
        '.umsg_room, .umsg_whisper, .systemtext, .systemtime',
      );
      XCT_LOG.warn(
        `getRoomMessages → 0 zpráv (hasBoard=${hasBoard}, bytes=${html.length})`,
        { url, snippet: html.slice(0, 1500) },
      );
    } else {
      XCT_LOG.info(`getRoomMessages → ${messages.length} zpráv`, url);
    }
    return messages;
  }

  /** Načte HTML seznamu uživatelů (op=wwpageng) a vrátí parsované uživatele. */
  static async getRoomUsers(
    xhash: string,
    rid: number,
    skin: SkinId,
  ): Promise<RoomUser[]> {
    const url = XChatUrls.roomUsersPage(xhash, rid, skin);
    const html = await XChatHttp.fetchIsoText(url);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const users = XChatRoomUsers.parseUsersPage(doc);
    if (users.length === 0) {
      XCT_LOG.warn(
        `getRoomUsers → 0 uživatelů (bytes=${html.length})`,
        { url, snippet: html.slice(0, 1500) },
      );
    } else {
      XCT_LOG.info(`getRoomUsers → ${users.length} uživatelů`, url);
    }
    return users;
  }

  /**
   * Rozšířená varianta `getRoomUsers` – kromě uživatelů vrací i údaj
   * „založena před" a HTML popisku místnosti (pro overlay Místnosti).
   */
  static async getRoomUsersPage(
    xhash: string,
    rid: number,
    skin: SkinId,
  ): Promise<{ users: RoomUser[]; createdAgo: string | null; descriptionHtml: string }> {
    const url = XChatUrls.roomUsersPage(xhash, rid, skin);
    const html = await XChatHttp.fetchIsoText(url);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const users = XChatRoomUsers.parseUsersPage(doc);
    const info = XChatRoomUsers.parseRoomInfo(doc);
    XCT_LOG.info(
      `getRoomUsersPage → ${users.length} uživatelů, createdAgo=${info.createdAgo ?? '-'}`,
      url,
    );
    return { users, createdAgo: info.createdAgo, descriptionHtml: info.descriptionHtml };
  }

  // ── Odesílání zpráv ──────────────────────────────────────────────────────
  //
  // Tenké delegáty na {@link XChatRooms}. Logika je celá v XChatRooms,
  // aby fasáda zůstala přehledná.

  /** {@link XChatRooms.getWtknToken} */
  static getWtknToken(
    xhash: string,
    rid: number,
    skin: SkinId,
  ): Promise<string | null> {
    return XChatRooms.getWtknToken(xhash, rid, skin);
  }

  /** {@link XChatRooms.submitMessageToRoom} */
  static submitMessageToRoom(
    xhash: string,
    rid: number,
    skin: SkinId,
    wtkn: string,
    text: string,
    target: string,
  ): Promise<void> {
    return XChatRooms.submitMessageToRoom(xhash, rid, skin, wtkn, text, target);
  }

  /** {@link XChatRooms.sendMessageToRoom} */
  static sendMessageToRoom(
    xhash: string,
    rid: number,
    skin: SkinId,
    text: string,
    target: string,
    cachedWtkn?: string | null,
  ): Promise<{ wtkn: string }> {
    return XChatRooms.sendMessageToRoom(xhash, rid, skin, text, target, cachedWtkn);
  }

  // ── Oblíbení (Notes) ─────────────────────────────────────────────────────

  /** Načte všechny stránky `notes/?page=N` a vrátí seznam oblíbených. */
  static async getFavouriteUsers(xhash: string): Promise<FavouriteUser[]> {
    const firstUrl = XChatUrls.notesPage(xhash, 1);
    const firstHtml = await XChatHttp.fetchIsoText(firstUrl);
    const firstDoc = new DOMParser().parseFromString(firstHtml, 'text/html');
    const maxPage = XChatFavourites.parseMaxPage(firstDoc);
    const all: FavouriteUser[] = XChatFavourites.parseNotesPage(firstDoc);
    for (let p = 2; p <= maxPage; p++) {
      try {
        const doc = await XChatHttp.fetchDocument(XChatUrls.notesPage(xhash, p));
        all.push(...XChatFavourites.parseNotesPage(doc));
      } catch (err) {
        XCT_LOG.warn(`getFavouriteUsers: stránka ${p} selhala`, err);
      }
    }
    XCT_LOG.info(`getFavouriteUsers → ${all.length} záznamů (${maxPage} stránek)`);
    return all;
  }

  // ── Ignorace ─────────────────────────────────────────────────────────────

  /** Načte seznam ignorovaných ze stránky `op=ignorepage`. */
  static async getIgnoredUsers(
    xhash: string,
    rid: number,
    skin: SkinId,
  ): Promise<string[]> {
    const doc = await XChatHttp.fetchDocument(XChatUrls.roomIgnorePage(xhash, rid, skin));
    const nicks = XChatIgnore.parseIgnoreList(doc);
    XCT_LOG.info(`getIgnoredUsers → ${nicks.length} nicků`);
    return nicks;
  }

  /**
   * Přidá `nick` do ignorace. XChat v odpovědi vrací aktualizovanou ignorepage
   * – rovnou ji naparsujeme a vrátíme autoritativní seznam.
   */
  static async addIgnoredUser(
    xhash: string,
    rid: number,
    skin: SkinId,
    nick: string,
  ): Promise<string[]> {
    const doc = await XChatHttp.fetchDocument(
      XChatIgnore.addUrl(xhash, rid, skin, nick),
    );
    return XChatIgnore.parseIgnoreList(doc);
  }

  /** Odebere `nick` z ignorace a vrátí aktualizovaný seznam. */
  static async removeIgnoredUser(
    xhash: string,
    rid: number,
    skin: SkinId,
    nick: string,
  ): Promise<string[]> {
    const doc = await XChatHttp.fetchDocument(
      XChatIgnore.deleteUrl(xhash, rid, skin, nick),
    );
    return XChatIgnore.parseIgnoreList(doc);
  }

  // ── Online pomoc ─────────────────────────────────────────────────────────

  /** Načte stálé správce a administrátory ze stránky `op=onlinehelppage`. */
  static async getOnlineHelp(
    xhash: string,
    rid: number,
    skin: SkinId,
  ): Promise<OnlineHelpPage> {
    const doc = await XChatHttp.fetchDocument(
      XChatUrls.roomOnlineHelpPage(xhash, rid, skin),
    );
    const page = XChatOnlineHelp.parse(doc);
    XCT_LOG.info(
      `getOnlineHelp → ${page.permanent.length} stálých, ${page.admins.length} adminů`,
    );
    return page;
  }
}

export default XChatApi;
