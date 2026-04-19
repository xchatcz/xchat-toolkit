/**
 * XChat API služba (content-script kontext).
 *
 * Centralizuje veškerou komunikaci s XChatem pro moduly běžící v izolovaném
 * prostředí rozšíření (content scripts, popup, options). Všechna znalost
 * endpointů, CORS obcházení (přes service worker), kódování ISO-8859-2
 * a parsování odpovědí je na jednom místě.
 *
 * Pro MAIN-world kontext (injektované skripty ve stránce) existuje
 * paralelní služba v `src/page/xchatApi.js`, která vystavuje stejné
 * metody na `window.__xchatApi`.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { proxyFetch } from '../content/fetchBridge.js';

const SCRIPTS_BASE = 'https://scripts.xchat.cz/scripts';
const WHOISWHO_URL = 'https://www.xchat.cz/whoiswho/perphoto.php';

/** Dekóduje odpověď v ISO-8859-2 na řetězec. */
async function decodeIso88592(response) {
  const buf = await response.arrayBuffer();
  return new TextDecoder('iso-8859-2').decode(buf);
}

/** Parsuje odpověď ze `scripts/user.php` (řádky oddělené \n). */
function parseUserInfoText(text) {
  if (!text) return null;
  const lines = String(text).split(/\r?\n/);
  const certified = String(lines[3] || '').trim() === '1';
  const sex = parseInt(String(lines[4] || '').trim(), 10);
  const star = parseInt(String(lines[5] || '').trim(), 10);
  const lastOnline = String(lines[9] || '').trim();
  return {
    certified,
    sex: Number.isFinite(sex) ? sex : 0,
    star: Number.isFinite(star) ? star : 0,
    lastOnline,
  };
}

/** Parsuje odpověď ze `scripts/wonline.php` (počet + řádky RID IDLE LINK NAME). */
function parseWonlineText(text) {
  if (!text) return { online: false, rooms: [] };
  const trimmed = String(text).trim();
  if (!trimmed) return { online: false, rooms: [] };
  const lines = trimmed.split('\n');
  const count = parseInt(lines[0], 10);
  if (!count || count <= 0) return { online: false, rooms: [] };
  const rooms = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const parts = line.match(/^(\d+)\s+(\S+)\s+(\S+)\s+(.+)$/);
    if (parts) {
      rooms.push({
        rid: parts[1],
        idle: parts[2],
        link: parts[3],
        name: parts[4].trim(),
      });
    }
  }
  return { online: rooms.length > 0, rooms };
}

/** Extrahuje max. číslo stránky z paginace v Notes. */
function extractMaxPage(doc) {
  let max = 1;
  for (const a of doc.querySelectorAll('#mn a[href*="page="]')) {
    const m = (a.getAttribute('href') || '').match(/[?&]page=(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (!Number.isNaN(n) && n > max) max = n;
    }
  }
  return max;
}

export const xchatApi = {
  // ── URL buildery (bez HTTP volání) ────────────────────────────────────────

  buildUserInfoUrl(nick) {
    return `${SCRIPTS_BASE}/user.php?nick=${encodeURIComponent(nick)}`;
  },

  buildWonlineUrl(nick) {
    return `${SCRIPTS_BASE}/wonline.php?nick=${encodeURIComponent(nick)}`;
  },

  buildAvatarUrl(nick, sex) {
    const sexPart = Number.isFinite(sex) ? sex : -1;
    return `${WHOISWHO_URL}?nick=${encodeURIComponent(nick)}&sex=${sexPart}`;
  },

  buildNotesPageUrl(prefix, page) {
    return `${location.origin}/${prefix}/notes/?page=${page}`;
  },

  // ── Semantické fetch metody ───────────────────────────────────────────────

  /**
   * Načte a zparsuje informace o uživateli (scripts/user.php).
   * Vrací `null` při síťové chybě nebo prázdné odpovědi.
   */
  async getUserInfo(nick, { signal } = {}) {
    const key = String(nick || '').trim();
    if (!key) return null;
    try {
      const r = await proxyFetch(this.buildUserInfoUrl(key), { signal });
      if (!r.ok) return null;
      const text = await r.text();
      if (signal?.aborted) return null;
      return parseUserInfoText(text);
    } catch {
      return null;
    }
  },

  /**
   * Načte online stav uživatele (scripts/wonline.php) a vrátí strukturu
   * `{ online: boolean, rooms: [{rid, idle, link, name}] }`.
   */
  async getWonline(nick, { signal } = {}) {
    const key = String(nick || '').trim();
    if (!key) return { online: false, rooms: [] };
    try {
      const r = await proxyFetch(this.buildWonlineUrl(key), { signal });
      if (!r.ok) return { online: false, rooms: [] };
      const text = await r.text();
      return parseWonlineText(text);
    } catch {
      return { online: false, rooms: [] };
    }
  },

  /**
   * Načte jednu stránku Poznámek a vrátí její `Document`.
   * Vrací `{ ok, doc?, error? }` – handluje síťové i HTTP chyby.
   */
  async getNotesPage(prefix, page, { signal } = {}) {
    let res;
    try {
      res = await proxyFetch(this.buildNotesPageUrl(prefix, page), {
        credentials: 'include',
        signal,
      });
    } catch (err) {
      return { ok: false, error: `Network error: ${String(err?.message ?? err)}` };
    }
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const html = await decodeIso88592(res);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return { ok: true, doc };
  },

  /** Vrátí nejvyšší stránku v paginaci Poznámek ze zparsovaného dokumentu. */
  getNotesMaxPage(doc) {
    return extractMaxPage(doc);
  },
};

export default xchatApi;
