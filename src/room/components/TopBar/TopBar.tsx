/**
 * TopBar – horní lišta: logo, hledání, pravé kulaté ikony.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useMemo, useRef, useState } from 'react';
import type { RoomContext, RoomUser, SidebarTab } from '../../../api/types';
import { XChatUrls } from '../../../api/XChatApi';
import {
  EnvelopeIcon,
  DoorExitIcon,
  ChevronDownIcon,
  HomeIcon,
} from '../../icons/IconPalette';
import SearchBox from '../SearchBox/SearchBox';
import UserMenu from '../UserMenu/UserMenu';
import { useVzkazyCount } from '../../hooks/useVzkazyCount';
import './TopBar.scss';

export interface TopBarProps {
  ctx: RoomContext;
  /** Počet uživatelů (pro overlay s detailem místnosti). */
  userCount: number;
  /** Seznam uživatelů v místnosti – pro správnou velikost písmen v nicku. */
  users: RoomUser[];
  /** Otevře overlay „Informace o místnosti" (spodní polovina boardu). */
  onOpenRoomDetails: () => void;
  /** Přepnutí aktivní záložky v Sidebaru (pro „Pomoc online"). */
  onChangeTab: (tab: SidebarTab) => void;
  /** Otevře overlay „Místnosti" (spodní polovina MessageBoardu). */
  onOpenRooms: () => void;
}

const TopBar = ({ ctx, users, onOpenRoomDetails, onChangeTab, onOpenRooms }: TopBarProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const leaveUrl = XChatUrls.roomLeave(ctx.xhash, ctx.rid, ctx.cid, ctx.skin);
  const vzkazyCount = useVzkazyCount(ctx.xhash);
  const vzkazyBadge = vzkazyCount !== null && vzkazyCount > 0
    ? (vzkazyCount > 99 ? '99+' : String(vzkazyCount))
    : null;
  // České skloňování: 1 vzkaz nepřečtený, 2–4 vzkazy nepřečtené, 5+ vzkazů nepřečtených.
  const vzkazyTitle = useMemo(() => {
    if (vzkazyCount === null || vzkazyCount === 0) return 'Vzkazy (offline)';
    if (vzkazyCount === 1) return '1 vzkaz nepřečtený';
    if (vzkazyCount >= 2 && vzkazyCount <= 4) return `${vzkazyCount} vzkazy nepřečtené`;
    return `${vzkazyCount} vzkazů nepřečtených`;
  }, [vzkazyCount]);

  // Nick ve správné velikosti písmen – XChat v HTML nick často lowercase;
  // v seznamu uživatelů ho ale máme v original casing.
  const displayNick = useMemo(() => {
    const needle = (ctx.myNick ?? '').toLowerCase();
    if (!needle) return ctx.myNick;
    const found = users.find((u) => u.nick.toLowerCase() === needle);
    return found?.nick ?? ctx.myNick;
  }, [users, ctx.myNick]);

  const openRoomDetails = onOpenRoomDetails;

  return (
    <header className="xct-topbar">
      <a
        className="xct-topbar__logo"
        href={`${XChatUrls.hashPrefix(ctx.xhash)}/`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="XChat – hlavní stránka"
      >
        {ctx.skin === 44 ? (
          // Matrix easter egg – místo oficiálního loga stylizovaný text
          // „MatriXChat" ve stylu filmu. Barva #7BF244 sladěná s paletou.
          <span className="xct-topbar__logo-matrix" aria-label="MatriXChat">
            MatriXChat
          </span>
        ) : ctx.skin === 48 ? (
          // Skin „Lidé" – vlastní logo z rozšíření (img/logo-lide.png).
          <img
            src={chrome.runtime.getURL('img/logo-lide.png')}
            alt="XChat – Lidé"
          />
        ) : ctx.skin === 8 ? (
          // Skin „XChat 2006" – retro logo ve stylu skinu.
          <img
            src="https://ximg.cz/x4/logo.gif"
            alt="XChat 2006"
          />
        ) : (
          /* Oficiální logo XChatu (77×26) – velikost řídí CSS (height: 26px). */
          <img
            src="https://x3.ximg.cz/logo/logo-77x26.png"
            alt="XChat"
          />
        )}
      </a>

      <div className="xct-topbar__search-group">
        <div className="xct-topbar__search">
          <SearchBox ctx={ctx} />
        </div>

        <div className="xct-topbar__room">
          <button
            type="button"
            className="xct-topbar__room-tag"
            onClick={openRoomDetails}
            title="Informace o místnosti"
          >
            <HomeIcon width={13} height={13} />
            <span className="xct-topbar__room-name">{ctx.roomName.trim()}</span>
          </button>
        </div>
      </div>

      <nav className={`xct-topbar__actions ${menuOpen ? 'is-menu-open' : ''}`}>
        <a
          className="xct-topbar__btn"
          href="/offline/"
          target="_top"
          title={vzkazyBadge ? vzkazyTitle : 'Vzkazy (offline)'}
          aria-label="Vzkazy"
        >
          <EnvelopeIcon width={18} height={18} />
          <span className="xct-topbar__btn-label">Vzkazy</span>
          {vzkazyBadge ? (
            <span className="xct-topbar__badge" aria-hidden="true">{vzkazyBadge}</span>
          ) : null}
        </a>
        <a
          className="xct-topbar__btn"
          href={leaveUrl}
          target="_top"
          title="Opustit místnost"
          aria-label="Opustit místnost"
        >
          <DoorExitIcon width={18} height={18} />
          <span className="xct-topbar__btn-label">Odejít</span>
        </a>
        <div className="xct-topbar__user-wrap">
          <button
            ref={toggleRef}
            type="button"
            className={`xct-topbar__user ${menuOpen ? 'is-open' : ''}`}
            onClick={() => setMenuOpen((v) => !v)}
            aria-expanded={menuOpen}
          >
            <img
              className="xct-topbar__avatar"
              src={XChatUrls.avatar(ctx.myNick, ctx.sex)}
              alt={ctx.myNick}
              width={26}
              height={26}
            />
            <span className="xct-topbar__nick">{displayNick}</span>
            <span className="xct-topbar__chevron" aria-hidden="true">
              <ChevronDownIcon width={14} height={14} />
            </span>
          </button>
          {menuOpen ? (
            <UserMenu
              ctx={ctx}
              anchorRef={toggleRef}
              onClose={() => setMenuOpen(false)}
              onOpenAdminsOnline={() => onChangeTab('adminsOnline')}
              onOpenIgnore={() => onChangeTab('ignore')}
              onOpenRooms={onOpenRooms}
            />
          ) : null}
        </div>
      </nav>
    </header>
  );
};

export default TopBar;
