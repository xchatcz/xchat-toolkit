/**
 * AdminsOnlineTab – „Online pomoc" vyvolaná z UserMenu.
 *
 * Zdroje:
 *   - `RoomDetail`            … dočasný správce místnosti.
 *   - `scripts/ss.php?rid=…`  … stálí správci místnosti + online flag.
 *   - `scripts/admin.php`     … seznam administrátorů + online flag.
 *   - `scripts/user.php?nick` … ikonky (sex + star + cert) pro každý nick.
 *
 * Sekce shora dolů, přesně v tomto pořadí:
 *   1) Dočasný správce – vždy viditelné (jinak „(žádný pro místnost není)").
 *   2) Stálí správci online
 *   3) Administrátoři online
 *   4) Stálí správci offline
 *   5) Administrátoři offline
 *
 * Dočasného správce odfiltrujeme ze stálých i z adminů, aby se nezobrazoval
 * dvakrát. Klik na nick → šeptací target jako v UsersTab.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useEffect, useMemo, useState } from 'react';
import XChatApi from '../../../../api/XChatApi';
import type {
  AdminInfo,
  PermanentRoomAdmin,
  RoomContext,
  UserDetail,
} from '../../../../api/types';
import { toast } from '../../../../core/toast';
import {
  sexTitle,
  sexUrl,
  starTitle,
  starUrl,
} from '../../../utils/xchatIcons';
import './UsersTab.scss';
import './AdminsOnlineTab.scss';

export interface AdminsOnlineTabProps {
  ctx: RoomContext;
  onSelectUser: (nick: string) => void;
}

/** Jeden řádek v seznamu – nick + online flag + ikonky z user.php. */
interface HelpEntry {
  nick: string;
  online: boolean;
  detail: UserDetail | null;
}

