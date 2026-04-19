/**
 * Vzkazy – tlačítko „Kopírovat" u přijatých zpráv.
 * Původní userscript: `xchat-messages-copy-on-click.js`.
 */

import { Feature } from '../core/Feature.js';

const BUTTON_CLASS = 'xchat-copy-message-button';
const COPIED_CLASS = 'is-copied';
const HELPER_CLASS = 'xchat-copy-message-helper';
const LABEL = 'Kopírovat';
const COPIED_LABEL = 'Zkopírováno';
const BLOCK_TAGS = new Set(['DIV', 'P', 'LI', 'UL', 'OL', 'TABLE', 'TBODY', 'TR', 'TD']);

const STYLES = `
.${BUTTON_CLASS} { margin-left: 2px !important; }
.${BUTTON_CLASS}.${COPIED_CLASS} { font-weight: bold; }
.${HELPER_CLASS} { position: fixed; top: -9999px; left: -9999px; }
`;

export class MessageCopy extends Feature {
  static id = 'message-copy';
  static name = 'Vzkazy – kopírovat detail';
  static description = 'Tlačítko „Kopírovat" v detailu přijatého vzkazu.';
  static matches = [/\/offline\/read_msg\.php/];
  static runAt = 'end';

  run() {
    const form = document.forms.readmsg;
    if (!form) return;
    this.#injectStyles();
    this.#addButton(form);
  }

  #injectStyles() {
    if (document.getElementById('xchat-copy-message-styles')) return;
    const style = document.createElement('style');
    style.id = 'xchat-copy-message-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  #addButton(form) {
    const ignoreButton = form.querySelector('input[name="operace"][value="Ignorovat"]');
    if (!ignoreButton || form.querySelector('.' + BUTTON_CLASS)) return;

    const btn = document.createElement('input');
    btn.type = 'button';
    btn.value = LABEL;
    btn.className = 'btn1 ' + BUTTON_CLASS;
    btn.addEventListener('click', async () => {
      try {
        await this.#copyToClipboard(this.#buildText(form));
        this.#showCopied(btn);
      } catch (err) {
        console.error('[XChat Toolkit] Kopírování selhalo:', err);
      }
    });
    ignoreButton.insertAdjacentElement('afterend', btn);
  }

  #buildText(form) {
    const headerRows = this.#getHeaderRows(form);
    return [
      'Od: ' + this.#getField(headerRows, 'Od'),
      'Komu: ' + this.#getField(headerRows, 'Uživatelům'),
      'Předmět: ' + this.#getField(headerRows, 'Předmět'),
      'Datum a čas: ' + this.#getField(headerRows, 'Zasláno'),
      'Obsah zprávy: ' + this.#getBody(form),
    ].join('\n');
  }

  #getHeaderRows(form) {
    const table = form.querySelector('.msg_head td > table');
    if (!table) return [];
    return Array.from(table.querySelectorAll('tr')).filter((row) =>
      Array.from(row.children).some((c) => c.tagName === 'TH'),
    );
  }

  #getField(rows, labelPrefix) {
    const row = rows.find((r) => {
      const th = Array.from(r.children).find((c) => c.tagName === 'TH');
      if (!th) return false;
      const normalized = th.textContent.replace(/\s+/g, ' ').trim();
      return normalized.startsWith(labelPrefix);
    });
    if (!row) return '';
    const tds = Array.from(row.children).filter((c) => c.tagName === 'TD');
    const last = tds[tds.length - 1];
    return last ? this.#normalize(last.textContent) : '';
  }

  #getBody(form) {
    const boxes = form.querySelectorAll(':scope > .boxudaje2');
    const body = boxes[1]?.querySelector('.boxudaje3');
    if (!body) return '';
    return this.#normalize(this.#serialize(body));
  }

  #normalize(text) {
    return String(text || '')
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  #unwrapRedirect(url) {
    if (!url) return '';
    try {
      const parsed = new URL(url, location.href);
      if (parsed.hostname !== 'redir.xchat.cz') return parsed.href;
      return parsed.searchParams.get('url') ?? parsed.href;
    } catch {
      return url;
    }
  }

  #serialize(node) {
    if (!node) return '';
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const tag = node.tagName;
    if (tag === 'BR') return '\n';
    if (tag === 'A') return this.#unwrapRedirect(node.href || node.getAttribute('href') || '');
    const inner = Array.from(node.childNodes).map((c) => this.#serialize(c)).join('');
    return BLOCK_TAGS.has(tag) ? '\n' + inner + '\n' : inner;
  }

  async #copyToClipboard(text) {
    if (navigator.clipboard && isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', 'readonly');
    ta.className = HELPER_CLASS;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }

  #showCopied(btn) {
    const original = btn.value;
    btn.value = COPIED_LABEL;
    btn.classList.add(COPIED_CLASS);
    setTimeout(() => {
      btn.value = original;
      btn.classList.remove(COPIED_CLASS);
    }, 500);
  }
}
