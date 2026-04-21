/**
 * SmilesFavourite – feature pro stránku `/~$xhash/settings/smiles.php`.
 *
 * Přidává:
 *   1) Do tabulky smajlíků nový sloupec „Oblíbený" (vpravo od „Popis")
 *      s checkboxem – zaškrtnutí přidá/odškrtnutí odebere smajlíka v
 *      `chrome.storage.sync` (klíč viz `favouriteSmileys.ts`).
 *   2) Do pravého sloupce (`#pravy`) pod modrý box uživatele nový box
 *      „Oblíbení smajlíci" se živým náhledem všech uložených čísel.
 *      Kliknutím na smajlíka v boxu jej z oblíbených odeberu.
 *
 * Limit {@link FAVOURITE_SMILEYS_MAX}; při dosažení se vypíše hláška
 * nad tabulkou. Checkbox se při dosažení limitu u nezaškrtnutých řádků
 * vizuálně nezakáže, ale pokus o přidání skončí hláškou.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { Feature, type FeatureContext } from '../../core/Feature';
import { FAVOURITE_SMILEYS_MAX } from '../../core/superAdmins';
import {
  addFavouriteSmiley,
  loadFavouriteSmileys,
  onFavouriteSmileysChanged,
  removeFavouriteSmiley,
  type FavouriteSmileys,
} from '../../core/favouriteSmileys';
import { XChatEmoji } from '../../api/XChatApi';

interface RowRef {
  num: number;
  checkbox: HTMLInputElement;
}

export class SmilesFavourite extends Feature<object> {
  readonly id = 'smiles-favourite';
  readonly name = 'Nastavení smajlíků – oblíbení';
  readonly description =
    'Na stránce „Nastavení smajlíků" přidá sloupec „Oblíbený" s checkboxy a pravý box se seznamem uložených oblíbených smajlíků (sdílené se Sidebarem v místnosti).';
  readonly category = 'room' as const;
  readonly matches = [/\/settings\/smiles\.php(?:$|\?)/];
  override readonly runAt = 'end';

  private rows: RowRef[] = [];
  private favBoxEl: HTMLDivElement | null = null;
  private favListEl: HTMLDivElement | null = null;
  private favCountEl: HTMLElement | null = null;
  private limitNoticeEl: HTMLDivElement | null = null;
  private current: FavouriteSmileys = { nums: [] };

  run(_ctx: FeatureContext<object>): void {
    const tableBody = this.findTableBody();
    if (!tableBody) return;

    this.augmentTable(tableBody);
    this.addRightBox();

    void loadFavouriteSmileys().then((fav) => {
      this.current = fav;
      this.render();
    });

    onFavouriteSmileysChanged((fav) => {
      this.current = fav;
      this.render();
    });
  }

  private findTableBody(): HTMLTableSectionElement | null {
    // Tabulka smajlíků je jediná `<table>` uvnitř `#stredni` s řádky
    // obsahujícími label „*N*".
    const tables = document.querySelectorAll<HTMLTableElement>('#stredni table');
    for (const t of Array.from(tables)) {
      if (t.querySelector('td')?.textContent?.trim().match(/^\*\d+\*$/)) {
        return t.tBodies[0] ?? null;
      }
      // Fallback – první řádek bývá hlavička („Zkratka / Smajlík / Popis").
      const tds = t.querySelectorAll('tr > td');
      for (const td of Array.from(tds)) {
        if (/^\*\d+\*$/.test((td.textContent ?? '').trim())) {
          return t.tBodies[0] ?? null;
        }
      }
    }
    return null;
  }

  private augmentTable(tbody: HTMLTableSectionElement): void {
    const rows = Array.from(tbody.rows);
    this.rows = [];

    // 1) Hlavička – najdeme řádek, který má text „Popis" v třetí buňce.
    const headerRow = rows.find((r) => {
      const tds = r.querySelectorAll('td');
      return (
        tds.length >= 3 &&
        /Popis/i.test((tds[2]?.textContent ?? '').trim()) &&
        /Zkratka/i.test((tds[0]?.textContent ?? '').trim())
      );
    });
    if (headerRow) {
      const th = document.createElement('td');
      th.style.width = '80px';
      th.style.fontWeight = 'bold';
      th.style.textAlign = 'center';
      th.textContent = 'Oblíbený';
      headerRow.appendChild(th);
    }

    // 2) Datové řádky.
    for (const row of rows) {
      if (row === headerRow) continue;
      const tds = row.querySelectorAll('td');
      if (tds.length === 0) continue;
      const labelTd = tds[0];
      const m = (labelTd?.textContent ?? '').trim().match(/^\*(\d+)\*$/);
      if (!m) continue;
      const num = Number(m[1]);

      const cell = document.createElement('td');
      cell.style.textAlign = 'center';
      cell.style.width = '80px';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.setAttribute('aria-label', `Oblíbený smajlík *${num}*`);
      checkbox.title = 'Přidat/odebrat z oblíbených';
      checkbox.addEventListener('change', () => {
        void this.toggleFavourite(num, checkbox);
      });

      cell.appendChild(checkbox);
      row.appendChild(cell);

      this.rows.push({ num, checkbox });
    }

    // 3) Hláška „dosažen limit" – umístíme nad tabulku (box „Smajlíci" nadpis).
    const smilesHeading = Array.from(
      document.querySelectorAll<HTMLElement>('#stredni .nadpis4'),
    ).find((h) => /smajlíci/i.test(h.textContent ?? ''));
    if (smilesHeading) {
      const notice = document.createElement('div');
      notice.className = 'xct-smiles-limit-notice';
      notice.style.cssText =
        'margin:6px 0;padding:6px 10px;border:1px solid #d49a00;background:#fff3d6;color:#8a5600;border-radius:3px;font-size:12px;display:none;';
      notice.textContent = `Dosáhl jsi maximálního počtu oblíbených smajlíků (${FAVOURITE_SMILEYS_MAX}). Před přidáním dalšího některého odeber.`;
      smilesHeading.parentElement?.insertBefore(notice, smilesHeading.nextSibling);
      this.limitNoticeEl = notice;
    }
  }

  private addRightBox(): void {
    const pravy = document.getElementById('pravy');
    if (!pravy) return;

    const box = document.createElement('div');
    box.className = 'blue_box xct-favsmiles-box';
    box.style.marginTop = '10px';

    const tab = document.createElement('div');
    tab.className = 'blue_tab';
    const h = document.createElement('h1');
    h.className = 'blue_box_head';
    // Titulek „Oblíbení" + počet rovnou v textu nadpisu, bez dalších
    // stylů či vnořených elementů (např. „Oblíbení (0/100)").
    h.textContent = `Oblíbení (0/${FAVOURITE_SMILEYS_MAX})`;
    tab.appendChild(h);
    box.appendChild(tab);

    const body = document.createElement('div');
    body.className = 'blue_box2 xct-favsmiles-body';
    body.style.padding = '6px';

    const hint = document.createElement('div');
    hint.className = 'xct-favsmiles-hint';
    hint.style.cssText = 'font-size:11px;color:#555;margin-bottom:6px;';
    hint.textContent = 'Kliknutím zase odebereš:';
    body.appendChild(hint);

    const list = document.createElement('div');
    list.className = 'xct-favsmiles-list';
    list.style.cssText =
      'display:flex;flex-wrap:wrap;gap:4px;align-items:center;';
    body.appendChild(list);

    const emptyNote = document.createElement('div');
    emptyNote.className = 'xct-favsmiles-empty';
    emptyNote.style.cssText = 'font-size:11px;color:#888;font-style:italic;';
    emptyNote.textContent = 'Zatím žádní oblíbení – zaškrtni je v tabulce nalevo.';
    body.appendChild(emptyNote);

    box.appendChild(body);

    const bot = document.createElement('div');
    bot.className = 'blue_box_bot';
    box.appendChild(bot);

    // Vložíme pod stávající modrý box (Elza / Můj profil / …) – hned za první
    // `.blue_box_bot` uvnitř #pravy.
    const afterNode = pravy.querySelector('.blue_box_bot');
    if (afterNode?.parentElement) {
      afterNode.parentElement.insertBefore(box, afterNode.nextSibling);
    } else {
      pravy.appendChild(box);
    }

    this.favBoxEl = box;
    this.favListEl = list;
    this.favCountEl = h;
  }

  private async toggleFavourite(num: number, checkbox: HTMLInputElement): Promise<void> {
    if (checkbox.checked) {
      const res = await addFavouriteSmiley(num);
      if (res === 'full') {
        checkbox.checked = false;
        this.flashLimitNotice();
      }
    } else {
      await removeFavouriteSmiley(num);
    }
  }

  private flashLimitNotice(): void {
    const el = this.limitNoticeEl;
    if (!el) {
      window.alert(
        `Dosáhl jsi maximálního počtu oblíbených smajlíků (${FAVOURITE_SMILEYS_MAX}).`,
      );
      return;
    }
    el.style.display = 'block';
    window.clearTimeout((el as HTMLDivElement & { _xctT?: number })._xctT);
    (el as HTMLDivElement & { _xctT?: number })._xctT = window.setTimeout(() => {
      el.style.display = 'none';
    }, 4000);
  }

  private render(): void {
    const set = new Set(this.current.nums);

    // 1) Checkboxy v tabulce.
    for (const r of this.rows) {
      r.checkbox.checked = set.has(r.num);
    }

    // 2) Pravý box – počet + seznam miniatur (vždy seřazeno vzestupně).
    if (this.favCountEl) {
      this.favCountEl.textContent = `Oblíbení (${this.current.nums.length}/${FAVOURITE_SMILEYS_MAX})`;
    }
    if (!this.favListEl) return;
    this.favListEl.textContent = '';
    const empty = this.favBoxEl?.querySelector<HTMLDivElement>('.xct-favsmiles-empty');
    if (this.current.nums.length === 0) {
      if (empty) empty.style.display = '';
      return;
    }
    if (empty) empty.style.display = 'none';

    const sorted = [...this.current.nums].sort((a, b) => a - b);
    for (const num of sorted) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'xct-favsmiles-item';
      btn.title = `*${num}*`;
      btn.style.cssText =
        'background:none;border:1px solid transparent;border-radius:3px;padding:2px;cursor:pointer;';
      btn.addEventListener('mouseenter', () => {
        btn.style.borderColor = '#c0392b';
        btn.style.background = '#fde3e0';
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.borderColor = 'transparent';
        btn.style.background = 'none';
      });
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        void removeFavouriteSmiley(num);
      });

      const img = document.createElement('img');
      img.src = XChatEmoji.url(num);
      img.alt = `*${num}*`;
      img.style.display = 'block';

      btn.appendChild(img);
      this.favListEl.appendChild(btn);
    }
  }
}
