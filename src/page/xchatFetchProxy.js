/**
 * MAIN-world fetch proxy.
 *
 * V Manifestu V3 podléhají `fetch()` volání ze stránkového kontextu CORS
 * pravidlům stránky. `www.xchat.cz` nevrací `Access-Control-Allow-Origin`,
 * takže přímé fetche na `scripts.xchat.cz`, `x.ximg.cz` nebo `ximg.cz`
 * padají na CORS. `host_permissions` tuto politiku mimo service worker
 * neobchází.
 *
 * Tento skript přepisuje `window.fetch`: cross-origin požadavky na známé
 * XChat hosty jsou přesměrovány přes `postMessage` bridge do content
 * scriptu (viz `src/content/fetchBridge.js`) a odtud přes
 * `chrome.runtime.sendMessage` do service workeru, který je má v
 * `host_permissions` a CORS tím obchází.
 *
 * Spouští se přes `<script src>` ještě před `xchatApi.js` a
 * `room-messages.js`, aby byl `window.fetch` při jejich startu už upravený.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

(function () {
  'use strict';

  if (window.__xchatFetchProxyInstalled) return;
  window.__xchatFetchProxyInstalled = true;

  var PROXY_HOST_RE = /^(?:scripts\.xchat\.cz|x\.ximg\.cz|ximg\.cz|www\.ximg\.cz)$/i;
  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  if (!origFetch) return;

  var fetchId = 0;

  function serializeInit(init) {
    if (!init || typeof init !== 'object') return {};
    var out = {};
    if (init.method) out.method = init.method;
    if (init.credentials) out.credentials = init.credentials;
    if (init.cache) out.cache = init.cache;
    if (init.redirect) out.redirect = init.redirect;
    if (init.headers) {
      var h = {};
      if (typeof Headers !== 'undefined' && init.headers instanceof Headers) {
        init.headers.forEach(function (v, k) { h[k] = v; });
      } else if (Array.isArray(init.headers)) {
        for (var i = 0; i < init.headers.length; i++) h[init.headers[i][0]] = init.headers[i][1];
      } else {
        for (var k in init.headers) {
          if (Object.prototype.hasOwnProperty.call(init.headers, k)) h[k] = init.headers[k];
        }
      }
      out.headers = h;
    }
    if (typeof init.body === 'string') out.body = init.body;
    return out;
  }

  function needsProxy(urlStr) {
    try {
      var u = new URL(urlStr, location.href);
      if (u.origin === location.origin) return false;
      return PROXY_HOST_RE.test(u.hostname);
    } catch (e) { return false; }
  }

  function proxyFetch(url, init) {
    var id = ++fetchId;
    var initSerial = serializeInit(init);
    return new Promise(function (resolve, reject) {
      function onMessage(evt) {
        if (evt.source !== window) return;
        var d = evt.data;
        if (!d || d.xchatToolkit !== 'fetch-response' || d.id !== id) return;
        window.removeEventListener('message', onMessage);
        if (!d.success) {
          reject(new Error(d.error || 'xchat-toolkit proxy fetch failed'));
          return;
        }
        var headers = new Headers();
        if (d.contentType) headers.set('content-type', d.contentType);
        var bytes = d.bytes instanceof Uint8Array
          ? d.bytes
          : new Uint8Array(d.bytes || []);
        var resp = new Response(bytes, {
          status: d.status,
          statusText: d.statusText || '',
          headers: headers
        });
        try { Object.defineProperty(resp, 'url', { value: d.url || String(url) }); } catch (e) {}
        resolve(resp);
      }
      window.addEventListener('message', onMessage);
      window.postMessage({
        xchatToolkit: 'fetch-request',
        id: id,
        url: String(url),
        init: initSerial
      }, '*');
    });
  }

  window.fetch = function (input, init) {
    var url = typeof input === 'string'
      ? input
      : (input && typeof input.url === 'string' ? input.url : '');
    if (url && needsProxy(url)) return proxyFetch(url, init);
    return origFetch(input, init);
  };
})();
