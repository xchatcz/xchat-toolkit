/**
 * Oblíbení smajlíci v místnosti navíc + stabilní výška smiley-frame.
 * Původní userscript: `xchat-room-favourite-emojis.user.js`.
 */

import { Feature } from '../core/Feature.js';

const SMILEY_FRAME_HEIGHT_PX = 180;
const EXTRA_SMILEY_IDS = [
  141, 712, 3189, 921, 2009, 2373, 2374, 2583, 2653, 2731, 4548, 4661,
  5016, 5068, 4068, 4069, 4146, 4594, 3093, 4142,
];

function unique(arr) {
  return [...new Set(arr.map(Number).filter((n) => Number.isFinite(n)))].sort((a, b) => a - b);
}

function smileyUrl(id) {
  const s = String(id);
  const last2 = s.length >= 2 ? s.slice(-2) : s;
  const bucket = s.length >= 2 && last2[0] === '0' ? last2[1] : last2;
  return `https://x.ximg.cz/images/x4/sm/${bucket}/${id}.gif`;
}

export class FavouriteEmojis extends Feature {
  static id = 'favourite-emojis';
  static name = 'Oblíbení smajlíci navíc';
  static description =
    'Přidá další oblíbené smajlíky do rámce smajlíků a udržuje stabilní výšku.';
  static matches = [/\/modchat\?.*op=smilepage/, /\/modchat\/room\//];
  static runAt = 'end';

  run() {
    const url = location.href;
    if (url.includes('/modchat?op=smilepage')) {
      this.#runWithRetries(() => this.#handleSmilepage(), 8);
    }
    if (url.includes('/modchat/room/')) {
      this.#keepEnforcingRoomFramesetHeight();
    }
  }

  #runWithRetries(fn, retries) {
    let left = retries;
    const tick = () => {
      fn();
      left -= 1;
      if (left > 0) setTimeout(tick, 250);
    };
    tick();
  }

  #handleSmilepage() {
    const cr = document.querySelector('div.cr');
    if (cr) cr.style.height = '10000px';
    this.#injectSmilies();
  }

  #createAnchor(id) {
    const a = document.createElement('a');
    a.href = `javascript:add_smiley(${id});`;
    const img = document.createElement('img');
    img.src = smileyUrl(id);
    img.alt = `*${id}*`;
    img.title = `*${id}*`;
    a.appendChild(img);
    return a;
  }

  #injectSmilies() {
    const wrap = document.getElementById('crdiv1');
    if (!wrap) return;
    wrap.querySelector('#tm-extra-smilies')?.remove();

    const container = document.createElement('div');
    container.id = 'tm-extra-smilies';
    container.style.marginTop = '6px';

    const p = document.createElement('p');
    p.className = 'psm';
    unique(EXTRA_SMILEY_IDS).forEach((id) => p.appendChild(this.#createAnchor(id)));
    container.appendChild(p);

    const bottomNav = wrap.querySelector('#er, #mr')?.closest('p');
    if (bottomNav && bottomNav.parentElement === wrap) {
      wrap.insertBefore(container, bottomNav);
    } else {
      wrap.appendChild(container);
    }
  }

  #desiredRows() {
    const h = Math.max(0, Math.floor(SMILEY_FRAME_HEIGHT_PX));
    return `50,*,${h},0,0,0`;
  }

  #enforceRoomFramesetHeight() {
    const fs = document.getElementById('rightframe');
    if (!fs) return false;
    const desired = this.#desiredRows();
    if (fs.getAttribute('rows') !== desired) fs.setAttribute('rows', desired);
    return true;
  }

  #keepEnforcingRoomFramesetHeight() {
    this.#enforceRoomFramesetHeight();
    setInterval(() => this.#enforceRoomFramesetHeight(), 500);

    const installObserver = () => {
      const fs = document.getElementById('rightframe');
      if (!fs) return;
      const obs = new MutationObserver(() => this.#enforceRoomFramesetHeight());
      obs.observe(fs, { attributes: true, attributeFilter: ['rows'] });
    };

    let tries = 0;
    const maxTries = 30;
    const timer = setInterval(() => {
      tries += 1;
      if (this.#enforceRoomFramesetHeight()) {
        installObserver();
        clearInterval(timer);
      } else if (tries >= maxTries) {
        clearInterval(timer);
      }
    }, 250);
  }
}
