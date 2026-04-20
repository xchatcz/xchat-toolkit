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

  // Pokud chce uživatel „nejnovější dole", obrátíme pole.
  const display = useMemo(
    () => (order === 'newest-last' ? [...messages].reverse() : messages),
    [messages, order],
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = order === 'newest-last' ? el.scrollHeight : 0;
  }, [order, lastUpdatedAt]);

  return (
    <div className="xct-board" ref={scrollRef}>
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
    {msg.nick ? (
      <span className="xct-msg__nick">
        {msg.nick}
        {msg.targetNick ? <span className="xct-msg__target">→{msg.targetNick}</span> : null}
        {':'}
      </span>
    ) : null}
    <span className="xct-msg__text" dangerouslySetInnerHTML={{ __html: msg.html }} />
  </div>
);

export default MessageBoard;
