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
  /** Nicky, které právě vstoupily do místnosti – mají pulsovat. */
  recentJoiners: string[];
  onSelectUser: (nick: string) => void;
}

const IDLE_THRESHOLD_SEC = 15 * 60;
const XCHAT_IMG = 'https://ximg.cz/x4';

/**
 * XChat ikonky – přesný seznam URL (hodnoty podle bitových flagů, které
 * používá XChat v parametru `x{N}` v URL GIFu).
 */
const ICONS = {
  star: {
    none: `${XCHAT_IMG}/star/x0.gif`,
    black: `${XCHAT_IMG}/star/x1.gif`,
    blue: `${XCHAT_IMG}/star/x2.gif`,
    green: `${XCHAT_IMG}/star/x4.gif`,
    yellow: `${XCHAT_IMG}/star/x8.gif`,
    red: `${XCHAT_IMG}/star/x16.gif`,
  },
  sex: {
    male: `${XCHAT_IMG}/rm/mn.gif`,
    female: `${XCHAT_IMG}/rm/wn.gif`,
    maleCert: `${XCHAT_IMG}/rm/mn_c.gif`,
    femaleCert: `${XCHAT_IMG}/rm/wn_c.gif`,
  },
} as const;

/** URL hvězdičky podle číselného flagu z XChatu. 0 = prázdný pixel. */
const starUrl = (star: number): string => {
  switch (star) {
    case 1: return ICONS.star.black;
    case 2: return ICONS.star.blue;
    case 4: return ICONS.star.green;
    case 8: return ICONS.star.yellow;
    case 16: return ICONS.star.red;
    default: return ICONS.star.none;
  }
};

/** Popisek hvězdičky podle barvy – zobrazí se jako title nad ikonkou. */
const starTitle = (star: number): string => {
  switch (star) {
    case 1: return 'VIP uživatel';
    case 2: return 'Premium uživatel';
    case 4: return 'Administrátor ve zkušební době';
    case 8: return 'Administrátor';
    case 16: return 'Administrátor – Vedení XChat týmu';
    default: return '';
  }
};

/** URL pohlaví: certifikovaná verze má `_c`. */
const sexUrl = (sex: number, certified: boolean): string => {
  if (sex === 1) return certified ? ICONS.sex.femaleCert : ICONS.sex.female;
  return certified ? ICONS.sex.maleCert : ICONS.sex.male;
};

/** Popisek pohlaví – zobrazí se jako title nad ikonkou. */
const sexTitle = (sex: number, certified: boolean): string => {
  if (sex === 1) return certified ? 'Certifikovaná žena' : 'Žena';
  return certified ? 'Certifikovaný muž' : 'Muž';
};

/**
 * Sekundy → `"MM:SS"`. Minuty mohou být klidně > 60 (XChat v naší tabulce
 * zobrazuje „jak dlouho nemluvil", klidně hodiny → vypíšeme `120:05`).
 */
const formatIdle = (sec: number): string => {
  if (!sec || sec < 0) return '';
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));
  return `${pad(m)}:${pad(s)}`;
};

const UsersTab = ({ users, favourites, recentJoiners, onSelectUser }: UsersTabProps) => {
  // Online nicky v místnosti (case-insensitive) – pro filtraci VIP.
  const inRoomSet = useMemo(
    () => new Set(users.map((u) => u.nick.toLowerCase())),
    [users],
  );

  // Nicky, které mají pulsovat (case-insensitive lookup).
  const pulsingSet = useMemo(
    () => new Set(recentJoiners.map((n) => n.toLowerCase())),
    [recentJoiners],
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

  const renderUser = (u: RoomUser, opts: { idle: boolean }): JSX.Element => {
    const isPulsing = pulsingSet.has(u.nick.toLowerCase());
    return (
      <li
        key={u.nick}
        className={
          'xct-users__item' +
          ` xct-users__item--sex-${u.sex}` +
          (opts.idle ? ' xct-users__item--idle' : '') +
          (isPulsing ? ' xct-users__item--pulse' : '')
        }
      >
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
      >
        <span className="xct-users__ico xct-users__ico--star">
          <img src={ICONS.star.none} alt="" width={11} height={10} />
        </span>
        <span className="xct-users__ico xct-users__ico--sex" />
        <span className="xct-users__nick">{f.nick}</span>
      </button>
    </li>
  );

  return (
    <div className="xct-users">
      {active.length > 0 ? (
        <>
          <h4 className="xct-users__group">
            <span className="xct-users__group-name">Aktivní ({active.length})</span>
            <span className="xct-users__group-colhead">Nepromluvili</span>
          </h4>
          <ul className="xct-users__list">
            {active.map((u) => renderUser(u, { idle: false }))}
          </ul>
        </>
      ) : null}
      {idle.length > 0 ? (
        <>
          <h4 className="xct-users__group">
            <span className="xct-users__group-name">Neaktivní ({idle.length})</span>
            <span className="xct-users__group-colhead">Nepromluvili</span>
          </h4>
          <ul className="xct-users__list">
            {idle.map((u) => renderUser(u, { idle: true }))}
          </ul>
        </>
      ) : null}
      {vipOutside.length > 0 ? (
        <>
          <h4 className="xct-users__group">
            <span className="xct-users__group-name">Oblíbení ({vipOutside.length})</span>
          </h4>
          <ul className="xct-users__list">{vipOutside.map(renderFav)}</ul>
        </>
      ) : null}
      {active.length === 0 && idle.length === 0 && vipOutside.length === 0 ? (
        <div className="xct-tab-empty">Nikdo zde není.</div>
      ) : null}

      <div className="xct-users__legend">
        <h4 className="xct-users__group">Vysvětlivky ikonek</h4>
        <dl className="xct-users__legend-list">
          <dt>
            <img src={ICONS.sex.male} alt="" width={10} height={11} />
          </dt>
          <dd>Muž</dd>
          <dt>
            <img src={ICONS.sex.female} alt="" width={10} height={11} />
          </dt>
          <dd>Žena</dd>
          <dt>
            <img src={ICONS.sex.maleCert} alt="" width={10} height={11} />
          </dt>
          <dd>Certifikovaný muž</dd>
          <dt>
            <img src={ICONS.sex.femaleCert} alt="" width={10} height={11} />
          </dt>
          <dd>Certifikovaná žena</dd>
        </dl>
      </div>
    </div>
  );
};

export default UsersTab;
