/**
 * Most pro cross-origin `fetch` volání.
 *
 * Proč: V Manifest V3 podléhají fetch požadavky jak v content scriptech,
 * tak ve stránkovém (MAIN world) kontextu pravidlům CORS stránky. I když
 * má rozšíření `host_permissions` pro scripts.xchat.cz a ximg.cz, požadavek
 * z `https://www.xchat.cz` je bez `Access-Control-Allow-Origin` hlavičky
 * zablokován. Jediná spolehlivá cesta je proxy přes service worker, který
 * host permissions skutečně uplatňuje.
 *
 * Tento soubor:
 *  - spouští se z izolovaného contextu rozšíření (content script);
 *  - instaluje `window.addEventListener('message', ...)` posluchač, který
 *    přijímá požadavky z MAIN world (viz `setupMainWorldFetchProxy` v
 *    `src/page/room-messages.js`) a přeposílá je do service workeru;
 *  - exportuje `proxyFetch()` pro použití přímo v obsahových skriptech
 *    (viz `favouriteUsersLegacy.js`).
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

const MSG_TYPE = 'xchat-toolkit-fetch';

/**
 * Odešle fetch do service workeru a vrátí strukturu kompatibilní s `Response`
 * (jen ta pole, která skutečně používáme: `ok`, `status`, `statusText`,
 * `url`, `text()`, `blob()`, `arrayBuffer()`).
 *
 * Pracuje v kontextu content scriptu i MAIN worldu.
 */
export async function proxyFetch(url, init = {}) {
  const payload = {
    type: MSG_TYPE,
    url: String(url),
    init: serializeInit(init),
  };
  const resp = await chrome.runtime.sendMessage(payload);
  if (!resp || !resp.success) {
    throw new Error(resp?.error || 'proxy fetch failed');
  }
  return buildResponseLike(resp);
}

/** Instaluje posluchač pro MAIN world (volá se jen z content scriptu). */
export function installPageFetchBridge() {
  window.addEventListener('message', async (evt) => {
    if (evt.source !== window) return;
    const data = evt.data;
    if (!data || data.xchatToolkit !== 'fetch-request') return;
    const id = data.id;
    try {
      const resp = await chrome.runtime.sendMessage({
        type: MSG_TYPE,
        url: data.url,
        init: data.init,
      });
      if (!resp || !resp.success) {
        window.postMessage(
          {
            xchatToolkit: 'fetch-response',
            id,
            success: false,
            error: resp?.error || 'proxy fetch failed',
          },
          '*',
        );
        return;
      }
      window.postMessage(
        {
          xchatToolkit: 'fetch-response',
          id,
          success: true,
          status: resp.status,
          statusText: resp.statusText,
          ok: resp.ok,
          url: resp.url,
          bytes: resp.bytes,
          contentType: resp.contentType,
        },
        '*',
      );
    } catch (err) {
      window.postMessage(
        {
          xchatToolkit: 'fetch-response',
          id,
          success: false,
          error: String(err?.message || err),
        },
        '*',
      );
    }
  });
}

function serializeInit(init) {
  if (!init || typeof init !== 'object') return {};
  const out = {};
  if (init.method) out.method = init.method;
  if (init.credentials) out.credentials = init.credentials;
  if (init.cache) out.cache = init.cache;
  if (init.redirect) out.redirect = init.redirect;
  if (init.referrer) out.referrer = init.referrer;
  if (init.headers) {
    const headers = {};
    if (init.headers instanceof Headers) {
      for (const [k, v] of init.headers.entries()) headers[k] = v;
    } else if (Array.isArray(init.headers)) {
      for (const [k, v] of init.headers) headers[k] = v;
    } else {
      Object.assign(headers, init.headers);
    }
    out.headers = headers;
  }
  if (typeof init.body === 'string') out.body = init.body;
  return out;
}

function buildResponseLike(resp) {
  const bytes = resp.bytes instanceof Uint8Array
    ? resp.bytes
    : new Uint8Array(resp.bytes || []);
  const headers = new Headers();
  if (resp.contentType) headers.set('content-type', resp.contentType);
  const response = new Response(bytes, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  });
  try {
    Object.defineProperty(response, 'url', { value: resp.url || '' });
  } catch {
    // Response.url je read-only; pokud nelze přepsat, ponecháme výchozí.
  }
  return response;
}
