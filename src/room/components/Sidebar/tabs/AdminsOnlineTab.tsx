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
import './AdminsOnlineTab.scss';export interface AdminsOnlineTabProps {
  ctx: RoomContext;
  onSelectUser: (nick: string) => void;
  /** Přepnout na tab „Ignorace" (odkaz v nápovědě). */
  onOpenIgnore?: () => void;
}

/** Jeden řádek v seznamu – nick + online flag + ikonky z user.php. */
interface HelpEntry {
  nick: string;
  online: boolean;
  detail: UserDetail | null;
}

/** Klíče jednotlivých sekcí – podle nich držíme stav sbaleno/rozbaleno. */
type SectionKey =
  | 'temp'
  | 'permOnline'
  | 'admOnline'
  | 'permOffline'
  | 'admOffline';

/** Výchozí stav: offline sekce sbalené, ostatní rozbalené. */
const DEFAULT_COLLAPSED: Record<SectionKey, boolean> = {
  temp: false,
  permOnline: false,
  admOnline: false,
  permOffline: true,
  admOffline: true,
};

const AdminsOnlineTab = ({ ctx, onSelectUser, onOpenIgnore }: AdminsOnlineTabProps) => {
  const [loading, setLoading] = useState(true);
  const [permanent, setPermanent] = useState<PermanentRoomAdmin[]>([]);
  const [admins, setAdmins] = useState<AdminInfo[]>([]);
  const [roomAdminNick, setRoomAdminNick] = useState<string | null>(null);
  const [details, setDetails] = useState<Map<string, UserDetail>>(new Map());
  const [collapsed, setCollapsed] =
    useState<Record<SectionKey, boolean>>(DEFAULT_COLLAPSED);

  const toggleSection = (key: SectionKey): void =>
    setCollapsed((s) => ({ ...s, [key]: !s[key] }));

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
  // Řadíme podle hvězdičky: zelená (4) → žlutá (8) → červená (16); nicky bez
  // detailu padnou na konec. Při stejné hvězdičce řadíme podle nicku (cs).
  const adminEntries = useMemo<HelpEntry[]>(() => {
    const rLc = roomAdminNick?.toLowerCase();
    const permSet = new Set(permanent.map((p) => p.nick.toLowerCase()));
    const rank = (e: HelpEntry): number => {
      switch (e.detail?.star) {
        case 4: return 0;
        case 8: return 1;
        case 16: return 2;
        default: return 99;
      }
    };
    return admins
      .filter((a) => {
        const lc = a.nick.toLowerCase();
        return lc !== rLc && !permSet.has(lc);
      })
      .map<HelpEntry>((a) => ({
        nick: a.nick,
        online: a.online,
        detail: detailOf(a.nick),
      }))
      .sort((a, b) => {
        const ra = rank(a);
        const rb = rank(b);
        if (ra !== rb) return ra - rb;
        return a.nick.localeCompare(b.nick, 'cs', { sensitivity: 'base' });
      });
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

  const renderSection = (
    key: SectionKey,
    label: string,
    items: HelpEntry[],
    opts: { spaced?: boolean } = {},
  ): JSX.Element | null => {
    if (items.length === 0) return null;
    const isCollapsed = collapsed[key];
    return (
      <>
        <h4
          className={
            'xct-users__group xct-admin-online__header' +
            (isCollapsed ? ' is-collapsed' : '') +
            (opts.spaced ? ' xct-admin-online__header--spaced' : '')
          }
        >
          <button
            type="button"
            className="xct-admin-online__header-btn"
            onClick={() => toggleSection(key)}
            aria-expanded={!isCollapsed}
          >
            <span className="xct-admin-online__caret" aria-hidden="true" />
            <span className="xct-users__group-name">
              {label} ({items.length})
            </span>
          </button>
        </h4>
        {!isCollapsed ? (
          <ul className="xct-users__list">{items.map(renderRow)}</ul>
        ) : null}
      </>
    );
  };

  if (loading) {
    return (
      <div className="xct-users">
        <h3 className="xct-users__title">Online pomoc</h3>
        <div className="xct-tab-empty">Načítám…</div>
      </div>
    );
  }

  const tempCollapsed = collapsed.temp;

  return (
    <div className="xct-users">
      <h3 className="xct-users__title">Online pomoc</h3>

      <h4
        className={
          'xct-users__group xct-admin-online__header' +
          (tempCollapsed ? ' is-collapsed' : '')
        }
      >
        <button
          type="button"
          className="xct-admin-online__header-btn"
          onClick={() => toggleSection('temp')}
          aria-expanded={!tempCollapsed}
        >
          <span className="xct-admin-online__caret" aria-hidden="true" />
          <span className="xct-users__group-name">Dočasný správce</span>
        </button>
      </h4>
      {!tempCollapsed ? (
        tempAdmin ? (
          <ul className="xct-users__list">{renderRow(tempAdmin)}</ul>
        ) : (
          <div className="xct-admin-online__empty">
            (žádný pro místnost není)
          </div>
        )
      ) : null}

      {renderSection('permOnline', 'Stálí správci online', permOnline)}
      {renderSection('admOnline', 'Administrátoři online', admOnline)}
      {renderSection('permOffline', 'Stálí správci offline', permOffline, {
        spaced: true,
      })}
      {renderSection('admOffline', 'Administrátoři offline', admOffline, {
        spaced: permOffline.length === 0,
      })}

      <div className="xct-admin-online__help">
        <h4 className="xct-users__group xct-admin-online__help-title">
          Nápověda
        </h4>
        <div className="xct-admin-online__help-body">
          <p className="xct-admin-online__help-p">
            Pokud tě obtěžuje nějaký nick šeptáním, které tě nezajímá,{' '}
            {onOpenIgnore ? (
              <button
                type="button"
                className="xct-admin-online__help-link"
                onClick={onOpenIgnore}
              >
                využij ignoraci
              </button>
            ) : (
              <>využij ignoraci</>
            )}
            .
          </p>
          <p className="xct-admin-online__help-p">
            Pokud tě někdo obtěžuje na skle nebo máš jiné potíže v místnosti,
            požádej o pomoc nejprve dočasného nebo stálého správce.
          </p>
          <p className="xct-admin-online__help-p">
            Pokud nejsou přítomni nebo máš jiný problém, se kterým si ani nikdo
            ze správců neví rady, můžeš kontaktovat někoho z administrátorů,
            rádi ti pomohou.
          </p>
        </div>
      </div>

      <div className="xct-admin-online__legend">
        <h4 className="xct-users__group xct-admin-online__help-title">
          Vysvětlivky
        </h4>
        <ul className="xct-admin-online__legend-list">
          <li>
            <img
              src={starUrl(4)}
              alt=""
              title={starTitle(4)}
              className="xct-admin-online__legend-icon"
            />
            <span>Administrátor ve zkušební době</span>
          </li>
          <li>
            <img
              src={starUrl(8)}
              alt=""
              title={starTitle(8)}
              className="xct-admin-online__legend-icon"
            />
            <span>Administrátor</span>
          </li>
          <li>
            <img
              src={starUrl(16)}
              alt=""
              title={starTitle(16)}
              className="xct-admin-online__legend-icon"
            />
            <span>Vedení XChatu týmu</span>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default AdminsOnlineTab;
