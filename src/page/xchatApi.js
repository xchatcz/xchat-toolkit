/**
 * MAIN-world XChat API služba.
 *
 * Paralelní verze `src/services/xchatApi.js` pro skripty běžící přímo ve
 * stránce (např. `room-messages.js`). Protože v MAIN world nelze importovat
 * ES moduly rozšíření, vystavuje API na globálním objektu
 * `window.__xchatApi`.
 *
 * Centralizuje:
 *  - znalost URL endpointů (scripts.xchat.cz, whoiswho, roomtopng, …),
 *  - dekódování odpovědí v ISO-8859-2,
 *  - přidání cache-bust parametrů,
 *  - parsování odpovědí specifických pro XChat (wonline, frameset, avatar).
 *
 * Síťovou vrstvu řeší `window.fetch` – na cross-origin hosty je přesměrován
 * do service workeru skriptem `xchatFetchProxy.js`, který musí běžet dříve.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

(function () {
  'use strict';

  if (window.__xchatApi) return;

  var SCRIPTS_BASE = 'https://scripts.xchat.cz/scripts';
  var WHOISWHO_URL = 'https://www.xchat.cz/whoiswho/perphoto.php';

  var ISO_DECODER = new TextDecoder('iso-8859-2');

  // ── Helpery ───────────────────────────────────────────────────────────────

  function decodeIso88592(response) {
    return response.arrayBuffer().then(function (buf) {
      return ISO_DECODER.decode(buf);
    });
  }

  function addCacheBust(url, paramName) {
    var name = paramName || 'fake';
    var stamp = Math.floor(Date.now() / 1000);
    var re = new RegExp('([&?]' + name + '=)\\d+');
    if (re.test(url)) {
      return url.replace(re, '$1' + stamp);
    }
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + name + '=' + stamp;
  }

  function buildBoardPollUrl(baseUrl, lastLine) {
    var url = new URL(String(baseUrl));
    url.searchParams.set('last_line', String(lastLine));
    url.searchParams.set('fake', String(Math.floor(Date.now() / 1000)));
    return url.toString();
  }

  var STANDARD_BOARD_HEADERS = {
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    'Cache-Control': 'no-cache',
    'Pragma': 'no-cache'
  };

  // ── Parsery odpovědí ──────────────────────────────────────────────────────

  function parseWonlineText(text) {
    if (!text) return { online: false, rooms: [] };
    var trimmed = String(text).trim();
    if (!trimmed) return { online: false, rooms: [] };
    var lines = trimmed.split('\n');
    var count = parseInt(lines[0], 10);
    if (!count || count <= 0) return { online: false, rooms: [] };
    var rooms = [];
    for (var i = 1; i < lines.length; i++) {
      var line = lines[i].trim();
      if (!line) continue;
      var parts = line.match(/^(\d+)\s+(\S+)\s+(\S+)\s+(.+)$/);
      if (parts) {
        rooms.push({
          rid: parts[1],
          idle: parts[2],
          link: parts[3],
          name: parts[4].trim()
        });
      }
    }
    return { online: rooms.length > 0, rooms: rooms };
  }

  function detectDefaultAvatarFromUrl(url) {
    if (/pict_muz\.gif/i.test(url)) return 'male';
    if (/pict_zena\.gif/i.test(url)) return 'female';
    if (/unisex\.png/i.test(url)) return 'unisex';
    return null;
  }

  function parseWhisperFrameUrls(html) {
    var roomtopUrl = '';
    var textpageUrl = '';
    var userpageUrl = '';
    if (!html) return { roomtopUrl: '', textpageUrl: '', userpageUrl: '' };
    var frameRe = /<frame\b[^>]*>/gi;
    var frameMatch;
    while ((frameMatch = frameRe.exec(html)) !== null) {
      var tag = frameMatch[0];
      var srcM = tag.match(/\bsrc="([^"]*)"/i);
      var nameM = tag.match(/\bname="([^"]*)"/i);
      var src = srcM ? srcM[1] : '';
      var name = nameM ? nameM[1] : '';
      if (name === 'roomframe' || /op=room(top|frame)ng/i.test(src)) roomtopUrl = src;
      else if (name === 'textpage' || /op=textpageng/i.test(src)) textpageUrl = src;
      else if (name === 'userpage' || /op=whisperuserpage/i.test(src)) userpageUrl = src;
    }

    if (roomtopUrl) {
      roomtopUrl = roomtopUrl.replace(/op=roomframeng/i, 'op=roomtopng');
    }

    var base = location.protocol + '//www.xchat.cz/';
    if (roomtopUrl && !/^https?:/.test(roomtopUrl)) roomtopUrl = base + roomtopUrl.replace(/^\//, '');
    if (textpageUrl && !/^https?:/.test(textpageUrl)) textpageUrl = base + textpageUrl.replace(/^\//, '');
    if (userpageUrl && !/^https?:/.test(userpageUrl)) userpageUrl = base + userpageUrl.replace(/^\//, '');

    if (roomtopUrl) {
      if (/[&?]js=\d+/.test(roomtopUrl)) {
        roomtopUrl = roomtopUrl.replace(/([&?]js=)\d+/, '$10');
      } else {
        roomtopUrl += (roomtopUrl.indexOf('?') >= 0 ? '&' : '?') + 'js=0';
      }
    }

    return { roomtopUrl: roomtopUrl, textpageUrl: textpageUrl, userpageUrl: userpageUrl };
  }

  // ── URL buildery ──────────────────────────────────────────────────────────

  var urls = {
    userInfo: function (nick) {
      return SCRIPTS_BASE + '/user.php?nick=' + encodeURIComponent(nick);
    },
    wonline: function (nick) {
      return SCRIPTS_BASE + '/wonline.php?nick=' + encodeURIComponent(nick);
    },
    avatar: function (nick, sex) {
      var s = (sex === 0 || sex === 1) ? sex : -1;
      return WHOISWHO_URL + '?nick=' + encodeURIComponent(nick) + '&sex=' + s;
    },
    boardPoll: buildBoardPollUrl,
    cacheBust: addCacheBust
  };

  // ── HTTP metody ───────────────────────────────────────────────────────────

  /** Stáhne HTML odpověď v ISO-8859-2 a vrátí ji jako řetězec. */
  function fetchHtmlIso(url, init) {
    return fetch(url, init || { credentials: 'include' }).then(function (r) {
      if (!r) return '';
      return decodeIso88592(r);
    });
  }

  /** Stáhne HTML board odpověď (roomtopng / textpageng) s cache-bust hlavičkami. */
  function fetchBoardHtml(url) {
    return fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: STANDARD_BOARD_HEADERS
    }).then(function (r) { return r.arrayBuffer(); })
      .then(function (buf) { return ISO_DECODER.decode(buf); });
  }

  /** Stáhne online stav uživatele a vrátí parsovanou strukturu. */
  function fetchWonline(nick) {
    return fetch(urls.wonline(nick))
      .then(function (r) { return r && r.ok ? r.text() : ''; })
      .then(parseWonlineText)
      .catch(function () { return { online: false, rooms: [] }; });
  }

  /** Stáhne avatar a vrátí `{ blobUrl, defaultType, directUrl, finalUrl }`. */
  function fetchAvatar(nick, sex) {
    var avatarUrl = urls.avatar(nick, sex);
    return fetch(avatarUrl, { credentials: 'include' }).then(function (resp) {
      var finalUrl = resp ? (resp.url || '') : '';
      var defaultType = detectDefaultAvatarFromUrl(finalUrl);
      if (!resp || !resp.ok) {
        return { blobUrl: null, defaultType: defaultType, directUrl: avatarUrl, finalUrl: finalUrl };
      }
      return resp.blob().then(function (blob) {
        return {
          blobUrl: URL.createObjectURL(blob),
          defaultType: defaultType,
          directUrl: avatarUrl,
          finalUrl: finalUrl
        };
      });
    });
  }

  /** Stáhne frameset whisper okna a vrátí parsované URL jednotlivých rámů. */
  function fetchWhisperFrameUrls(framesetUrl) {
    return fetch(framesetUrl, { credentials: 'include' })
      .then(function (r) { return r && typeof r.text === 'function' ? r.text() : ''; })
      .then(function (html) { return parseWhisperFrameUrls(html || ''); });
  }

  // ── Export ────────────────────────────────────────────────────────────────

  window.__xchatApi = {
    urls: urls,
    parse: {
      wonlineText: parseWonlineText,
      whisperFrameUrls: parseWhisperFrameUrls,
      avatarDefaultType: detectDefaultAvatarFromUrl
    },
    decodeIso88592: decodeIso88592,
    fetchHtmlIso: fetchHtmlIso,
    fetchBoardHtml: fetchBoardHtml,
    fetchWonline: fetchWonline,
    fetchAvatar: fetchAvatar,
    fetchWhisperFrameUrls: fetchWhisperFrameUrls
  };
})();
