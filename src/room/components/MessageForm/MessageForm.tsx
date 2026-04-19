/**
 * MessageForm – textový řádek pro odeslání zprávy do místnosti.
 *
 * Forma posílá přímo na XChat `op=textpageng` endpoint přes background
 * proxy. Cíl („Všem" nebo konkrétní uživatel) volíme v dropdownu.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useState } from 'react';
import type { RoomContext } from '../../../api/types';
import { XChatHttp, XChatUrls } from '../../../api/XChatApi';
import { SendIcon } from '../../icons/IconPalette';
import { requestQue } from '../../services/RequestQue';
import './MessageForm.scss';

export interface MessageFormProps {
  ctx: RoomContext;
}

const MessageForm = ({ ctx }: MessageFormProps) => {
  const [text, setText] = useState('');
  const [target, setTarget] = useState<string>(''); // '' = všem
  const [busy, setBusy] = useState(false);

  const send = async (): Promise<void> => {
    const msg = text.trim();
    if (!msg) return;
    setBusy(true);
    try {
      const body = new URLSearchParams();
      body.set('op', 'text');
      body.set('rid', String(ctx.rid));
      body.set('skin', String(ctx.skin));
      body.set('js', '0');
      body.set('text', msg);
      if (target) body.set('wto', target);
      const url = XChatUrls.roomTextPage(ctx.xhash, ctx.rid, ctx.skin);
      await requestQue.enqueue(
        () =>
          XChatHttp.fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body.toString(),
          }),
        'send-message',
      );
      setText('');
    } finally {
      setBusy(false);
    }
  };

  const onSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    void send();
  };

  return (
    <form className="xct-form" onSubmit={onSubmit}>
      <label className="xct-form__label">{ctx.myNick}:</label>
      <select
        className="xct-form__target"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        aria-label="Cíl zprávy"
      >
        <option value="">Všem</option>
      </select>
      <input
        type="text"
        className="xct-form__input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Napsat zprávu…"
        disabled={busy}
      />
      <button type="submit" className="xct-form__send" disabled={busy || !text.trim()}>
        <SendIcon width={16} height={16} />
      </button>
    </form>
  );
};

export default MessageForm;
