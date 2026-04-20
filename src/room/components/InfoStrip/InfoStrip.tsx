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

/** Sekundy → `HH:MM:SS` (vždy se stejnou šířkou, ať neskáče layout). */
const formatTime = (sec: number): string => {
  if (sec < 0) sec = 0;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

const TIME_RE = /\b(\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2})\b/;

/**
 * Po každé aktualizaci `html` najdeme textové uzly obsahující časový údaj
 * a obalíme je do `<span data-xct-tick="up|down">`. Směr detekujeme podle
 * textu uvnitř stejného blokového rodiče (buňka tabulky / div / td).
 */
const annotateTickers = (root: HTMLElement): void => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) =>
      TIME_RE.test(n.nodeValue ?? '')
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

    // Kontext = text blokového rodiče (tr/td/div), kam spadá textový uzel.
    const block =
      parent.closest('td, th, li, p, div, span') ?? parent;
    const ctxTxt = (block.textContent ?? '').toLowerCase();
    let dir: 'up' | 'down' | null = null;
    if (ctxTxt.includes('nemluvil')) dir = 'up';
    else if (ctxTxt.includes('obnov')) dir = 'down';
    if (!dir) continue;

    const match = (text.nodeValue ?? '').match(TIME_RE);
    if (!match) continue;
    const raw = match[0];
    const before = (text.nodeValue ?? '').slice(0, match.index ?? 0);
    const after = (text.nodeValue ?? '').slice((match.index ?? 0) + raw.length);

    const span = document.createElement('span');
    span.setAttribute('data-xct-tick', dir);
    span.setAttribute('data-xct-seconds', String(parseTime(raw)));
    span.textContent = formatTime(parseTime(raw));

    const frag = document.createDocumentFragment();
    if (before) frag.appendChild(document.createTextNode(before));
    frag.appendChild(span);
    if (after) frag.appendChild(document.createTextNode(after));
    text.replaceWith(frag);
  }
};

/** Tikne všechny `[data-xct-tick]` uvnitř `root` o ±1 s. */
const tickAll = (root: HTMLElement): void => {
  const spans = root.querySelectorAll<HTMLSpanElement>('[data-xct-tick]');
  spans.forEach((sp) => {
    const dir = sp.getAttribute('data-xct-tick');
    const cur = Number(sp.getAttribute('data-xct-seconds') ?? '0');
    const next = dir === 'up' ? cur + 1 : Math.max(0, cur - 1);
    sp.setAttribute('data-xct-seconds', String(next));
    sp.textContent = formatTime(next);
  });
};

const InfoStrip = ({ ctx, userCount, onOpenOverlay }: InfoStripProps) => {
  const [html, setHtml] = useState<string>('');
  const innerRef = useRef<HTMLDivElement>(null);
  // Drží nejnovější `onOpenOverlay` / props, aby si delegovaný handler
  // vždy četl aktuální hodnoty, i když se komponenta rerenderne.
  const propsRef = useRef({ ctx, userCount, onOpenOverlay });
  propsRef.current = { ctx, userCount, onOpenOverlay };

  // Fetch HTML každých 15 s (XChat stejně rychleji neaktualizuje).
  useEffect(() => {
    const stop = requestQue.every(
      15_000,
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
  }, [ctx.xhash, ctx.rid, ctx.skin, ctx.roomName]);

  // Po každém setHtml si najdeme časové údaje a obalíme je do tikajících
  // spanů. Timer tiká po 1 s, dokud HTML nepřijde nové.
  useEffect(() => {
    const root = innerRef.current;
    if (!root) return;
    annotateTickers(root);
    const id = window.setInterval(() => tickAll(root), 1000);
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

  return (
    <div className="xct-infostrip">
      <div
        ref={innerRef}
        className="xct-infostrip__inner"
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};

export default InfoStrip;
