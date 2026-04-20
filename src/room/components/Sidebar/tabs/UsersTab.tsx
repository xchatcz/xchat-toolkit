/**
 * UsersTab – seznam uživatelů v místnosti.
 *
 * Rozdělený do tří sekcí:
 *   1) Aktivní (idle < 15 min)
 *   2) Neaktivní (idle ≥ 15 min)
 *   3) Oblíbení (VIP z Notes online mimo místnost)
 *
 * Layout jednoho řádku: [hvězda] [pohlaví] [nick …………] [(čas)]
 *
 * Ikonky bereme přímo z XChat CDN (ximg.cz), ať jsou vizuálně stejné
 * jako v původním klientovi. Klik na nick → whisper cíl v MessageForm.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useMemo } from 'react';
import type { FavouriteUser, RoomUser } from '../../../../api/types';
import { XCT_LOG } from '../../../../api/XChatApi';
import './UsersTab.scss';

export interface UsersTabProps {
  users: RoomUser[];
  favourites: FavouriteUser[];
  onSelectUser: (nick: string) => void;
}

const IDLE_THRESHOLD_SEC = 15 * 60;
const XCHAT_IMG = 'https://ximg.cz/x4';

/** Sekundy → `"HH:MM:SS"` (jak to ukazuje XChat v tabulce). */
const formatIdle = (sec: number): string => {
  if (!sec || sec < 0) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

/** URL hvězdičky (x1..x5). 0 = žádná. */
const starUrl = (star: number): string | null =>
  star >= 1 && star <= 5 ? `${XCHAT_IMG}/star/x${star}.gif` : null;

/** URL pohlaví: wn.gif / mn.gif (+ `_c` pro certifikované). */
const sexUrl = (sex: number, certified: boolean): string => {
  const base = sex === 1 ? 'wn' : 'mn';
  return `${XCHAT_IMG}/rm/${base}${certified ? '_c' : ''}.gif`;
};

const UsersTab = ({ users, favourites, onSelectUser }: UsersTabProps) => {
  // Online nicky v místnosti (case-insensitive) – pro filtraci VIP.
  const inRoomSet = useMemo(
    () => new Set(users.map((u) => u.nick.toLowerCase())),
    [users],
  );

  const { active, idle } = useMemo(() => {
    const cmp = (a: RoomUser, b: RoomUser) =>
      a.nick.localeCompare(b.nick, 'cs', { sensitivity: 'base' });
    return {
      active: users.filter((u) => (u.idleSeconds || 0) < IDLE_THRESHOLD_SEC).sort(cmp),
      idle: users.filter((u) => (u.idleSeconds || 0) >= IDLE_THRESHOLD_SEC).sort(cmp),
    };
  }, [users]);

  const vipOutside = useMemo(
    () =>
      favourites
        .filter((f) => f.vip && !inRoomSet.has(f.nick.toLowerCase()))
        .sort((a, b) =>
          a.nick.localeCompare(b.nick, 'cs', { sensitivity: 'base' }),
        ),
    [favourites, inRoomSet],
  );

  const renderUser = (u: RoomUser): JSX.Element => {
    const star = starUrl(u.star);
    return (
      <li key={u.nick} className="xct-users__item">
        <button
          type="button"
          className="xct-users__btn"
          onClick={() => {
            XCT_LOG.info('click uživatel →', u.nick, {
              sex: u.sex,
              cert: u.certified,
              star: u.star,
              idle: u.idleSeconds,
            });
            onSelectUser(u.nick);
          }}
          title={`Šeptat uživateli ${u.nick}`}
        >
          <span className="xct-users__ico xct-users__ico--star">
            {star ? <img src={star} alt="" width={11} height={10} /> : null}
          </span>
          <span className="xct-users__ico xct-users__ico--sex">
            <img
              src={sexUrl(u.sex, u.certified)}
              alt=""
              width={10}
              height={11}
            />
          </span>
          <span className="xct-users__nick">{u.nick}</span>
          {u.idleSeconds ? (
            <span className="xct-users__idle">({formatIdle(u.idleSeconds)})</span>
          ) : null}
        </button>
      </li>
    );
  };

  const renderFav = (f: FavouriteUser): JSX.Element => (
    <li key={`fav-${f.nick}`} className="xct-users__item xct-users__item--fav">
      <button
        type="button"
        className="xct-users__btn"
        onClick={() => onSelectUser(f.nick)}
        title={`Šeptat ${f.nick}`}
      >
        <span className="xct-users__ico xct-users__ico--star" />
        <span className="xct-users__ico xct-users__ico--sex" />
        <span className="xct-users__nick">{f.nick}</span>
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
