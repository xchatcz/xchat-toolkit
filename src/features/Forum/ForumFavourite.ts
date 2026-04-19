/**
 * Fórum – oblíbená: tlačítko pro filtr „pouze nové × vše".
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { Feature, type FeatureContext } from '../../core/Feature';

interface Options {
  showOnlyNewByDefault: boolean;
}

const LABEL_NEW = 'Pouze nové';
const LABEL_ALL = 'Zobrazit vše';

export class ForumFavourite extends Feature<Options> {
  readonly id = 'forum-favourite';
  readonly name = 'Fórum – oblíbená';
  readonly description = 'Tlačítko pro filtr pouze nových témat v oblíbených na fóru.';
  readonly category = 'forum' as const;
  readonly matches = [/\/forum\/favourite\.php/];
  override readonly runAt = 'end';
  override readonly defaultOptions: Options = { showOnlyNewByDefault: true };

  run({ options }: FeatureContext<Options>): void {
    const anchor = document.querySelector('.dln');
    if (!anchor) return;

    const btn = document.createElement('input');
    btn.type = 'button';
    btn.className = 'srs f';
    btn.style.marginBottom = '10px';

    let filterOn = options.showOnlyNewByDefault !== false;

    const applyFilter = (): void => {
      btn.value = filterOn ? LABEL_ALL : LABEL_NEW;
      document.querySelectorAll<HTMLTableRowElement>('table.fav tbody tr').forEach((row) => {
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
