/**
 * InfoStrip – úzký proužek nad formulářem (info z op=infopage).
 *
 * HTML přebíráme 1:1 od XChatu, ale před zobrazením provedeme dvě úpravy:
 *  1) klik na `<a href="javascript:roominfo(rid)">` chytneme a otevřeme
 *     overlay s detailem místnosti (JS `roominfo()` v naší React stránce
 *     neexistuje – default navigace by vedla do „about:blank");
 *  2) časové údaje `HH:MM:SS` tikají živě po sekundě:
 *       – text „Nemluvil jsi" → inkrement
 *       – text „obnov…" (Obnovení / obnovit) → dekrement
 *     XChat refreshuje HTML každých 15 s, takže bez tikání se hodnota
 *     aktualizovala trhaně.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
} from 'react';
import type { RoomContext } from '../../../api/types';
import type { RoomOptions } from '../../../features/Room/RoomApp';
import { XChatHttp, XChatUrls } from '../../../api/XChatApi';
import { requestQue } from '../../services/RequestQue';
import './InfoStrip.scss';

export interface InfoStripProps {
  ctx: RoomContext;
  /** Aktuální počet uživatelů (zobrazí se v overlay). */
  userCount: number;
  /** Otevře overlay „Informace o místnosti" (řídí App.tsx). */
  onOpenRoomDetails: () => void;
  /**
   * Volitelný callback, který informuje rodiče, kolik sekund už uživatel
   * „nemluvil". Posíláme jen hrubé překlopení přes prahy 15 min / 40 min,
   * aby se App zbytečně nererendroval každou sekundu.
   */
  onIdleSecondsChange?: (seconds: number) => void;
  /** Aktuální filtr zpráv (all / room / whisper). */
  messageFilter: RoomOptions['messageFilter'];
  /** Zda zvýrazňovat můj nick ve zprávách. */
  highlightMyNick: boolean;
  /** Zda zvýrazňovat pozadí šeptaných zpráv. */
  highlightWhispers: boolean;
  /** Interval obnovování infopage (sekundy) – přebíráme z room options. */
  refreshIntervalSec: number;
  /** Live-setter roomOptions (persistuje do chrome.storage.sync). */
  onSetOption: <K extends keyof RoomOptions>(key: K, value: RoomOptions[K]) => void;
}

/** `HH:MM:SS` / `MM:SS` / `SS` → sekundy. */
const parseTime = (t: string): number => {
  const parts = t.split(':').map((p) => Number(p));
  if (parts.some(Number.isNaN)) return 0;
  let s = 0;
  for (const p of parts) s = s * 60 + p;
  return s;
};

