/**
 * UsersTab – seznam uživatelů v místnosti.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useEffect, useState } from 'react';
import type { RoomContext, RoomUser } from '../../../../api/types';
import { XChatApi } from '../../../../api/XChatApi';
import { requestQue } from '../../../services/RequestQue';

export interface UsersTabProps {
  ctx: RoomContext;
}

const UsersTab = ({ ctx }: UsersTabProps) => {
  const [users, setUsers] = useState<RoomUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const stop = requestQue.every(
      10_000,
      async () => {
        try {
          const list = await XChatApi.getRoomUsers(ctx.xhash, ctx.rid, ctx.cid, ctx.skin);
          if (!active) return;
          setUsers(list);
          setError(null);
        } catch (err) {
          if (!active) return;
          setError(String((err as Error).message ?? err));
        }
      },
      'room-users',
    );
    return () => {
      active = false;
      stop();
    };
  }, [ctx.xhash, ctx.rid, ctx.cid, ctx.skin]);

  if (error) return <div className="xct-tab-empty xct-tab-empty--error">{error}</div>;
  if (users === null) return <div className="xct-tab-empty">Načítám uživatele…</div>;
  if (users.length === 0) return <div className="xct-tab-empty">Nikdo zde není.</div>;

  return (
    <ul className="xct-users">
      {users.map((u) => (
        <li key={u.nick} className="xct-users__item">
          {u.avatarUrl ? (
            <img className="xct-users__avatar" src={u.avatarUrl} alt="" width={24} height={24} />
          ) : null}
          <span className="xct-users__nick">{u.nick}</span>
        </li>
      ))}
    </ul>
  );
};

export default UsersTab;
