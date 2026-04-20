/**
 * UsersTab – seznam uživatelů v místnosti.
 *
 * Rozdělený do tří sekcí:
 *   1) Aktivní (idle < 15 min)
 *   2) Neaktivní (idle ≥ 15 min)
 *   3) Oblíbení (VIP z Notes online mimo místnost)
 *
 * Klik na nick → předáno nadřazené komponentě jako pending whisper cíl
 * pro {@link MessageForm}.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useMemo } from 'react';
import type { FavouriteUser, RoomUser } from '../../../../api/types';
import { XCT_LOG } from '../../../../api/XChatApi';
import { CrownIcon, FemaleIcon, MaleIcon, StarIcon } from '../../../icons/IconPalette';
import './UsersTab.scss';

export interface UsersTabProps {
  users: RoomUser[];
  favourites: FavouriteUser[];
  onSelectUser: (nick: string) => void;
}

const IDLE_THRESHOLD_SEC = 15 * 60;

/** Formátuje idle v minutách – `"(42m)"` nebo `"(2h)"`. */
const formatIdle = (sec: number): string => {
  if (!sec || sec < 60) return '';
  if (sec < 3600) return `(${Math.floor(sec / 60)}m)`;
  return `(${Math.floor(sec / 3600)}h)`;
};

const UsersTab = ({ users, favourites, onSelectUser }: UsersTabProps) => {
  // Online nicky v místnosti (case-insensitive) – pro filtraci VIP.
  const inRoomSet = useMemo(
    () => new Set(users.map((u) => u.nick.toLowerCase())),
    [users],
  );

  const { active, idle } = useMemo(() => {
    const cmp = (a: RoomUser, b: RoomUser) => a.nick.localeCompare(b.nick, 'cs');
    return {
      active: users.filter((u) => (u.idleSeconds || 0) < IDLE_THRESHOLD_SEC).sort(cmp),
      idle: users.filter((u) => (u.idleSeconds || 0) >= IDLE_THRESHOLD_SEC).sort(cmp),
    };
  }, [users]);

  const vipOutside = useMemo(
    () =>
      favourites
        .filter((f) => f.vip && !inRoomSet.has(f.nick.toLowerCase()))
        .sort((a, b) => a.nick.localeCompare(b.nick, 'cs')),
    [favourites, inRoomSet],
  );

  const renderUser = (u: RoomUser): JSX.Element => (
    <li key={u.nick} className="xct-users__item">
      <button
        type="button"
        className="xct-users__btn"
        onClick={() => {
          XCT_LOG.info('click uživatel →', u.nick);
          onSelectUser(u.nick);
        }}
        title={`Šeptat uživateli ${u.nick}`}
      >
        {u.avatarUrl ? (
          <img
            className="xct-users__avatar"
            src={u.avatarUrl}
            alt=""
            width={24}
            height={24}
          />
        ) : (
          <span className="xct-users__avatar xct-users__avatar--placeholder" />
        )}
        <span className="xct-users__nick">{u.nick}</span>
        {u.star > 0 ? (
          <StarIcon
            className={`xct-users__star xct-users__star--${u.star}`}
            width={12}
            height={12}
          />
        ) : null}
        {u.sex === 1 ? (
          <FemaleIcon className="xct-users__sex xct-users__sex--f" width={12} height={12} />
        ) : (
          <MaleIcon className="xct-users__sex xct-users__sex--m" width={12} height={12} />
        )}
        {u.idleSeconds ? (
          <span className="xct-users__idle">{formatIdle(u.idleSeconds)}</span>
        ) : null}
      </button>
    </li>
  );

  const renderFav = (f: FavouriteUser): JSX.Element => (
    <li key={`fav-${f.nick}`} className="xct-users__item xct-users__item--fav">
      <button
        type="button"
        className="xct-users__btn"
        onClick={() => onSelectUser(f.nick)}
        title={`Šeptat ${f.nick}`}
      >
        <span className="xct-users__avatar xct-users__avatar--placeholder" />
        <span className="xct-users__nick">{f.nick}</span>
        <CrownIcon className="xct-users__vip" width={12} height={12} />
      </button>
    </li>
  );

  return (
    <div className="xct-users">
      {active.length > 0 ? (
        <>
          <h4 className="xct-users__group">Aktivní ({active.length})</h4>
          <ul className="xct-users__list">{active.map(renderUser)}</ul>
        </>
      ) : null}
      {idle.length > 0 ? (
        <>
          <h4 className="xct-users__group">Neaktivní ({idle.length})</h4>
          <ul className="xct-users__list">{idle.map(renderUser)}</ul>
        </>
      ) : null}
      {vipOutside.length > 0 ? (
        <>
          <h4 className="xct-users__group">Oblíbení ({vipOutside.length})</h4>
          <ul className="xct-users__list">{vipOutside.map(renderFav)}</ul>
        </>
      ) : null}
      {active.length === 0 && idle.length === 0 && vipOutside.length === 0 ? (
        <div className="xct-tab-empty">Nikdo zde není.</div>
      ) : null}
    </div>
  );
};

export default UsersTab;
