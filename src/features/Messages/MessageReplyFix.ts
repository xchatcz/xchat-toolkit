/**
 * Vzkazy – oprava tlačítek náhledu a vložení textu původního vzkazu.
 *
 * Formulář na new_msg.php používá stránkové funkce `zobraz('nahled')` a
 * `vloz_text()`; v MV3 je musíme znovu připojit z content scriptu.
 * `count_length()` z hostitelské stránky voláme injekcí skriptu.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { Feature } from '../../core/Feature';

const PROMPT_LONG =
  'Původní vzkaz nebude možné vložit celý a bude zkrácen.\nOpravdu tedy chceš přidat text starého vzkazu?';
const PROMPT_SHORT =
  'Přidáním původního vzkazu si ubereš počet znaků pro svou vlastní zprávu.\nOpravdu tedy chceš přidat text starého vzkazu?';

/** Spustí funkci v MAIN world hostitelské stránky. */
const runInPage = (fn: () => void): void => {
  const script = document.createElement('script');
  script.textContent = `(${fn.toString()})();`;
  (document.head || document.documentElement).appendChild(script);
  script.remove();
};

export class MessageReplyFix extends Feature {
  readonly id = 'message-reply-fix';
  readonly name = 'Vzkazy – oprava odpovědi';
  readonly description = 'Opravuje funkčnost náhledu a vložení textu původního vzkazu.';
  readonly category = 'offline-messages' as const;
  readonly matches = [/\/offline\/new_msg\.php/];
  override readonly runAt = 'end';

  run(): void {
    const nahled = document.getElementById('nahled');
    if (!nahled) return;

    document.querySelectorAll<HTMLSpanElement>('span.odkazA').forEach((span) => {
      const onclick = span.getAttribute('onclick');
      if (onclick === "zobraz('nahled')") {
        span.removeAttribute('onclick');
        span.addEventListener('click', () => nahled.classList.remove('hid'));
      }
      if (onclick === 'vloz_text()') {
        span.removeAttribute('onclick');
        span.addEventListener('click', () => this.insertOriginalText());
      }
    });
  }

  private insertOriginalText(): void {
    const message = document.getElementById('message') as HTMLTextAreaElement | null;
    const messageOld = document.getElementById('message_old') as HTMLTextAreaElement | null;
    if (!message || !messageOld) return;

    const tooLong = message.value.length + messageOld.value.length > 1024;
    if (!confirm(tooLong ? PROMPT_LONG : PROMPT_SHORT)) return;

    message.value += '\n\n-- Odpověď na --\n' + messageOld.value + '\n-- ';
    runInPage(() => {
      const w = window as unknown as { count_length?: () => void };
      if (typeof w.count_length === 'function') w.count_length();
    });
  }
}
