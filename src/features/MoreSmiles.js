/**
 * Více smajlíků v záložce Nastavit (users/help/ignore).
 * Konfigurace se ukládá do `chrome.storage.local` (dříve GM_setValue).
 * Původní userscript: `xchat-more-smiles.user.js`.
 */

import { Feature } from '../core/Feature.js';

const STORAGE_KEY = 'more-smiles:ids';
const DEFAULT_IDS = [1];

function parseSmileys(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map(Number))].filter((n) => Number.isInteger(n) && n > 0);
  }
  const src = String(value ?? '').trim();
  if (!src) return [];
  return [
    ...new Set(
      src
        .split(/\s*,\s*/)
        .map((s) => Number(s))
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ];
}

function smileyUrl(id) {
  return `https://x.ximg.cz/images/x4/sm/${id % 100}/${id}.gif`;
}

async function loadIds() {
  const raw = await chrome.storage.local.get(STORAGE_KEY);
  const parsed = parseSmileys(raw?.[STORAGE_KEY]);
  return parsed.length ? parsed : [...DEFAULT_IDS];
}

async function saveIds(ids) {
  await chrome.storage.local.set({ [STORAGE_KEY]: ids });
}

export class MoreSmiles extends Feature {
  static id = 'more-smiles';
  static name = 'Více smajlíků v Nastavit';
  static description =
    'Přidá záložku se smajlíky na stránkách Uživatelé / Nápověda / Ignorování a umožní nastavit vlastní seznam ID smajlíků.';
  static matches = [
    /\/modchat\?.*op=userspage/,
    /\/modchat\?.*op=onlinehelppage/,
    /\/modchat\?.*op=ignorepage/,
  ];
  static runAt = 'end';

  #initialized = false;

  async run() {
    this.#observeTabRename();
    if (!(await this.#tryInit())) {
      let attempts = 0;
      const maxAttempts = 20;
      const timer = setInterval(async () => {
        attempts += 1;
        const ok = await this.#tryInit();
        if (ok || attempts >= maxAttempts) {
          clearInterval(timer);
          this.#renameSettingsTab();
        }
      }, 250);
    }
  }

  #renameSettingsTabInDoc(doc) {
    if (!doc) return false;
    const targets = doc.querySelectorAll(
      '#cr2 h3 a[href*="tab=settings"], #cr2 > h3 a',
    );
    let changed = false;
    targets.forEach((link) => {
      if (link.textContent === 'Smajlíci') return;
      link.textContent = 'Smajlíci';
      changed = true;
    });
    return targets.length > 0 || changed;
  }

  #candidateDocs() {
    const docs = [document];
    try {
      if (top && top.document && top.document !== document) docs.push(top.document);
      if (top?.frames?.length) {
        for (let i = 0; i < top.frames.length; i += 1) {
          const d = top.frames[i]?.document;
          if (d && !docs.includes(d)) docs.push(d);
        }
      }
    } catch {
      // cross-origin – ignoruj
    }
    return docs;
  }

  #renameSettingsTab() {
    let any = false;
    this.#candidateDocs().forEach((doc) => {
      if (this.#renameSettingsTabInDoc(doc)) any = true;
    });
    return any;
  }

  #observeTabRename() {
    this.#candidateDocs().forEach((doc) => {
      if (!doc?.body) return;
      const observer = new MutationObserver(() => this.#renameSettingsTab());
      observer.observe(doc.body, { childList: true, subtree: true, characterData: true });
    });
  }

  #ensureSettingsTab() {
    this.#renameSettingsTab();
    const tabContent = document.querySelector('#cr2 #crdiv2');
    if (!tabContent) return false;
    if (!tabContent.querySelector('#smileys')) {
      tabContent.innerHTML = '<div id="smileys"></div>';
    }
    return Boolean(document.getElementById('smileys'));
  }

  #ensureUpdateButton() {
    if (document.getElementById('updateSmiley')) return;
    const container = document.getElementById('smileys');
    if (!container) return;
    const button = document.createElement('button');
    button.id = 'updateSmiley';
    button.type = 'button';
    button.textContent = 'Nastavit smajlíky';
    Object.assign(button.style, {
      position: 'absolute',
      bottom: '5px',
      left: '0',
      right: '0',
      margin: '0 auto',
      width: '150px',
    });
    container.insertAdjacentElement('afterend', button);
  }

  async #saveFromPrompt() {
    const current = (await loadIds()).join(', ');
    const entered = prompt('Organizace smajlíků (pouze čísla!). Oddělit čárkou.', current);
    if (!entered) return;
    const parsed = parseSmileys(entered);
    if (!parsed.length) {
      alert('Nebyly zadány žádné platné hodnoty.');
      return;
    }
    await saveIds(parsed);
    alert('Uloženo, obnov záložku.');
  }

  #createSmileyElement(id) {
    const link = document.createElement('a');
    link.href = `javascript:add_smiley(${id});`;
    link.title = `*${id}*`;
    Object.assign(link.style, { display: 'inline-block', margin: '1px' });
    const img = document.createElement('img');
    img.src = smileyUrl(id);
    img.alt = `*${id}*`;
    img.title = `*${id}*`;
    img.style.cursor = 'pointer';
    link.appendChild(img);
    return link;
  }

  async #renderSmileys() {
    const container = document.getElementById('smileys');
    if (!container) return;
    const ids = await loadIds();
    container.innerHTML = '';
    ids.forEach((id) => container.appendChild(this.#createSmileyElement(id)));
  }

  #bindEvents() {
    document.addEventListener('click', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.id !== 'updateSmiley') return;
      this.#saveFromPrompt();
    });
  }

  async #tryInit() {
    if (!this.#ensureSettingsTab()) return false;
    if (this.#initialized) return true;
    this.#ensureUpdateButton();
    await this.#renderSmileys();
    this.#bindEvents();
    this.#initialized = true;
    return true;
  }
}
