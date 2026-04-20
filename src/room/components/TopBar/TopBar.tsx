/**
 * TopBar – horní lišta: logo, hledání, pravé kulaté ikony.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useMemo, useRef, useState, type ReactNode } from 'react';
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
import RoomDetailsPanel from '../RoomDetailsPanel/RoomDetailsPanel';
import './TopBar.scss';

export interface TopBarProps {
  ctx: RoomContext;
  /** Počet uživatelů (pro overlay s detailem místnosti). */
  userCount: number;
  /** Seznam uživatelů v místnosti – pro správnou velikost písmen v nicku. */
  users: RoomUser[];
  /** Otevření overlay nad MessageBoard (řídí App.tsx). */
  onOpenOverlay: (title: string, body: ReactNode) => void;
  /** Přepnutí aktivní záložky v Sidebaru (pro „Pomoc online"). */
  onChangeTab: (tab: SidebarTab) => void;
}

const TopBar = ({ ctx, userCount, users, onOpenOverlay, onChangeTab }: TopBarProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const leaveUrl = XChatUrls.roomLeave(ctx.xhash, ctx.rid, ctx.cid, ctx.skin);

  // Nick ve správné velikosti písmen – XChat v HTML nick často lowercase;
  // v seznamu uživatelů ho ale máme v original casing.
  const displayNick = useMemo(() => {
    const needle = (ctx.myNick ?? '').toLowerCase();
    if (!needle) return ctx.myNick;
    const found = users.find((u) => u.nick.toLowerCase() === needle);
    return found?.nick ?? ctx.myNick;
  }, [users, ctx.myNick]);

  const openRoomDetails = () => {
    onOpenOverlay(
      `Informace o místnosti: ${ctx.roomName}`,
      <RoomDetailsPanel ctx={ctx} userCount={userCount} />,
    );
  };

  return (
    <header className="xct-topbar">
      <a
        className="xct-topbar__logo"
        href="/"
        target="_top"
        aria-label="XChat"
      >
        {/* Oficiální logo XChatu (77×26) – velikost řídí CSS (height: 26px). */}
        <img
          src="https://x3.ximg.cz/logo/logo-77x26.png"
          alt="XChat"
        />
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
          title="Vzkazy (offline)"
          aria-label="Vzkazy"
        >
          <EnvelopeIcon width={18} height={18} />
          <span className="xct-topbar__btn-label">Vzkazy</span>
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
            />
          ) : null}
        </div>
      </nav>
    </header>
  );
};

export default TopBar;
