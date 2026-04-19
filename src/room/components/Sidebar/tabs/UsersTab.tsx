/**
 * UsersTab – seznam uživatelů v místnosti.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useEffect, useState } from 'react';
import type { RoomContext, RoomUser } from '../../../../api/types';
import { XChatHttp, XChatUrls } from '../../../../api/XChatApi';
import { requestQue } from '../../../services/RequestQue';

export interface UsersTabProps {
  ctx: RoomContext;
}

const UsersTab = ({ ctx }: UsersTabProps) => {
  const [users, setUsers] = useState<RoomUser[]>([]);

  useEffect(() => {
    const stop = requestQue.every(
      10_000,
      async () => {
        // TODO: plnohodnotný parser userspage. Zatím jen fetch + placeholder.
        await XChatHttp.fetchDocument(
          XChatUrls.roomUsersPage(ctx.xhash, ctx.rid, ctx.cid, ctx.skin),
        );
        setUsers([]);
      },
      'room-users',
    );
    return stop;
  }, [ctx.xhash, ctx.rid, ctx.cid, ctx.skin]);

  if (users.length === 0) return <div className="xct-tab-empty">Načítám uživatele…</div>;
  return (
    <ul className="xct-users">
      {users.map((u) => (
        <li key={u.nick}>{u.nick}</li>
      ))}
    </ul>
  );
};

export default UsersTab;
