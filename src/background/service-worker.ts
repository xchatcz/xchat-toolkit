/**
 * Service worker rozšíření. V MV3 musí být ES modul.
 *  - otevírá Options stránku při instalaci a při kliknutí na ikonu;
 *  - slouží jako proxy pro cross-origin fetch (host_permissions obcházejí CORS).
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { FETCH_MSG_TYPE, type SerializedInit } from '../content/fetchBridge';

const MAX_BYTES = 8 * 1024 * 1024; // 8 MiB strop pro postMessage/runtime.

/** Zakóduje `Uint8Array` do base64 stringu (bez rekurzivního řetězení). */
const bytesToBase64 = (bytes: Uint8Array): string => {
  // 32 KiB bloky kvůli limitu argumentů funkce String.fromCharCode.
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const sub = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    binary += String.fromCharCode(...sub);
  }
  return btoa(binary);
};

chrome.action.onClicked?.addListener(() => {
  chrome.runtime.openOptionsPage();
});

chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.runtime.openOptionsPage();
  }
});

interface FetchMessage {
  type: string;
  url: string;
  init?: SerializedInit;
}

chrome.runtime.onMessage.addListener((message: FetchMessage, _sender, sendResponse) => {
  if (!message) return false;
  if (message.type === 'XCT_OPEN_OPTIONS') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return false;
  }
  if (message.type !== FETCH_MSG_TYPE) return false;
  handleFetchProxy(message)
    .then(sendResponse)
    .catch((err: unknown) =>
      sendResponse({ success: false, error: String((err as Error)?.message ?? err) }),
    );
  return true; // asynchronní odpověď
});

const normalizeInit = (init?: SerializedInit): RequestInit => {
  if (!init) return { credentials: 'include' };
  const out: RequestInit = {
    method: init.method ?? 'GET',
    credentials: init.credentials ?? 'include',
  };
  if (init.cache) out.cache = init.cache;
  if (init.redirect) out.redirect = init.redirect;
  if (init.headers) out.headers = init.headers;
  if (typeof init.body === 'string') out.body = init.body;
  return out;
};

const handleFetchProxy = async ({ url, init }: FetchMessage) => {
  try {
    const resp = await fetch(url, normalizeInit(init));
    const buf = await resp.arrayBuffer();
    const bytes =
      buf.byteLength > MAX_BYTES
        ? new Uint8Array(buf, 0, MAX_BYTES)
        : new Uint8Array(buf);
    return {
      success: true as const,
      ok: resp.ok,
      status: resp.status,
      statusText: resp.statusText,
      url: resp.url,
      contentType: resp.headers.get('content-type') ?? '',
      bodyBase64: bytesToBase64(bytes),
    };
  } catch (err) {
    return {
      success: false as const,
      error: String((err as Error)?.message ?? err),
    };
  }
};