/** Sekundy → `MM:SS` (vždy stejná šířka – ať neskáče layout). */
const formatTime = (sec: number): string => {
  if (sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(m)}:${pad(s)}`;
};

/**
 * Vrátí směr tiku (up / down) pro uzel `text` na základě TEXTOVÉHO okolí
 * v celém InfoStripu. DOM přístup (walk po předcích) selhával, protože
 * společný předek často obsahuje OBĚ klíčovky – vracel pak vždy „up".
 *
 * Postup:
 *   1) spočítáme offset textového uzlu v celém textContentu rootu,
 *   2) v textu před ním najdeme poslední výskyt „nemluvil" / „obnov",
 *   3) ta bližší vyhrává.
 */
const computeTextOffset = (root: HTMLElement, target: Text): number => {
  let offset = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let n: Node | null;
  // eslint-disable-next-line no-cond-assign
  while ((n = walker.nextNode())) {
    if (n === target) return offset;
    offset += (n.nodeValue ?? '').length;
  }
  return -1;
};

const detectTickDir = (text: Text, root: HTMLElement): 'up' | 'down' | null => {
  const offset = computeTextOffset(root, text);
  if (offset < 0) return null;
  const flat = (root.textContent ?? '').toLowerCase();
  const before = flat.slice(0, offset);
  const idxUp = before.lastIndexOf('nemluvil');
  const idxDown = before.lastIndexOf('obnov');
  if (idxUp < 0 && idxDown < 0) return null;
  // Bližší (vyšší index) klíčovka vyhrává.
  return idxUp > idxDown ? 'up' : 'down';
};

/** Prahy zvýraznění doby „nemluvil jsi" (v sekundách). */
const IDLE_WARN_SEC = 15 * 60;
const IDLE_DANGER_SEC = 40 * 60;

/** Nastaví `data-xct-idle-level` podle aktuálního počtu sekund. */
const applyIdleLevel = (sp: HTMLSpanElement, sec: number): void => {
  const lvl =
    sec >= IDLE_DANGER_SEC ? 'danger' : sec >= IDLE_WARN_SEC ? 'warn' : 'ok';
  if (sp.getAttribute('data-xct-idle-level') !== lvl) {
    sp.setAttribute('data-xct-idle-level', lvl);
  }
};

const TIME_RE = /\b(\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2})\b/;
/**
 * XChat občas vypíše čas obnovení jen jako holé sekundy („obnovení: 5"),
 * bez formátu MM:SS. Pro ticker „down" akceptujeme i samotné číslo.
 */
const BARE_SEC_RE = /\b(\d{1,3})\b/;
const ANY_DIGIT_RE = /\d/;

/**
 * Po každé aktualizaci `html` najdeme textové uzly obsahující časový údaj
 * a obalíme je do `<span data-xct-tick="up|down">`. Směr detekujeme podle
 * textu uvnitř stejného blokového rodiče (buňka tabulky / div / td).
 */
const annotateTickers = (root: HTMLElement): void => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      ANY_DIGIT_RE.test(n.nodeValue ?? '')
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT,
  });

  const targets: Text[] = [];
  let node: Node | null;
  // eslint-disable-next-line no-cond-assign
  while ((node = walker.nextNode())) targets.push(node as Text);

  for (const text of targets) {
    const parent = text.parentElement;
    if (!parent || parent.closest('[data-xct-tick]')) continue;

    // Směr tiku hledáme procházením předků – XChat občas číslo obaluje
    // vlastním `<span>`, ve kterém slovo „obnov" / „nemluvil" není.
    const dir = detectTickDir(text, root);
    if (!dir) continue;

    // Pro „down" (obnovení) akceptujeme i holé sekundy bez dvojtečky.
    // Pro „up" (nemluvil) vyžadujeme vždy formát MM:SS / HH:MM:SS –
    // ať nechytneme třeba číslo uživatelů.
    const value = text.nodeValue ?? '';
    let match = value.match(TIME_RE);
    const hasColon = !!match;
    if (!match && dir === 'down') match = value.match(BARE_SEC_RE);
    if (!match) continue;
    const raw = match[0];
    const seconds = parseTime(raw);
    const before = value.slice(0, match.index ?? 0);
    const after = value.slice((match.index ?? 0) + raw.length);

    const span = document.createElement('span');
    span.setAttribute('data-xct-tick', dir);
    span.setAttribute('data-xct-seconds', String(seconds));
    // Pokud XChat zapsal holé sekundy („5"), držíme ten formát i dál,
    // ať po první sekundě neskočíme na „00:04".
    span.setAttribute('data-xct-format', hasColon ? 'mmss' : 'bare');
    span.textContent = hasColon ? formatTime(seconds) : String(seconds);
    // Pro „nemluvil" ticker rovnou nastavíme úroveň, ať má CSS čím pracovat
    // hned po vložení (bez čekání na první tikot).
    if (dir === 'up') applyIdleLevel(span, seconds);

    const frag = document.createDocumentFragment();
    if (before) frag.appendChild(document.createTextNode(before));
    frag.appendChild(span);
    if (after) frag.appendChild(document.createTextNode(after));
    text.replaceWith(frag);
  }
};

/** Tikne všechny `[data-xct-tick]` uvnitř `root` o ±1 s. */
const tickAll = (root: HTMLElement): number | null => {
  let idleUp: number | null = null;
  const spans = root.querySelectorAll<HTMLSpanElement>('[data-xct-tick]');
  spans.forEach((sp) => {
    const dir = sp.getAttribute('data-xct-tick');
    const cur = Number(sp.getAttribute('data-xct-seconds') ?? '0');
    const next = dir === 'up' ? cur + 1 : Math.max(0, cur - 1);
    sp.setAttribute('data-xct-seconds', String(next));
    const fmt = sp.getAttribute('data-xct-format');
    sp.textContent = fmt === 'bare' ? String(next) : formatTime(next);
    if (dir === 'up') {
      applyIdleLevel(sp, next);
      idleUp = next;
    }
  });
  return idleUp;
};

const InfoStrip = ({
  ctx,
  onOpenRoomDetails,
  onIdleSecondsChange,
  messageFilter,
  highlightMyNick,
  highlightWhispers,
  refreshIntervalSec,
  onSetOption,
}: InfoStripProps) => {
  const [html, setHtml] = useState<string>('');
  const innerRef = useRef<HTMLDivElement>(null);
  // Držíme normalizovaný HTML z předchozího fetche – když se nový liší
  // jen v číslech (tj. časech, které tikáme sami), `setHtml` þplně
  // vynecháme a InfoStrip tak neproblískne.
  const lastNormRef = useRef<string>('');
  // Drží nejnovější callback, aby si delegovaný handler vždy četl
  // aktuální hodnotu.
  const openRoomDetailsRef = useRef(onOpenRoomDetails);
  openRoomDetailsRef.current = onOpenRoomDetails;
  // Držíme si nejnovější callback v refu – abychom ho nemuseli dávat do
  // deps useEffectu (jinak by se interval resetoval na každém renderu).
  const idleCbRef = useRef<InfoStripProps['onIdleSecondsChange']>(undefined);
  idleCbRef.current = onIdleSecondsChange;

  // Fetch HTML v intervalu dle nastavení („Interval obnovování zpráv").
  // Zaokrouhlíme do rozumného rozsahu (min 3 s, default 5 s), ať uživatel
  // nenaboří XChat nekonečně krátkým intervalem a zároveň nečeká 15 s.
  useEffect(() => {
    const sec = Math.max(3, Number(refreshIntervalSec) || 5);
    const stop = requestQue.every(
      sec * 1000,
      async () => {
        const doc = await XChatHttp.fetchDocument(
          XChatUrls.roomInfoPage(ctx.xhash, ctx.rid, ctx.skin, ctx.roomName),
        );
        const body = doc.body?.innerHTML ?? '';
        // Normalizace – všechna čísla → „N". Když se NE-číselná struktura
        // (slova, tagy, atributy) liší, musíme sáhnout na innerHTML.
        // Jinak jen přepíšeme hodnoty existujících tikerů a Strip
        // neproblikne.
        const norm = body.replace(/\d+/g, 'N');
        const root = innerRef.current;

        if (norm !== lastNormRef.current || !root) {
          lastNormRef.current = norm;
          setHtml(body);
          return;
        }

        // Struktura shodná – vytáhneme aktuální časy z čerstvého HTML
        // (anotace na detached elementu) a přepíšeme jen `data-*` + text
        // v živých tiker spanech.
        const tmp = document.createElement('div');
        tmp.innerHTML = body;
        annotateTickers(tmp);
        const fresh = tmp.querySelectorAll<HTMLSpanElement>('[data-xct-tick]');
        const live = root.querySelectorAll<HTMLSpanElement>('[data-xct-tick]');
        const count = Math.min(fresh.length, live.length);
        for (let i = 0; i < count; i++) {
          const dir = fresh[i].getAttribute('data-xct-tick');
          const freshSec = Number(fresh[i].getAttribute('data-xct-seconds') ?? '0');
          const liveEl = live[i];
          liveEl.setAttribute('data-xct-seconds', String(freshSec));
          const fmt = liveEl.getAttribute('data-xct-format');
          liveEl.textContent =
            fmt === 'bare' ? String(freshSec) : formatTime(freshSec);
          if (dir === 'up') applyIdleLevel(liveEl, freshSec);
        }
        // Nahlásíme aktuální „nemluvil" nahoru (reset po promluvení).
        const upSpan = root.querySelector<HTMLSpanElement>('[data-xct-tick="up"]');
        if (upSpan) {
          idleCbRef.current?.(
            Number(upSpan.getAttribute('data-xct-seconds') ?? '0'),
          );
        }
      },
      'room-info',
    );
    return stop;
  }, [ctx.xhash, ctx.rid, ctx.skin, ctx.roomName, refreshIntervalSec]);

  // Anotace + ticker běží v `useLayoutEffect`, aby označení tikajících
  // časů proběhlo před prvním paintem po změně `html` (jinak by uživatel
  // na okamžik viděl neobalený syrový text z XChatu).
  useLayoutEffect(() => {
    const root = innerRef.current;
    if (!root) return;
    annotateTickers(root);
    // Po anotaci hned zjistíme, jestli neexistuje „nemluvil" ticker a
    // nahlásíme jeho hodnotu nahoru (App podle toho přepíná varování).
    const upSpan = root.querySelector<HTMLSpanElement>('[data-xct-tick="up"]');
    if (upSpan) {
      const sec = Number(upSpan.getAttribute('data-xct-seconds') ?? '0');
      idleCbRef.current?.(sec);
    }
    const id = window.setInterval(() => {
      const idle = tickAll(root);
      if (idle != null) idleCbRef.current?.(idle);
    }, 1000);
    return () => window.clearInterval(id);
  }, [html]);

  // Event delegace – klik na odkaz s názvem místnosti otevře overlay
  // „Informace o místnosti". Rid z linku nebereme – overlay vždy pracuje
  // s `ctx.rid` aktuální místnosti.
  //
  // XChat renderuje ten odkaz různě: `href="javascript:roominfo(rid)"`,
  // `onclick="roominfo(rid)"`, `<strong><a href="?op=…">`, případně
  // prostý `<a>` s textem = názvem místnosti. Akceptujeme všechny
  // varianty + jako fallback první `<a>` v celém stripu (tlačítka
  // „obnovit" / „smazat historie" jsou vždy až na konci).
  const shouldOpenRoomDetails = (link: HTMLAnchorElement, root: HTMLElement): boolean => {
    const href = link.getAttribute('href') ?? '';
    const onclick = link.getAttribute('onclick') ?? '';
    if (/roominfo/i.test(href) || /roominfo/i.test(onclick)) return true;
    const roomName = (ctx.roomName ?? '').trim();
    const linkText = (link.textContent ?? '').trim();
    if (roomName.length > 0 && linkText === roomName) return true;
    if (link.closest('strong') != null) return true;
    const firstLink = root.querySelector('a');
    if (firstLink && firstLink === link) return true;
    return false;
  };

  // React onClick na inner wrapperu (bubble fáze). Funguje pro normální
  // `<a>` s `javascript:` i prázdným href. Původně (8b4ef2f) to takhle
  // jelo v pohodě.
  const handleClick = (e: MouseEvent<HTMLDivElement>): void => {
    const target = e.target as HTMLElement | null;
    if (!target || typeof target.closest !== 'function') return;
    const link = target.closest('a');
    if (!link) return;
    const root = innerRef.current;
    if (!root) return;
    // Diagnostický log – viditelný v DevTools, pomáhá odhalit případy,
    // kdy XChat HTML používá neočekávanou strukturu anchoru.
    // eslint-disable-next-line no-console
    console.debug('[xct] InfoStrip click', {
      href: link.getAttribute('href'),
      onclick: link.getAttribute('onclick'),
      text: link.textContent?.trim(),
      match: shouldOpenRoomDetails(link, root),
    });
    if (!shouldOpenRoomDetails(link, root)) return;
    e.preventDefault();
    e.stopPropagation();
    openRoomDetailsRef.current();
  };

  // Capture-phase native listener jako pojistka: kdyby React `onClick`
  // přišel až po defaultu (`javascript:` URL zkusí spustit `roominfo`,
  // to hodí ReferenceError, ale click event v tu chvíli už proběhl).
  useEffect(() => {
    const root = innerRef.current;
    if (!root) return;
    const onClickCapture = (e: Event): void => {
      const target = e.target as HTMLElement | null;
      if (!target || typeof target.closest !== 'function') return;
      const link = target.closest('a');
      if (!link) return;
      if (!shouldOpenRoomDetails(link, root)) return;
      e.preventDefault();
      e.stopPropagation();
      if ('stopImmediatePropagation' in e) {
        (e as Event & { stopImmediatePropagation: () => void }).stopImmediatePropagation();
      }
      openRoomDetailsRef.current();
    };
    root.addEventListener('click', onClickCapture, true);
    return () => root.removeEventListener('click', onClickCapture, true);
  }, [ctx.roomName]);

  const openOptions = (): void => {
    // Content script nemá `chrome.runtime.openOptionsPage`. Pošleme zprávu
    // service-workeru, který má plné `chrome.*` API.
    try {
      chrome.runtime.sendMessage({ type: 'XCT_OPEN_OPTIONS' });
    } catch {
      /* noop – extension context může být odpojený při reloadu */
    }
  };

  return (
    <div className="xct-infostrip">
      <div
        ref={innerRef}
        className="xct-infostrip__inner"
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <div className="xct-infostrip__controls">
        <div className="xct-infostrip__group xct-infostrip__group--filter" role="group" aria-label="Zobrazit zprávy">
          <span className="xct-infostrip__legend">Zobrazit:</span>
          {(
            [
              ['all', 'vše'],
              ['room', 'místnost'],
              ['whisper', 'šeptání'],
            ] as Array<[RoomOptions['messageFilter'], string]>
          ).map(([value, label]) => (
            <label key={value} className="xct-infostrip__opt">
              <input
                type="radio"
                name="xct-msg-filter"
                value={value}
                checked={messageFilter === value}
                onChange={() => onSetOption('messageFilter', value)}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <div className="xct-infostrip__group xct-infostrip__group--highlight" role="group" aria-label="Zvýraznění">
          <span className="xct-infostrip__legend">Zvýraznit:</span>
          <label className="xct-infostrip__opt">
            <input
              type="checkbox"
              checked={highlightMyNick}
              onChange={(e) => onSetOption('highlightMyNick', e.target.checked)}
            />
            <span>přezdívku</span>
          </label>
          <label className="xct-infostrip__opt">
            <input
              type="checkbox"
              checked={highlightWhispers}
              onChange={(e) => onSetOption('highlightWhispers', e.target.checked)}
            />
            <span>šeptání</span>
          </label>
        </div>
        <button
          type="button"
          className="xct-infostrip__settings"
          onClick={openOptions}
          title="Otevřít nastavení rozšíření v novém okně"
          aria-label="Nastavení"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            aria-hidden="true"
            focusable="false"
          >
            <path
              fill="currentColor"
              d="M19.14 12.94a7.49 7.49 0 0 0 0-1.88l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.03 7.03 0 0 0-1.62-.94l-.36-2.54a.5.5 0 0 0-.5-.42h-3.84a.5.5 0 0 0-.5.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 0 0-.6.22L2.67 8.84a.5.5 0 0 0 .12.64l2.03 1.58a7.49 7.49 0 0 0 0 1.88L2.79 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.14.24.43.34.69.24l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.26.42.5.42h3.84c.24 0 .45-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.26.1.55 0 .69-.24l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7Z"
            />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default InfoStrip;