const AdminsOnlineTab = ({ ctx, onSelectUser }: AdminsOnlineTabProps) => {
  const [loading, setLoading] = useState(true);
  const [permanent, setPermanent] = useState<PermanentRoomAdmin[]>([]);
  const [admins, setAdmins] = useState<AdminInfo[]>([]);
  const [roomAdminNick, setRoomAdminNick] = useState<string | null>(null);
  const [details, setDetails] = useState<Map<string, UserDetail>>(new Map());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [detail, perm, adm] = await Promise.all([
          XChatApi.getRoomDetail(ctx.rid),
          XChatApi.getPermanentRoomAdmins(ctx.rid),
          XChatApi.getAdmins(),
        ]);
        if (cancelled) return;
        const tempNick = detail?.admin?.trim() || null;
        setRoomAdminNick(tempNick);
        setPermanent(perm);
        setAdmins(adm);

        // Unikátní nicky (case-insensitive) pro dotažení user.php.
        const uniq = new Map<string, string>(); // lc → original
        const addNick = (n: string | null | undefined) => {
          const s = (n ?? '').trim();
          if (!s) return;
          const lc = s.toLowerCase();
          if (!uniq.has(lc)) uniq.set(lc, s);
        };
        addNick(tempNick);
        perm.forEach((p) => addNick(p.nick));
        adm.forEach((a) => addNick(a.nick));

        const fetched = await Promise.all(
          Array.from(uniq.values()).map(async (n) => {
            try {
              const d = await XChatApi.getUserDetail(n);
              return [n.toLowerCase(), d] as const;
            } catch {
              return [n.toLowerCase(), null] as const;
            }
          }),
        );
        if (cancelled) return;
        const map = new Map<string, UserDetail>();
        for (const [lc, d] of fetched) if (d) map.set(lc, d);
        setDetails(map);
      } catch (err) {
        if (!cancelled) {
          toast.error(`Nepodařilo se načíst Online pomoc: ${String(err)}`);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ctx.rid]);

  const detailOf = (nick: string): UserDetail | null =>
    details.get(nick.toLowerCase()) ?? null;

  // Dočasný správce – zobrazujeme vždy, pokud je nastavený.
  const tempAdmin = useMemo<HelpEntry | null>(() => {
    if (!roomAdminNick) return null;
    return { nick: roomAdminNick, online: true, detail: detailOf(roomAdminNick) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomAdminNick, details]);

  // Stálí správci bez dočasného správce.
  const permanentEntries = useMemo<HelpEntry[]>(() => {
    const rLc = roomAdminNick?.toLowerCase();
    return permanent
      .filter((p) => p.nick.toLowerCase() !== rLc)
      .map((p) => ({
        nick: p.nick,
        online: p.online,
        detail: detailOf(p.nick),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permanent, roomAdminNick, details]);

  // Admini bez dočasného správce a bez stálých správců (ti mají vlastní sekci).
  const adminEntries = useMemo<HelpEntry[]>(() => {
    const rLc = roomAdminNick?.toLowerCase();
    const permSet = new Set(permanent.map((p) => p.nick.toLowerCase()));
    return admins
      .filter((a) => {
        const lc = a.nick.toLowerCase();
        return lc !== rLc && !permSet.has(lc);
      })
      .map((a) => ({
        nick: a.nick,
        online: a.online,
        detail: detailOf(a.nick),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admins, permanent, roomAdminNick, details]);

  const permOnline = permanentEntries.filter((e) => e.online);
  const permOffline = permanentEntries.filter((e) => !e.online);
  const admOnline = adminEntries.filter((e) => e.online);
  const admOffline = adminEntries.filter((e) => !e.online);

  const renderRow = (u: HelpEntry): JSX.Element => {
    const d = u.detail;
    const sex = d?.sex;
    const star = d?.star;
    const cert = d?.certified ?? false;
    const hasIcons = d !== null;
    return (
      <li
        key={u.nick}
        className={
          'xct-users__item' +
          (sex !== undefined ? ` xct-users__item--sex-${sex}` : '') +
          (u.online ? '' : ' xct-admin-online__item--offline')
        }
      >
        <button
          type="button"
          className="xct-users__btn"
          onClick={() => onSelectUser(u.nick)}
        >
          {hasIcons ? (
            <>
              <span
                className="xct-users__ico xct-users__ico--star"
                title={starTitle(star!)}
              >
                <img src={starUrl(star!)} alt="" width={11} height={10} />
              </span>
              <span
                className="xct-users__ico xct-users__ico--sex"
                title={sexTitle(sex!, cert)}
              >
                <img src={sexUrl(sex!, cert)} alt="" width={10} height={11} />
              </span>
            </>
          ) : (
            <>
              <span className="xct-users__ico xct-users__ico--star" />
              <span className="xct-users__ico xct-users__ico--sex" />
            </>
          )}
          <span className="xct-users__nick">{u.nick}</span>
          <span
            className={
              'xct-admin-online__dot ' +
              (u.online
                ? 'xct-admin-online__dot--online'
                : 'xct-admin-online__dot--offline')
            }
            title={u.online ? 'Online' : 'Offline'}
          />
        </button>
      </li>
    );
  };

  const renderSection = (label: string, items: HelpEntry[]): JSX.Element => (
    <>
      <h4 className="xct-users__group">
        <span className="xct-users__group-name">
          {label} ({items.length})
        </span>
      </h4>
      {items.length > 0 ? (
        <ul className="xct-users__list">{items.map(renderRow)}</ul>
      ) : (
        <div className="xct-admin-online__empty">(nikdo)</div>
      )}
    </>
  );

  if (loading) {
    return (
      <div className="xct-users">
        <h3 className="xct-users__title">Online pomoc</h3>
        <div className="xct-tab-empty">Načítám…</div>
      </div>
    );
  }

  return (
    <div className="xct-users">
      <h3 className="xct-users__title">Online pomoc</h3>

      <h4 className="xct-users__group">
        <span className="xct-users__group-name">Dočasný správce</span>
      </h4>
      {tempAdmin ? (
        <ul className="xct-users__list">{renderRow(tempAdmin)}</ul>
      ) : (
        <div className="xct-admin-online__empty">
          (žádný pro místnost není)
        </div>
      )}

      {renderSection('Stálí správci online', permOnline)}
      {renderSection('Administrátoři online', admOnline)}
      {renderSection('Stálí správci offline', permOffline)}
      {renderSection('Administrátoři offline', admOffline)}
    </div>
  );
};

export default AdminsOnlineTab;
