/**
 * TopBar – horní lišta: logo, hledání, pravé kulaté ikony.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useRef, useState } from 'react';
import type { RoomContext } from '../../../api/types';
import { XChatUrls } from '../../../api/XChatApi';
import { EnvelopeIcon, DoorExitIcon, ChevronDownIcon } from '../../icons/IconPalette';
import SearchBox from '../SearchBox/SearchBox';
import UserMenu from '../UserMenu/UserMenu';
import './TopBar.scss';

export interface TopBarProps {
  ctx: RoomContext;
}

const TopBar = ({ ctx }: TopBarProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const leaveUrl = XChatUrls.roomLeave(ctx.xhash, ctx.rid, ctx.cid, ctx.skin);

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

      <div className="xct-topbar__search">
        <SearchBox ctx={ctx} />
      </div>

      <div className="xct-topbar__room">
        <span className="xct-topbar__room-tag">{ctx.roomName.trim()}</span>
      </div>

      <nav className="xct-topbar__actions">
        <a
          className="xct-topbar__btn"
          href="/offline/"
          target="_top"
          title="Vzkazy (offline)"
          aria-label="Vzkazy"
        >
          <EnvelopeIcon width={18} height={18} />
        </a>
        <a
          className="xct-topbar__btn"
          href={leaveUrl}
          target="_top"
          title="Opustit místnost"
          aria-label="Opustit místnost"
        >
          <DoorExitIcon width={18} height={18} />
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
            <span className="xct-topbar__nick">{ctx.myNick}</span>
            <span className="xct-topbar__chevron" aria-hidden="true">
              <ChevronDownIcon width={14} height={14} />
            </span>
          </button>
          {menuOpen ? (
            <UserMenu
              ctx={ctx}
              anchorRef={toggleRef}
              onClose={() => setMenuOpen(false)}
            />
          ) : null}
        </div>
      </nav>
    </header>
  );
};

export default TopBar;
