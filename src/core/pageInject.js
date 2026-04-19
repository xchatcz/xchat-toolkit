/**
 * Pomůcky pro práci s DOM stránky (MAIN world) z izolovaného content scriptu.
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

/**
 * Vloží `<script src>` odkazující na web-accessible resource rozšíření.
 * Script se spouští synchronně, pokud je zavoláno při `document_start`.
 * @param {string} resourcePath cesta vzhledem ke kořeni rozšíření
 *                               (např. `"src/page/room-messages.js"`)
 */
export function injectPageScript(resourcePath) {
  const url = chrome.runtime.getURL(resourcePath);
  const s = document.createElement('script');
  s.src = url;
  s.async = false;
  s.dataset.xchatToolkit = '1';
  (document.head || document.documentElement).appendChild(s);
  // Po načtení již není potřeba ve stromu.
  s.addEventListener('load', () => s.remove(), { once: true });
}

/**
 * Spustí kód v kontextu stránky (MAIN world). Předaná funkce je převedena
 * na string a inline vložena. Vhodné pro krátké volání globálů (např.
 * `count_length()`).
 * @param {() => void} fn
 */
export function runInPage(fn) {
  const s = document.createElement('script');
  s.textContent = `(${fn.toString()})();`;
  (document.head || document.documentElement).appendChild(s);
  s.remove();
}
