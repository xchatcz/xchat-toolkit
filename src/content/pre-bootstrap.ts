/**
 * Pre-bootstrap – ÚPLNĚ PRVNÍ content script, document_start, non-module.
 *
 * Žádný `import` – CRXJS ho injektuje jako plain inline script a spustí
 * synchronně před parsováním těla stránky.
 *
 * Cíl: nikdy neukázat původní xchat DOM (frameset, iframe, inline skripty).
 *
 * Strategie:
 *  1. `documentElement.style.visibility = 'hidden'` – okamžité skrytí
 *     všeho pod `<html>`. Nastaví se SYNCHRONNĚ přes CSSOM, bez čekání
 *     na parsování `<style>` tagu.
 *  2. `window.stop()` – ukončí stahování a spouštění inline skriptů.
 *  3. Overlay `#xct-pre-boot` se přilepí jako přímé dítě `<html>`.
 *     Inline `visibility: visible` na všech potomcích overlaye ho
 *     odhalí i přes skryté `<html>`.
 *  4. MutationObserver hlídá inline `style` na `<html>`, aby nám ho
 *     parser nesmázl, pokud by dodal víc obsahu.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

(() => {
  const path = location.pathname;
  const search = location.search;
  const isRoomSlug = /^\/~\$[^/]+\/modchat\/room\/[^/?#]+\/?$/.test(path);
  const isMainframeset =
    /^\/~\$[^/]+\/modchat\/?$/.test(path) &&
    /(^|[?&])op=mainframeset(&|$)/.test(search) &&
    /(^|[?&])rid=\d+(&|$)/.test(search);

  if (!isRoomSlug && !isMainframeset) return;

  const HTML = document.documentElement;
  HTML.style.setProperty('visibility', 'hidden', 'important');
  HTML.style.setProperty('background', '#1e1e20', 'important');

  try {
    window.stop();
  } catch {
    /* noop */
  }

  const overlay = document.createElement('div');
  overlay.id = 'xct-pre-boot';
  overlay.style.cssText = [
    'position:fixed',
    'inset:0',
    'z-index:2147483647',
    'display:flex',
    'align-items:center',
    'justify-content:center',
    'visibility:visible',
    'background:#1e1e20',
    'color:rgba(255,255,255,0.72)',
    'font:13px/1.4 "Segoe UI",Tahoma,"Helvetica Neue",Arial,sans-serif',
    'margin:0',
    'padding:0',
  ].join(';');
  overlay.innerHTML = [
    '<div style="display:flex;flex-direction:column;align-items:center;gap:14px;visibility:visible">',
    '  <div id="xct-pre-boot-spinner" style="width:32px;height:32px;border:3px solid rgba(255,255,255,0.18);border-top-color:rgba(255,255,255,0.82);border-radius:50%;visibility:visible"></div>',
    '  <div style="visibility:visible">Načítám místnost…</div>',
    '</div>',
  ].join('');

  // CSS animaci `@keyframes` inline styl neumí – přidáme tenký <style>.
  const kf = document.createElement('style');
  kf.id = 'xct-pre-boot-style';
  kf.textContent =
    '@keyframes xct-pre-boot-spin{to{transform:rotate(360deg)}}' +
    '#xct-pre-boot-spinner{animation:xct-pre-boot-spin 720ms linear infinite}';

  HTML.appendChild(kf);
  HTML.appendChild(overlay);

  const guard = new MutationObserver(() => {
    if (HTML.style.visibility !== 'hidden') {
      HTML.style.setProperty('visibility', 'hidden', 'important');
    }
  });
  guard.observe(HTML, { attributes: true, attributeFilter: ['style'] });
  (window as unknown as { __xctPreBootGuard?: MutationObserver }).__xctPreBootGuard =
    guard;
})();

export {};
