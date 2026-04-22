/**
 * AdminsOnlineTab – „Pomoc online" vyvolaná z UserMenu.
 *
 * Zdroj dat: `modchat?op=onlinehelppage` (parsované XChatem vracené HTML)
 * + `RoomDetail` pro zjištění aktuálního správce místnosti.
 *
 * Tři sekce shora dolů:
 *   1) „Správce místnosti" – aktuální (dočasný) správce, **jen pokud je
 *      v místnosti právě online** (lookup do `users` z RoomStore).
 *   2) „Stálí správci"     – sekce `<p class="nadpis1">Stálí správci</p>`.
 *   3) „Administrátoři"    – sekce `<p class="nadpis1">Administrátoři</p>`.
 *
 * Vizuál je stejný jako v UsersTab – používáme přímo CSS `.xct-users__*`.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useEffect, useMemo, useState } from 'react';
import XChatApi from '../../../../api/XChatApi';
import type {
  OnlineHelpPage,
  OnlineHelpUser,
  RoomContext,
  RoomUser,
} from '../../../../api/types';
import { toast } from '../../../../core/toast';
import { useRoomStore } from '../../../hooks/useRoomStore';
import {
  sexTitle,
  sexUrl,
  starTitle,
  starUrl,
} from '../../../utils/xchatIcons';
import './UsersTab.scss';

export interface AdminsOnlineTabProps {
  ctx: RoomContext;
  onSelectUser: (nick: string) => void;
}

/** Převede `RoomUser` na řádkový tvar sdílený s `OnlineHelpUser`. */
const fromRoomUser = (u: RoomUser): OnlineHelpUser => ({
  nick: u.nick,
  star: u.star,
  sex: u.sex,
  certified: u.certified,
});

const AdminsOnlineTab = ({ ctx, onSelectUser }: AdminsOnlineTabProps) => {
  const { users } = useRoomStore();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OnlineHelpPage | null>(null);
  const [roomAdminNick, setRoomAdminNick] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [detail, page] = await Promise.all([
          XChatApi.getRoomDetail(ctx.rid),
          XChatApi.getOnlineHelp(ctx.xhash, ctx.rid, ctx.skin),
        ]);
        if (cancelled) return;
        setRoomAdminNick(detail?.admin?.trim() || null);
        setData(page);
      } catch (err) {
        if (!cancelled) {
          toast.error(`Nepodařilo se načíst Pomoc online: ${String(err)}`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx.rid, ctx.xhash, ctx.skin]);

  // Správce místnosti – najdeme ho mezi online uživateli místnosti (case-ins).
  const roomAdmin = useMemo<OnlineHelpUser | null>(() => {
    if (!roomAdminNick) return null;
    const needle = roomAdminNick.toLowerCase();
    const found = users.find((u) => u.nick.toLowerCase() === needle);
    return found ? fromRoomUser(found) : null;
  }, [roomAdminNick, users]);

  const renderRow = (u: OnlineHelpUser): JSX.Element => (
    <li
      key={u.nick}
      className={`xct-users__item xct-users__item--sex-${u.sex}`}
    >
      <button
        type="button"
        className="xct-users__btn"
        onClick={() => onSelectUser(u.nick)}
      >
        <span
          className="xct-users__ico xct-users__ico--star"
          title={starTitle(u.star)}
        >
          <img src={starUrl(u.star)} alt="" width={11} height={10} />
        </span>
        <span
          className="xct-users__ico xct-users__ico--sex"
          title={sexTitle(u.sex, u.certified)}
        >
          <img
            src={sexUrl(u.sex, u.certified)}
            alt=""
            width={10}
            height={11}
          />
        </span>
        <span className="xct-users__nick">{u.nick}</span>
      </button>
    </li>
  );

  if (loading) {
    return (
      <div className="xct-users">
        <div className="xct-tab-empty">Načítám…</div>
      </div>
    );
  }

  const permanent = data?.permanent ?? [];
  const admins = data?.admins ?? [];
  const isEmpty = !roomAdmin && permanent.length === 0 && admins.length === 0;

  return (
    <div className="xct-users">
      {roomAdmin ? (
        <>
          <h4 className="xct-users__group">
            <span className="xct-users__group-name">Správce místnosti</span>
          </h4>
          <ul className="xct-users__list">{renderRow(roomAdmin)}</ul>
        </>
      ) : null}

      {permanent.length > 0 ? (
        <>
          <h4 className="xct-users__group">
            <span className="xct-users__group-name">
              Stálí správci ({permanent.length})
            </span>
          </h4>
          <ul className="xct-users__list">{permanent.map(renderRow)}</ul>
        </>
      ) : null}

      {admins.length > 0 ? (
        <>
          <h4 className="xct-users__group">
            <span className="xct-users__group-name">
              Administrátoři ({admins.length})
            </span>
          </h4>
          <ul className="xct-users__list">{admins.map(renderRow)}</ul>
        </>
      ) : null}

      {isEmpty ? (
        <div className="xct-tab-empty">
          Právě není online žádný správce ani administrátor.
        </div>
      ) : null}
    </div>
  );
};

export default AdminsOnlineTab;
