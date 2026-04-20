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
}

const MessageBoard = ({ order }: MessageBoardProps) => {
  const { messages, lastUpdatedAt } = useRoomStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  // Udržujeme si, jestli uživatel sedí u okraje, kde přibývají nové zprávy.
  // Aktualizujeme při každém scrollu; při obnově zpráv rozhodne tenhle flag,
  // jestli dojedeme na čerstvý okraj, nebo necháme pozici být.
  const stickToEdgeRef = useRef(true);

  // Pokud chce uživatel „nejnovější dole", obrátíme pole.
  const display = useMemo(
    () => (order === 'newest-last' ? [...messages].reverse() : messages),
    [messages, order],
  );

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

  return (
    <div className="xct-board" ref={scrollRef} onScroll={handleScroll}>
      {display.length === 0 ? (
        <div className="xct-board__empty">Žádné zprávy.</div>
      ) : (
        display.map((m) => <MessageItem key={m.id} msg={m} />)
      )}
    </div>
  );
};

const MessageItem = ({ msg }: { msg: RoomMessage }) => (
  <div
    className={`xct-msg xct-msg--${msg.kind}${msg.outgoing ? ' xct-msg--out' : ''}`}
    style={msg.color ? { color: msg.color } : undefined}
  >
    {msg.time ? <span className="xct-msg__time">{msg.time}</span> : null}
    <div className="xct-msg__body">
      {msg.nick ? (
        <span className="xct-msg__nick">
          {msg.nick}
          {msg.targetNick ? <span className="xct-msg__target">-&gt;{msg.targetNick}</span> : null}
          {': '}
        </span>
      ) : null}
      <span className="xct-msg__text" dangerouslySetInnerHTML={{ __html: msg.html }} />
    </div>
  </div>
);

export default MessageBoard;
