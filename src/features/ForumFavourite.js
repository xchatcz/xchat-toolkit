/**
 * Fórum – oblíbená vlákna: přepíná filtr „pouze nová" × „vše".
 * Původní userscript: `xchat-forum-favourite.user.js`.
 */

import { Feature } from '../core/Feature.js';

const LABEL_NEW = 'Pouze nové';
const LABEL_ALL = 'Zobrazit vše';

export class ForumFavourite extends Feature {
  static id = 'forum-favourite';
  static name = 'Fórum – oblíbená';
  static description = 'Tlačítko pro filtr pouze nových témat v oblíbených na fóru.';
  static matches = [/\/forum\/favourite\.php/];
  static runAt = 'end';
  static defaultOptions = { showOnlyNewByDefault: true };

  /**
   * @param {{ options: { showOnlyNewByDefault: boolean } }} ctx
   */
  run({ options }) {
    const anchor = document.querySelector('.dln');
    if (!anchor) return;

    const btn = document.createElement('input');
    btn.type = 'button';
    btn.className = 'srs f';
    btn.style.marginBottom = '10px';

    let filterOn = options.showOnlyNewByDefault !== false;

    const applyFilter = () => {
      btn.value = filterOn ? LABEL_ALL : LABEL_NEW;
      const rows = document.querySelectorAll('table.fav tbody tr');
      rows.forEach((row) => {
        const cell = row.querySelectorAll('td')[1];
        if (!cell) return;
        const match = cell.innerHTML.match(/\((\d+)\s*\/\s*\d+/);
        if (!match) return;
        const newPosts = parseInt(match[1], 10);
        row.style.display = filterOn && newPosts === 0 ? 'none' : '';
      });
    };

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      filterOn = !filterOn;
      applyFilter();
    });

    anchor.before(btn);
    applyFilter();
  }
}
