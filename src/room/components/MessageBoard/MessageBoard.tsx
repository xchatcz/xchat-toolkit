/**
 * MessageBoard – hlavní výpis zpráv.
 *
 * XChat vrací zprávy v pořadí **nejnovější nahoře**. Podle nastavení
 * `messageOrder` je buď ponecháme tak, nebo je obrátíme (nejnovější dole).
 * Auto-scroll směřuje vždy na okraj, kde leží nejčerstvější zpráva.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useEffect, useMemo, useRef } from 'react';
import { useRoomStore } from '../../hooks/useRoomStore';
import type { RoomMessage } from '../../../api/types';
import './MessageBoard.scss';

export interface MessageBoardProps {
  /** Pořadí zpráv – ovlivňuje render i směr auto-scrollu. */
  order: 'newest-first' | 'newest-last';
  /** Můj nick – pro highlight v příchozích zprávách. */
  myNick: string;
  /** Zvýrazňovat šeptané zprávy pozadím + proužkem. */
  highlightWhispers: boolean;
  /** Zvýrazňovat můj nick žlutě ve všech příchozích zprávách. */
  highlightMyNick: boolean;  /** Zvýraznit hlášky o vyhození z místnosti červenou barvou. */
  highlightKick: boolean;  /** Skrýt systémové hlášky „Špatný příkaz" úplně z výpisu. */
  hideBadCommand: boolean;
}

/** Escaping speciálních znaků pro regex (jméno uživatele). */
const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Obalí výskyty nicku `myNick` v HTML žlutou značkou. Respektuje HTML tagy
 * a `&entity;` (nezasahuje dovnitř).
 */
const highlightNickInHtml = (html: string, myNick: string): string => {
  if (!myNick) return html;
  const re = new RegExp(
    `(^|[^\\p{L}\\p{N}_])(${escapeRegex(myNick)})(?=[^\\p{L}\\p{N}_]|$)`,
    'giu',
  );
  // Nahradíme jen v textových úsecích – rozdělíme podle tagů/entit.
  const parts = html.split(/(<[^>]+>|&[^;\s]+;)/g);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p || p[0] === '<' || (p[0] === '&' && p.endsWith(';'))) continue;
    parts[i] = p.replace(re, '$1<mark class="xct-msg__hl">$2</mark>');
  }
  return parts.join('');
};

const MessageBoard = ({
  order,
  myNick,
  highlightWhispers,
  highlightMyNick,
  highlightKick,
  hideBadCommand,
}: MessageBoardProps) => {
  const { messages, lastUpdatedAt } = useRoomStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  // Udržujeme si, jestli uživatel sedí u okraje, kde přibývají nové zprávy.
  // Aktualizujeme při každém scrollu; při obnově zpráv rozhodne tenhle flag,
  // jestli dojedeme na čerstvý okraj, nebo necháme pozici být.
  const stickToEdgeRef = useRef(true);

  const display = useMemo(() => {
    const filtered = hideBadCommand
      ? messages.filter((m) => !m.isBadCommand)
      : messages;
    return order === 'newest-last' ? [...filtered].reverse() : filtered;
  }, [messages, order, hideBadCommand]);

  const EDGE_PX = 24; // tolerance – jemné posunutí nepovažujeme za „odscrollovaný"

  const handleScroll = (): void => {
    const el = scrollRef.current;
    if (!el) return;
    if (order === 'newest-last') {
      const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
      stickToEdgeRef.current = distanceFromBottom <= EDGE_PX;
    } else {
      stickToEdgeRef.current = el.scrollTop <= EDGE_PX;
    }
  };

  // Obnova zpráv: skoč na okraj jen pokud tam uživatel sedí, jinak pozici nech.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!stickToEdgeRef.current) return;
    el.scrollTop = order === 'newest-last' ? el.scrollHeight : 0;
  }, [lastUpdatedAt]);

  // Změna pořadí (z Options) – vždy skoč na čerstvý okraj a resetuj stick.
  useEffect(() => {
    stickToEdgeRef.current = true;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = order === 'newest-last' ? el.scrollHeight : 0;
  }, [order]);

  const boardClass =
    'xct-board' +
    (highlightWhispers ? ' xct-board--hl-whispers' : '') +
    (highlightMyNick ? ' xct-board--hl-mynick' : '') +
    (highlightKick ? ' xct-board--hl-kick' : '');

  return (
    <div className={boardClass} ref={scrollRef} onScroll={handleScroll}>
      {display.length === 0 ? (
        <div className="xct-board__empty">Žádné zprávy.</div>
      ) : (
        display.map((m) => (
          <MessageItem
            key={m.id}
            msg={m}
            myNick={myNick}
            highlightMyNick={highlightMyNick}
          />
        ))
      )}
    </div>
  );
};

interface MessageItemProps {
  msg: RoomMessage;
  myNick: string;
  highlightMyNick: boolean;
}

const MessageItem = ({ msg, myNick, highlightMyNick }: MessageItemProps) => {
  // Modifikátory pro barvení / výrazné styly přímo na řádku zprávy.
  const mods: string[] = [`xct-msg--${msg.kind}`];
  if (msg.outgoing) mods.push('xct-msg--out');
  if (msg.kind === 'system' && msg.systemEvent) {
    mods.push(`xct-msg--sys-${msg.systemEvent}`);
  }
  if (msg.isSelfKickAttempt) mods.push('xct-msg--kick-attempt');
  if (msg.isBadCommand) mods.push('xct-msg--bad-cmd');
  if (msg.kind === 'advert') mods.push('xct-msg--advert');

  // Advert má vynucenou barvu #aa0088 přes CSS – inline `msg.color` od XChatu
  // u reklamy ignorujeme. Ostatní typy berou barvu z atributu `color`.
  const style =
    msg.color && msg.kind !== 'advert' ? { color: msg.color } : undefined;

  // Highlight mého nicku – jen u příchozích non-system/non-advert zpráv.
  const canHl =
    highlightMyNick &&
    !!myNick &&
    !msg.outgoing &&
    msg.kind !== 'system' &&
    msg.kind !== 'advert';
  const bodyHtml = canHl ? highlightNickInHtml(msg.html, myNick) : msg.html;

  return (
    <div className={`xct-msg ${mods.join(' ')}`} style={style}>
      {msg.time ? <span className="xct-msg__time">{msg.time}</span> : null}
      <div className="xct-msg__body">
        {msg.nick ? (
          <span className="xct-msg__nick">
            {msg.nick}
            {msg.targetNick ? <span className="xct-msg__target">-&gt;{msg.targetNick}</span> : null}
            {': '}
          </span>
        ) : null}
        <span className="xct-msg__text" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      </div>
    </div>
  );
};

export default MessageBoard;

