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
  RoomContext,
  RoomDetail,
  RoomListItem,
  RoomMessage,
  RoomMessageKind,
  Sex,
  SkinId,
  Star,
  UserDetail,
  WhereOnline,
} from './types';

// ─── HTTP vrstva ────────────────────────────────────────────────────────────

/** Primitivní HTTP klient nad {@link proxyFetch} se správným dekódováním. */
export class XChatHttp {
  private static readonly ISO_DECODER = new TextDecoder('iso-8859-2');
  private static readonly UTF_DECODER = new TextDecoder('utf-8');

  /** Provede GET a vrátí odpověď (Response-like přes fetch bridge). */
  static fetch(url: string | URL, init: RequestInit = {}): Promise<Response> {
    return proxyFetch(url, { credentials: 'include', cache: 'no-cache', ...init });
  }

  /** Stáhne obsah ve známém ISO-8859-2 kódování (všechny XChat stránky). */
  static async fetchIsoText(url: string | URL, init: RequestInit = {}): Promise<string> {
    const res = await this.fetch(url, init);
    if (!res.ok) throw new Error(`HTTP ${res.status} při načítání ${String(url)}`);
    const buf = await res.arrayBuffer();
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

  /** `{origin}/~{xhash}` prefix. */
  static hashPrefix(xhash: string): string {
    return `${location.origin}/~${xhash}`;
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
  static roomUsersPage(xhash: string, rid: number, cid: number, skin: SkinId): string {
    return this.modchatOp(xhash, { op: 'userspage', rid, cid, skin, js: 1 });
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
    const star = Math.max(0, Math.min(5, Number(lines[5]) || 0)) as Star;
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
      xhash: varStr('my_auth') ?? fallbackXhash,
      myNick: varStr('my_nick') ?? '',
      roomName: (varStr('roomname') ?? '').trim(),
      sex: (varNum('sex') === 1 ? 1 : 0) as Sex,
      skin: skinClamped as SkinId,
    };
  }
}

// ─── Zprávy v místnosti ─────────────────────────────────────────────────────

export class XChatMessages {
  /**
   * Parser stránky `op=roomtopng` (HTML s jednotlivými zprávami).
   * Rozlišuje tři typy: běžná zpráva, šept (whisper), systémová zpráva
   * (vstoupil/odešel/vyhozen …).
   */
  static parseMessagesPage(doc: Document): RoomMessage[] {
    const messages: RoomMessage[] = [];
    // XChat renderuje jednotlivé zprávy jako elementy s atributem `data-t`
    // (id zprávy – timestamp-counter) nebo jako <p class="r*"> /  <p class="w*">.
    // Fallbackově projdeme všechny <p> v těle, abychom byli robustní.
    const candidates = doc.querySelectorAll('p[id], p.r, p.r0, p.r1, p.w, p.s, p.rr, p.ww');
    const pool = candidates.length > 0 ? candidates : doc.querySelectorAll('p');
    pool.forEach((p, idx) => {
      const html = (p as HTMLElement).innerHTML.trim();
      if (!html) return;
      const text = (p.textContent ?? '').trim();
      messages.push({
        id: (p as HTMLElement).id || `idx-${idx}`,
        kind: this.detectKind(p as HTMLElement),
        time: this.extractTime(text),
        nick: this.extractNick(p as HTMLElement),
        html,
        text,
      });
    });
    return messages;
  }

  /** Detekce typu zprávy podle CSS třídy / obsahu. */
  private static detectKind(el: HTMLElement): RoomMessageKind {
    const cls = el.className || '';
    if (/\bw\b|\bww\b|whisper/i.test(cls)) return 'whisper';
    if (/\bs\b|system/i.test(cls)) return 'system';
    const text = el.textContent || '';
    if (/vstoupil|odešel|byl vyhozen|připojil|opustil/i.test(text)) return 'system';
    if (/\(šepot\)|šeptá/i.test(text)) return 'whisper';
    return 'message';
  }

  /** První `HH:MM` v textu zprávy (XChat ho renderuje na začátku). */
  private static extractTime(text: string): string {
    const m = text.match(/\b(\d{1,2}:\d{2}(?::\d{2})?)\b/);
    return m ? m[1] : '';
  }

  /** Pokus najít nick (první <a> nebo <strong>). */
  private static extractNick(el: HTMLElement): string | null {
    const a = el.querySelector('a[href*="nick="]');
    if (a) {
      const m = (a.getAttribute('href') ?? '').match(/[?&]nick=([^&]+)/);
      if (m) return decodeURIComponent(m[1]);
    }
    const strong = el.querySelector('strong');
    return strong ? (strong.textContent ?? '').trim() : null;
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
        star: Math.max(0, Math.min(5, Number(parts[2]) || 0)) as Star,
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
  static readonly Admins = XChatAdmins;
  static readonly Emoji = XChatEmoji;

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
    const html = await XChatHttp.fetchIsoText(XChatUrls.roomEntry(xhash, slug));
    const base = XChatRooms.parseRoomContext(html, xhash);
    if (!base) {
      console.warn(
        '[XChat Toolkit] roomEntry HTML neobsahuje rid – prvních 2000 znaků:\n',
        html.slice(0, 2000),
      );
      return null;
    }

    // Pokud nemáme jméno/auth, dotáhneme je z text-page (obsahuje var my_nick,
    // var my_auth atd.). Kotva je rid/skin, které už máme z framesetu.
    if (!base.myNick || !base.roomName) {
      try {
        const txt = await XChatHttp.fetchIsoText(
          XChatUrls.roomTextPage(xhash, base.rid, base.skin),
        );
        const enrich = XChatRooms.parseRoomContext(txt, xhash);
        if (enrich) {
          return {
            ...base,
            myNick: enrich.myNick || base.myNick,
            roomName: enrich.roomName || base.roomName,
            uid: enrich.uid || base.uid,
            sex: enrich.sex ?? base.sex,
            xhash: enrich.xhash || base.xhash,
            cid: enrich.cid || base.cid,
          };
        }
      } catch (err) {
        console.warn('[XChat Toolkit] enrich room context selhal:', err);
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
    const doc = await XChatHttp.fetchDocument(XChatUrls.roomMessages(xhash, rid, skin));
    return XChatMessages.parseMessagesPage(doc);
  }
}

export default XChatApi;
