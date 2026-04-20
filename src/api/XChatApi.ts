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
  RoomContext,
  RoomDetail,
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

/** Globální přepínač debug-logů (nastavuje se v Settings; default true v devu). */
export const XCT_LOG = {
  enabled: true,
  prefix: '[XChat Toolkit]',
  http(url: string | URL, status: number, bytes: number, ms: number): void {
    if (!this.enabled) return;
    // eslint-disable-next-line no-console
    console.log(
      `${this.prefix} HTTP %c${status}`,
      status >= 200 && status < 300 ? 'color:#2a7' : 'color:#c33',
      `${ms.toFixed(0)} ms, ${bytes} B`,
      String(url),
    );
  },
  info(...args: unknown[]): void {
    if (!this.enabled) return;
    // eslint-disable-next-line no-console
    console.log(this.prefix, ...args);
  },
  warn(...args: unknown[]): void {
    if (!this.enabled) return;
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
    return this.modchatOp(xhash, { op: 'roomtopng', rid, js: 0, skin });
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
  static roomTextPage(xhash: string, rid: number, skin: SkinId): string {
    return this.modchatOp(xhash, { op: 'textpageng', rid, skin, js: 1 });
  }
  static roomAdminPage(xhash: string, rid: number, skin: SkinId): string {
    return this.modchatOp(xhash, { op: 'adminpageng', rid, skin, js: 0 });
  }
  static roomIgnorePage(xhash: string, rid: number, skin: SkinId): string {
    return this.modchatOp(xhash, { op: 'ignorepage', rid, skin, js: 1 });
  }
  static roomUsersPage(xhash: string, rid: number, skin: SkinId): string {
    // `op=wwpageng` je stránka "Výpis uživatelů v místnosti" (Menu → Místnosti).
    // Oproti `userspage` obsahuje tabulku s hvězdičkou, pohlavím, online/idle časy.
    return this.modchatOp(xhash, { op: 'wwpageng', rid, skin, js: 1 });
  }
  static roomSwitchPage(xhash: string, rid: number, skin: SkinId): string {
    return this.modchatOp(xhash, { op: 'menupage', rid, skin, js: 1 });
  }
  static notesPage(xhash: string, page = 1): string {
    return `${this.hashPrefix(xhash)}/notes/?page=${page}`;
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

  /** Parser `scripts/room.php`. */
  static parseRoomDetail(text: string): RoomDetail | null {
    const lines = (text || '').split(/\r?\n/);
    if ((lines[0] ?? '').trim() !== '1') return null;
    return {
      rid: Number(lines[2]) || 0,
      name: (lines[3] ?? '').trim(),
      description: (lines[4] ?? '').trim(),
      createdAt: Number(lines[5]) || null,
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
   * Najde WTKN token ze stránky `op=textpageng` – XChat ho dává
   * do formu jako `<input name="wtkn" value="...">`, do action URL
   * (`?wtkn=...`) nebo do inline JS (`var wtkn='...'`).
   */
  static parseWtkn(html: string): string | null {
    const reInput = /<input[^>]*\bname\s*=\s*['"]wtkn['"][^>]*\bvalue\s*=\s*['"]([^'"]+)/i;
    const m1 = html.match(reInput);
    if (m1) return m1[1];
    const reInput2 = /<input[^>]*\bvalue\s*=\s*['"]([^'"]+)['"][^>]*\bname\s*=\s*['"]wtkn['"]/i;
    const m2 = html.match(reInput2);
    if (m2) return m2[1];
    const reVar = /\bwtkn\s*=\s*['"]([^'"]+)['"]/i;
    const m3 = html.match(reVar);
    if (m3) return m3[1];
    const reUrl = /[?&]wtkn=([^&"'\s<>]+)/i;
    const m4 = html.match(reUrl);
    if (m4) return decodeURIComponent(m4[1]);
    return null;
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
   * Získá WTKN token pro místnost. Vnitřně stáhne `op=textpageng` a
   * vytáhne z něj WTKN přes {@link parseWtkn}. Výsledek si volající
   * cachuje (např. RoomController v `roomStore`).
   */
  static async getWtknToken(
    xhash: string,
    rid: number,
    skin: SkinId,
  ): Promise<string | null> {
    const url = XChatUrls.roomTextPage(xhash, rid, skin);
    const html = await XChatHttp.fetchIsoText(url);
    // Diagnostika – ať má user `copy(window.__XCT_TEXTPAGENG.html)`.
    try {
      (window as unknown as Record<string, unknown>).__XCT_TEXTPAGENG = { url, html };
    } catch {
      /* ignore */
    }
    const wtkn = XChatRooms.parseWtkn(html);
    if (!wtkn) {
      XCT_LOG.warn('getWtknToken: WTKN nenalezen v textpageng', {
        url,
        bytes: html.length,
      });
      return null;
    }
    XCT_LOG.info('getWtknToken ok', { wtknLen: wtkn.length });
    return wtkn;
  }

  /**
   * Pošle zprávu do místnosti – volající již MÁ WTKN token.
   *
   * XChat engine očekává `POST /~$xhash/modchat` s query parametry
   * `op=send&rid=…&skin=…&wtkn=…&wto=TARGET` a tělem ISO-8859-2 form-urlencoded
   * `text=…&submit_text=Poslat`. Používáme skrytý `<form accept-charset>`
   * + iframe, aby browser udělal ISO-8859-2 kódování za nás.
   *
   * @param target `"~"` = všem na sklo; jinak nick konkrétního příjemce.
   */
  static submitMessageToRoom(
    xhash: string,
    rid: number,
    skin: SkinId,
    wtkn: string,
    text: string,
    target: string,
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const wto = target && target !== '' ? target : '~';
      // Pozn.: `wtkn` a `wto` dává XChat tradičně do URL (ne do body).
      const action = XChatUrls.modchatOp(xhash, {
        op: 'send',
        rid,
        skin,
        wtkn,
        wto,
      });

      const iframe = document.createElement('iframe');
      iframe.name = `xct-send-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      iframe.style.cssText =
        'position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;border:0';
      document.body.appendChild(iframe);

      const form = document.createElement('form');
      form.method = 'POST';
      form.action = action;
      form.target = iframe.name;
      form.acceptCharset = 'ISO-8859-2';
      form.enctype = 'application/x-www-form-urlencoded';
      form.style.display = 'none';

      const addField = (name: string, value: string): void => {
        const i = document.createElement('input');
        i.type = 'hidden';
        i.name = name;
        i.value = value;
        form.appendChild(i);
      };

      addField('text', text);
      addField('submit_text', 'Poslat');

      document.body.appendChild(form);

      let finished = false;
      const cleanup = (): void => {
        try {
          iframe.remove();
          form.remove();
        } catch {
          /* ignore */
        }
      };
      const timer = setTimeout(() => {
        if (finished) return;
        finished = true;
        cleanup();
        XCT_LOG.warn('submitMessageToRoom: timeout 10 s');
        // XChat občas nevrací iframe.load – zprávu ale pošle.
        resolve();
      }, 10_000);

      iframe.addEventListener('load', () => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        XCT_LOG.info('submitMessageToRoom: iframe load', { action });
        cleanup();
        resolve();
      });
      iframe.addEventListener('error', (e) => {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        cleanup();
        XCT_LOG.error('submitMessageToRoom: iframe error', e);
        reject(new Error('Chyba při odesílání zprávy.'));
      });

      try {
        form.submit();
      } catch (err) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        cleanup();
        reject(err as Error);
      }
    });
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

  private static readonly TIME_RE = /\b(\d{1,2}:\d{2}:\d{2})\b/g;

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

    // `<font color="...">` obaluje umsg span – vytáhneme barvu.
    const fontEl = umsg.closest('font[color]');
    const color = fontEl ? fontEl.getAttribute('color') : null;

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
    };
  }

  private static parseSystemText(
    sys: HTMLElement,
    time: string,
    idx: number,
  ): RoomMessage {
    return {
      id: `sys-${idx}-${time}`,
      kind: 'system',
      outgoing: false,
      time,
      nick: null,
      html: sys.innerHTML.trim(),
      text: (sys.textContent ?? '').trim(),
    };
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

  /** URL obrázku emoji podle čísla (0-9 = /0/, jinak podle prvních dvou cifer). */
  static url(num: number): string {
    const s = String(num);
    const folder = s.length <= 2 ? s[0] : s.substring(0, 2);
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
}

export default XChatApi;
