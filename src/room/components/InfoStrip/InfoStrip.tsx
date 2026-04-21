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

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import type { RoomContext } from '../../../api/types';
import type { RoomOptions } from '../../../features/Room/RoomApp';
import { XChatHttp, XChatUrls } from '../../../api/XChatApi';
import { requestQue } from '../../services/RequestQue';
import RoomDetailsPanel from '../RoomDetailsPanel/RoomDetailsPanel';
import './InfoStrip.scss';

export interface InfoStripProps {
  ctx: RoomContext;
  /** Aktuální počet uživatelů (zobrazí se v overlay). */
  userCount: number;
  /** Otevření overlay nad MessageBoard (řídí App.tsx). */
  onOpenOverlay: (title: string, body: ReactNode) => void;
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

/** Z `href="javascript:roominfo(123)"` vytáhne číslo (nebo null). */
const parseRoominfoHref = (href: string | null): number | null => {
  if (!href) return null;
  const m = href.match(/roominfo\((\d+)\)/i);
  return m ? Number(m[1]) : null;
};

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
  userCount,
  onOpenOverlay,
  onIdleSecondsChange,
  messageFilter,
  highlightMyNick,
  highlightWhispers,
  refreshIntervalSec,
  onSetOption,
}: InfoStripProps) => {
  const [html, setHtml] = useState<string>('');
  const innerRef = useRef<HTMLDivElement>(null);
  // Drží nejnovější `onOpenOverlay` / props, aby si delegovaný handler
  // vždy četl aktuální hodnoty, i když se komponenta rerenderne.
  const propsRef = useRef({ ctx, userCount, onOpenOverlay });
  propsRef.current = { ctx, userCount, onOpenOverlay };
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
        setHtml(body);
      },
      'room-info',
    );
    return stop;
  }, [ctx.xhash, ctx.rid, ctx.skin, ctx.roomName, refreshIntervalSec]);

  // Po každém setHtml si najdeme časové údaje a obalíme je do tikajících
  // spanů. Timer tiká po 1 s, dokud HTML nepřijde nové.
  useEffect(() => {
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

  // Event delegace – klik na <a href="javascript:roominfo(…)"> otevře overlay.
  const handleClick = (e: MouseEvent<HTMLDivElement>): void => {
    const link = (e.target as HTMLElement).closest('a');
    if (!link) return;
    const rid = parseRoominfoHref(link.getAttribute('href'));
    if (rid == null) return;
    e.preventDefault();
    e.stopPropagation();
    const { ctx: c, userCount: uc, onOpenOverlay: open } = propsRef.current;
    open(
      `Informace o místnosti: ${c.roomName}`,
      <RoomDetailsPanel ctx={c} userCount={uc} />,
    );
  };

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
        <div className="xct-infostrip__group" role="group" aria-label="Zobrazit zprávy">
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
        <div className="xct-infostrip__group" role="group" aria-label="Zvýraznění">
          <span className="xct-infostrip__legend">Zvýraznit:</span>
          <label className="xct-infostrip__opt">
            <input
              type="checkbox"
              checked={highlightMyNick}
              onChange={(e) => onSetOption('highlightMyNick', e.target.checked)}
            />
            <span>můj nick</span>
          </label>
          <label className="xct-infostrip__opt">
            <input
              type="checkbox"
              checked={highlightWhispers}
              onChange={(e) => onSetOption('highlightWhispers', e.target.checked)}
            />
            <span>šeptání pozadím</span>
          </label>
        </div>
        <button
          type="button"
          className="xct-infostrip__settings"
          onClick={openOptions}
          title="Otevřít nastavení rozšíření v novém okně"
        >
          Nastavení
        </button>
      </div>
    </div>
  );
};

export default InfoStrip;
