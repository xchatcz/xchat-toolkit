/**
 * Vzkazy – oprava tlačítek pro náhled a vložení textu původního vzkazu.
 * Původní userscript: `xchat-messages-replyon-button-fix.user.js`.
 */

import { Feature } from '../core/Feature.js';
import { runInPage } from '../core/pageInject.js';

export class MessageReplyFix extends Feature {
  static id = 'message-reply-fix';
  static name = 'Vzkazy – oprava odpovědi';
  static description = 'Opravuje funkčnost náhledu a vložení textu původního vzkazu.';
  static matches = [/\/offline\/new_msg\.php/];
  static runAt = 'end';

  run() {
    const nahled = document.getElementById('nahled');
    if (!nahled) return;

    document.querySelectorAll('span.odkazA').forEach((span) => {
      const onclick = span.getAttribute('onclick');

      if (onclick === "zobraz('nahled')") {
        span.removeAttribute('onclick');
        span.addEventListener('click', () => nahled.classList.remove('hid'));
      }

      if (onclick === 'vloz_text()') {
        span.removeAttribute('onclick');
        span.addEventListener('click', () => this.#insertOriginalText());
      }
    });
  }

  #insertOriginalText() {
    const message = document.getElementById('message');
    const messageOld = document.getElementById('message_old');
    if (!message || !messageOld) return;

    const tooLong = message.value.length + messageOld.value.length > 1024;
    const prompt = tooLong
      ? 'Původní vzkaz nebude možné vložit celý a bude zkrácen.'
      : 'Přidáním původního vzkazu si ubereš počet znaků pro svou vlastní zprávu.';

    if (!confirm(prompt + '\nOpravdu tedy chceš přidat text starého vzkazu?')) return;

    message.value += '\n\n-- Odpověď na --\n' + messageOld.value + '\n-- ';
    // `count_length()` je definovaný ve stránce XChatu → MAIN world volání.
    runInPage(function () {
      if (typeof window.count_length === 'function') window.count_length();
    });
  }
}
