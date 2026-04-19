/**
 * MessageBoard – hlavní výpis zpráv.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useEffect, useRef } from 'react';
import { useRoomStore } from '../../hooks/useRoomStore';
import type { RoomMessage } from '../../../api/types';
import './MessageBoard.scss';

const MessageBoard = () => {
  const { messages } = useRoomStore();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className="xct-board" ref={scrollRef}>
      {messages.length === 0 ? (
        <div className="xct-board__empty">Žádné zprávy.</div>
      ) : (
        messages.map((m, i) => <MessageItem key={`${m.time}-${i}`} msg={m} />)
      )}
    </div>
  );
};

const MessageItem = ({ msg }: { msg: RoomMessage }) => (
  <div className={`xct-msg xct-msg--${msg.kind}`}>
    {msg.time ? <span className="xct-msg__time">{msg.time}</span> : null}
    {msg.nick ? <span className="xct-msg__nick">{msg.nick}</span> : null}
    <span className="xct-msg__text" dangerouslySetInnerHTML={{ __html: msg.html }} />
  </div>
);

export default MessageBoard;
