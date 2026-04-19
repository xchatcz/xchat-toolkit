/**
 * UserMenu – rozbalovací menu v pravém horním rohu pod avatarem.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useEffect, useRef } from 'react';
import type { RoomContext } from '../../../api/types';
import { XChatUrls } from '../../../api/XChatApi';
import './UserMenu.scss';

export interface UserMenuProps {
  ctx: RoomContext;
  onClose: () => void;
}

interface Item {
  label: string;
  href: string;
  target?: '_blank' | '_top';
}

const UserMenu = ({ ctx, onClose }: UserMenuProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent): void => {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [onClose]);

  const items: Item[] = [
    { label: 'Můj profil', href: `/uzivatele/${encodeURIComponent(ctx.myNick)}`, target: '_blank' },
    { label: 'Moje fotky', href: `https://fotoalba.xchat.cz/${encodeURIComponent(ctx.myNick)}/`, target: '_blank' },
    { label: 'Poznámky', href: XChatUrls.notesPage(ctx.xhash), target: '_blank' },
    { label: 'Nastavení', href: '/user/settings.php', target: '_blank' },
    { label: 'Fórum', href: '/forum/', target: '_blank' },
    { label: 'Profily', href: '/uzivatele/', target: '_blank' },
    { label: 'Nápověda', href: '/napoveda/', target: '_blank' },
    { label: 'Odhlásit', href: XChatUrls.logout(ctx.xhash), target: '_top' },
  ];

  return (
    <div className="xct-user-menu" ref={ref} role="menu">
      {items.map((it) => (
        <a key={it.label} className="xct-user-menu__item" href={it.href} target={it.target} rel="noreferrer">
          {it.label}
        </a>
      ))}
    </div>
  );
};

export default UserMenu;
