/**
 * Most pro cross-origin fetch volání. Obchází CORS přes service worker,
 * který má host_permissions pro xchat.cz a ximg.cz domény.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

export const FETCH_MSG_TYPE = 'xchat-toolkit-fetch';

export interface SerializedInit {
  method?: string;
  credentials?: RequestCredentials;
  cache?: RequestCache;
  redirect?: RequestRedirect;
  referrer?: string;
  headers?: Record<string, string>;
  body?: string;
}

export interface FetchProxySuccess {
  success: true;
  ok: boolean;
  status: number;
  statusText: string;
  url: string;
  contentType: string;
  /** Tělo odpovědi zakódované jako base64 (JSON-safe přes runtime.sendMessage). */
  bodyBase64: string;
}

export interface FetchProxyError {
  success: false;
  error: string;
}

export type FetchProxyResponse = FetchProxySuccess | FetchProxyError;

/** Serializace `RequestInit` na struct předávaný do service workeru. */
const serializeInit = (init: RequestInit = {}): SerializedInit => {
  const out: SerializedInit = {};
  if (init.method) out.method = init.method;
  if (init.credentials) out.credentials = init.credentials;
  if (init.cache) out.cache = init.cache;
  if (init.redirect) out.redirect = init.redirect;
  if (typeof init.referrer === 'string') out.referrer = init.referrer;
  if (init.headers) {
    const headers: Record<string, string> = {};
    if (init.headers instanceof Headers) {
      init.headers.forEach((v, k) => {
        headers[k] = v;
      });
    } else if (Array.isArray(init.headers)) {
      for (const [k, v] of init.headers) headers[k] = v;
    } else {
      Object.assign(headers, init.headers);
    }
    out.headers = headers;
  }
  if (typeof init.body === 'string') out.body = init.body;
  return out;
};

/** Dekóduje base64 string na `Uint8Array`. */
const base64ToBytes = (b64: string): Uint8Array => {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
};

/** Rekonstrukce Response z odpovědi service workeru. */
const buildResponse = (resp: FetchProxySuccess): Response => {
  const headers = new Headers();
  if (resp.contentType) headers.set('content-type', resp.contentType);
  const bytes = base64ToBytes(resp.bodyBase64);
  const response = new Response(bytes.buffer as ArrayBuffer, {
    status: resp.status,
    statusText: resp.statusText,
    headers,
  });
  try {
    Object.defineProperty(response, 'url', { value: resp.url || '' });
  } catch {
    /* url je read-only; ignorujeme. */
  }
  return response;
};

/** Timeout pro SW proxy fallback – po této době ho vzdáme a hodíme chybu. */
const SW_PROXY_TIMEOUT_MS = 15_000;

/**
 * Přes service worker provede fetch, když přímý fetch selže. V MV3
 * má content script (i extension page) povolen cross-origin fetch přes
 * `host_permissions`, takže přímý fetch je preferovaný a stabilnější
 * (SW se v dev módu s Vite HMR uspí a `sendMessage` pak umí viset
 * bez rejection).
 */
const swProxyFetch = async (url: string | URL, init: RequestInit): Promise<Response> => {
  const request = chrome.runtime.sendMessage({
    type: FETCH_MSG_TYPE,
    url: String(url),
    init: serializeInit(init),
  }) as Promise<FetchProxyResponse | undefined>;

  const timeout = new Promise<never>((_, reject) => {
    window.setTimeout(
      () => reject(new Error(`SW proxy fetch timeout (${SW_PROXY_TIMEOUT_MS} ms)`)),
      SW_PROXY_TIMEOUT_MS,
    );
  });

  const resp = await Promise.race([request, timeout]);
  if (!resp || !resp.success) {
    throw new Error(resp?.error ?? 'proxy fetch failed');
  }
  return buildResponse(resp);
};

/**
 * Provede fetch na libovolný xchat.cz/ximg.cz zdroj. Preferuje přímý
 * `fetch()` – v content scriptu / extension page nám ho `host_permissions`
 * v manifestu povolují i cross-origin. Když by přímý fetch selhal (např.
 * kvůli restrikcím CORS), padneme zpátky na service-worker proxy.
 */
export const proxyFetch = async (url: string | URL, init: RequestInit = {}): Promise<Response> => {
  try {
    return await fetch(url, { credentials: 'include', cache: 'no-cache', ...init });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[XChat Toolkit] přímý fetch selhal, zkusím SW proxy:', String(url), err);
    return swProxyFetch(url, init);
  }
};
