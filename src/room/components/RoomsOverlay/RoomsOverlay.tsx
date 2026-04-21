/**
 * RoomsOverlay – překryv ve spodní polovině MessageBoardu se seznamem
 * uživatelů ve zvolené místnosti.
 *
 * Otevírá se z UserMenu („Místnosti"). Nahoře přepínač místností
 * (všechny místnosti z `scripts/rooms.php`), pod ním tabulka uživatelů
 * (hvězda, pohlaví, nick, online, nemluvil, vzkaz, profil) – parsovaná
 * z `modchat?op=wwpageng&rid=…`.
 *
 * Zavření: křížkem nebo klávesou Esc.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useEffect, useMemo, useState } from 'react';
import type { RoomContext, RoomListItem, RoomUser } from '../../../api/types';
import { XChatApi, XChatUrls } from '../../../api/XChatApi';
import { CloseIcon } from '../../icons/IconPalette';
import './RoomsOverlay.scss';

export interface RoomsOverlayProps {
  ctx: RoomContext;
  onClose: () => void;
}

const XCHAT_IMG = 'https://ximg.cz/x4';

const starUrl = (star: number): string => {
  switch (star) {
    case 1: return `${XCHAT_IMG}/star/x1.gif`;
    case 2: return `${XCHAT_IMG}/star/x2.gif`;
    case 4: return `${XCHAT_IMG}/star/x4.gif`;
    case 8: return `${XCHAT_IMG}/star/x8.gif`;
    case 16: return `${XCHAT_IMG}/star/x16.gif`;
    default: return `${XCHAT_IMG}/star/x0.gif`;
  }
};

const sexUrl = (sex: number, certified: boolean): string => {
  const base = sex === 1 ? 'wn' : 'mn';
  return `${XCHAT_IMG}/rm/${base}${certified ? '_c' : ''}.gif`;
};

/** Sekundy → `HH:MM:SS` (jako v původním XChatu). */
const formatHms = (sec: number): string => {
  if (!sec || sec < 0) return '';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number): string => (n < 10 ? `0${n}` : String(n));
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
};

const RoomsOverlay = ({ ctx, onClose }: RoomsOverlayProps) => {
  const [rooms, setRooms] = useState<RoomListItem[] | null>(null);
  const [roomsError, setRoomsError] = useState<string | null>(null);
  const [rid, setRid] = useState<number>(ctx.rid);
  const [users, setUsers] = useState<RoomUser[] | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [usersLoading, setUsersLoading] = useState(false);

  // Esc zavře overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Načtení seznamu místností (jen jednou při otevření).
  useEffect(() => {
    let cancelled = false;
    XChatApi.getRoomsList()
      .then((list) => {
        if (cancelled) return;
        // Řazení abecedně podle názvu (stejně jako výběr v XChatu).
        const sorted = [...list].sort((a, b) =>
          a.name.localeCompare(b.name, 'cs', { sensitivity: 'base' }),
        );
        setRooms(sorted);
      })
      .catch((err) => {
        if (cancelled) return;
        setRoomsError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Načtení uživatelů při změně rid.
  useEffect(() => {
    let cancelled = false;
    setUsersLoading(true);
    setUsersError(null);
    XChatApi.getRoomUsers(ctx.xhash, rid, ctx.skin)
      .then((list) => {
        if (cancelled) return;
        setUsers(list);
      })
      .catch((err) => {
        if (cancelled) return;
        setUsersError(err instanceof Error ? err.message : String(err));
        setUsers([]);
      })
      .finally(() => {
        if (!cancelled) setUsersLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ctx.xhash, ctx.skin, rid]);

  const prefix = XChatUrls.hashPrefix(ctx.xhash);

  const currentRoomName = useMemo(() => {
    if (rid === ctx.rid) return ctx.roomName;
    return rooms?.find((r) => r.rid === rid)?.name ?? '';
  }, [rid, rooms, ctx.rid, ctx.roomName]);

  return (
    <div className="xct-rooms-overlay" role="dialog" aria-label="Místnosti">
      <header className="xct-rooms-overlay__header">
        <h2 className="xct-rooms-overlay__title">
          Výpis uživatelů v místnosti
          {currentRoomName ? (
            <span className="xct-rooms-overlay__room-name">– {currentRoomName}</span>
          ) : null}
        </h2>
        <button
          type="button"
          className="xct-rooms-overlay__close"
          onClick={onClose}
          aria-label="Zavřít"
          title="Zavřít (Esc)"
        >
          <CloseIcon width={16} height={16} />
        </button>
      </header>

      <div className="xct-rooms-overlay__switcher">
        <label className="xct-rooms-overlay__label" htmlFor="xct-rooms-select">
          Místnost:
        </label>
        {roomsError ? (
          <span className="xct-rooms-overlay__error">
            Chyba při načítání místností: {roomsError}
          </span>
        ) : !rooms ? (
          <span className="xct-rooms-overlay__hint">Načítám…</span>
        ) : (
          <select
            id="xct-rooms-select"
            className="xct-rooms-overlay__select"
            value={rid}
            onChange={(e) => setRid(Number(e.target.value))}
          >
            {rooms.map((r) => (
              <option key={r.rid} value={r.rid}>
                {r.name} ({r.userCount})
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="xct-rooms-overlay__body">
        {usersLoading && !users ? (
          <div className="xct-rooms-overlay__hint">Načítám uživatele…</div>
        ) : usersError ? (
          <div className="xct-rooms-overlay__error">
            Chyba při načítání uživatelů: {usersError}
          </div>
        ) : users && users.length === 0 ? (
          <div className="xct-rooms-overlay__hint">Místnost je prázdná.</div>
        ) : (
          <table className="xct-rooms-overlay__table">
            <thead>
              <tr>
                <th className="xct-rooms-overlay__th-ico" aria-label="hvězda" />
                <th className="xct-rooms-overlay__th-ico" aria-label="pohlaví" />
                <th>Nick</th>
                <th>Online</th>
                <th>Nemluvil</th>
                <th>Vzkaz</th>
                <th>Profil</th>
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <tr key={u.nick} className={`xct-rooms-overlay__row xct-rooms-overlay__row--sex-${u.sex}`}>
                  <td className="xct-rooms-overlay__ico">
                    <img src={starUrl(u.star)} alt="" width={11} height={10} />
                  </td>
                  <td className="xct-rooms-overlay__ico">
                    <img src={sexUrl(u.sex, u.certified)} alt="" width={10} height={11} />
                  </td>
                  <td className="xct-rooms-overlay__nick">{u.nick}</td>
                  <td className="xct-rooms-overlay__time">{u.onlineSince}</td>
                  <td className="xct-rooms-overlay__time">{formatHms(u.idleSeconds)}</td>
                  <td>
                    <a
                      className="xct-rooms-overlay__link"
                      href={`${prefix}/offline/new_msg.php?to_name=${encodeURIComponent(u.nick)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      vzkaz
                    </a>
                  </td>
                  <td>
                    <a
                      className="xct-rooms-overlay__link"
                      href={`${prefix}/whoiswho/profile.php?nick=${encodeURIComponent(u.nick)}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      profil
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default RoomsOverlay;
