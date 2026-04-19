/**
 * Service worker rozšíření. V MV3 musí existovat jako ES modul.
 *  - otevírá „Možnosti nastavení" při instalaci a kliknutí na ikonu;
 *  - slouží jako proxy pro cross-origin `fetch` volání (viz
 *    `src/content/fetchBridge.js`). Díky `host_permissions` v manifestu
 *    je service worker schopen stáhnout i zdroje, které by z kontextu
 *    stránky nebo content scriptu spadly na CORS.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

const FETCH_MSG_TYPE = 'xchat-toolkit-fetch';
const MAX_BYTES = 8 * 1024 * 1024; // 8 MiB – bezpečný strop pro postMessage.

chrome.action.onClicked?.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== FETCH_MSG_TYPE) return false;
  handleFetchProxy(message)
    .then(sendResponse)
    .catch((err) => sendResponse({ success: false, error: String(err?.message || err) }));
  // Asynchronní odpověď – musí být true, jinak Chrome port zavře.
  return true;
});

async function handleFetchProxy({ url, init }) {
  try {
    const resp = await fetch(url, normalizeInit(init));
    const buf = await resp.arrayBuffer();
    const bytes = buf.byteLength > MAX_BYTES
      ? new Uint8Array(buf, 0, MAX_BYTES)
      : new Uint8Array(buf);
    return {
      success: true,
      ok: resp.ok,
      status: resp.status,
      statusText: resp.statusText,
      url: resp.url,
      contentType: resp.headers.get('content-type') || '',
      bytes,
    };
  } catch (err) {
    return { success: false, error: String(err?.message || err) };
  }
}

function normalizeInit(init) {
  if (!init || typeof init !== 'object') return { credentials: 'include' };
  const out = {
    method: init.method || 'GET',
    credentials: init.credentials || 'include',
  };
  if (init.cache) out.cache = init.cache;
  if (init.redirect) out.redirect = init.redirect;
  if (init.headers) out.headers = init.headers;
  if (typeof init.body === 'string') out.body = init.body;
  return out;
}
