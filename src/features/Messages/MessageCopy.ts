/**
 * Vzkazy – tlačítko „Kopírovat" v detailu přijatého vzkazu.
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { Feature } from '../../core/Feature';

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
  readonly id = 'message-copy';
  readonly name = 'Vzkazy – kopírovat detail';
  readonly description = 'Tlačítko „Kopírovat" v detailu přijatého vzkazu.';
  readonly category = 'offline-messages' as const;
  readonly matches = [/\/offline\/read_msg\.php/];
  override readonly runAt = 'end';

  run(): void {
    const form = (document.forms as unknown as { readmsg?: HTMLFormElement }).readmsg;
    if (!form) return;
    this.injectStyles();
    this.addButton(form);
  }

  private injectStyles(): void {
    if (document.getElementById('xchat-copy-message-styles')) return;
    const style = document.createElement('style');
    style.id = 'xchat-copy-message-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  private addButton(form: HTMLFormElement): void {
    const ignoreButton = form.querySelector<HTMLInputElement>(
      'input[name="operace"][value="Ignorovat"]',
    );
    if (!ignoreButton || form.querySelector('.' + BUTTON_CLASS)) return;

    const btn = document.createElement('input');
    btn.type = 'button';
    btn.value = LABEL;
    btn.className = 'btn1 ' + BUTTON_CLASS;
    btn.addEventListener('click', async () => {
      try {
        await this.copyToClipboard(this.buildText(form));
        this.showCopied(btn);
      } catch (err) {
        console.error('[XChat Toolkit] Kopírování selhalo:', err);
      }
    });
    ignoreButton.insertAdjacentElement('afterend', btn);
  }

  private buildText(form: HTMLFormElement): string {
    const rows = this.getHeaderRows(form);
    return [
      'Od: ' + this.getField(rows, 'Od'),
      'Komu: ' + this.getField(rows, 'Uživatelům'),
      'Předmět: ' + this.getField(rows, 'Předmět'),
      'Datum a čas: ' + this.getField(rows, 'Zasláno'),
      'Obsah zprávy: ' + this.getBody(form),
    ].join('\n');
  }

  private getHeaderRows(form: HTMLFormElement): HTMLTableRowElement[] {
    const table = form.querySelector<HTMLTableElement>('.msg_head td > table');
    if (!table) return [];
    return Array.from(table.querySelectorAll('tr')).filter((row) =>
      Array.from(row.children).some((c) => c.tagName === 'TH'),
    );
  }

  private getField(rows: HTMLTableRowElement[], labelPrefix: string): string {
    const row = rows.find((r) => {
      const th = Array.from(r.children).find((c) => c.tagName === 'TH');
      if (!th) return false;
      return (th.textContent ?? '').replace(/\s+/g, ' ').trim().startsWith(labelPrefix);
    });
    if (!row) return '';
    const tds = Array.from(row.children).filter((c) => c.tagName === 'TD');
    const last = tds[tds.length - 1];
    return last ? this.normalize(last.textContent ?? '') : '';
  }

  private getBody(form: HTMLFormElement): string {
    const boxes = form.querySelectorAll<HTMLElement>(':scope > .boxudaje2');
    const body = boxes[1]?.querySelector('.boxudaje3');
    if (!body) return '';
    return this.normalize(this.serialize(body));
  }

  private normalize(text: string): string {
    return String(text)
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  private unwrapRedirect(url: string): string {
    if (!url) return '';
    try {
      const parsed = new URL(url, location.href);
      if (parsed.hostname !== 'redir.xchat.cz') return parsed.href;
      return parsed.searchParams.get('url') ?? parsed.href;
    } catch {
      return url;
    }
  }

  private serialize(node: Node): string {
    if (!node) return '';
    if (node.nodeType === Node.TEXT_NODE) return node.nodeValue ?? '';
    if (node.nodeType !== Node.ELEMENT_NODE) return '';
    const el = node as HTMLElement;
    const tag = el.tagName;
    if (tag === 'BR') return '\n';
    if (tag === 'A') {
      return this.unwrapRedirect((el as HTMLAnchorElement).href || el.getAttribute('href') || '');
    }
    const inner = Array.from(el.childNodes).map((c) => this.serialize(c)).join('');
    return BLOCK_TAGS.has(tag) ? '\n' + inner + '\n' : inner;
  }

  private async copyToClipboard(text: string): Promise<void> {
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

  private showCopied(btn: HTMLInputElement): void {
    const original = btn.value;
    btn.value = COPIED_LABEL;
    btn.classList.add(COPIED_CLASS);
    setTimeout(() => {
      btn.value = original;
      btn.classList.remove(COPIED_CLASS);
    }, 500);
  }
}
