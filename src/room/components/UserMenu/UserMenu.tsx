/**
 * UserMenu – rozbalovací menu v pravém horním rohu pod avatarem.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useEffect, useRef, type RefObject } from 'react';
import type { RoomContext } from '../../../api/types';
import { XChatUrls } from '../../../api/XChatApi';
import './UserMenu.scss';

export interface UserMenuProps {
  ctx: RoomContext;
  onClose: () => void;
  /**
   * Reference na toggle button, který menu otevřel. Kliknutí uvnitř této
   * reference ignorujeme, aby toggle mohl menu korektně zavřít (jinak
   * mousedown listener zavře menu dřív, než se na buttonu stihne spustit
   * onClick, a menu se hned zase otevře).
   */
  anchorRef?: RefObject<HTMLElement | null>;
  /** Akce „Pomoc online" – přepne Sidebar na speciální tab. */
  onOpenAdminsOnline?: () => void;
}

interface Item {
  label: string;
  /** Externí odkaz; otevře se v novém panelu. */
  href?: string;
  /** Vlastní akce (přepnutí Sidebaru apod.). */
  action?: () => void;
}

const UserMenu = ({ ctx, onClose, anchorRef, onOpenAdminsOnline }: UserMenuProps) => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent): void => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (anchorRef?.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [onClose, anchorRef]);

  // Všechny URL prefixujeme `hashPrefix(xhash)`, aby šly přes autentizovanou
  // cestu `{origin}/~{xhash}/...` (jinak XChat přesměruje na login).
  const prefix = XChatUrls.hashPrefix(ctx.xhash);
  const nick = encodeURIComponent(ctx.myNick);

  const items: Item[] = [
    { label: 'Můj profil', href: `${prefix}/whoiswho/profile.php?nick=${nick}` },
    { label: 'Moje fotky', href: `${prefix}/unewest.php?nick=${nick}` },
    { label: 'Poznámky', href: `${prefix}/notes/` },
    { label: 'Nastavení', href: `${prefix}/settings/` },
    { label: 'Pomoc online', action: () => onOpenAdminsOnline?.() },
    { label: 'Profily', href: `${prefix}/whoiswho/` },
    { label: 'Fórum', href: `${prefix}/forum/favourite.php` },
    { label: 'Srazy', href: `${prefix}/meeting/` },
    { label: 'Duel', href: `${prefix}/duel/` },
    { label: 'Nápověda', href: `${prefix}/help/` },
  ];

  return (
    <div className="xct-user-menu" ref={ref} role="menu">
      {items.map((it) =>
        it.href ? (
          <a
            key={it.label}
            className="xct-user-menu__item"
            href={it.href}
            target="_blank"
            rel="noreferrer"
            onClick={() => onClose()}
          >
            {it.label}
          </a>
        ) : (
          <button
            key={it.label}
            type="button"
            className="xct-user-menu__item"
            onClick={() => {
              it.action?.();
              onClose();
            }}
          >
            {it.label}
          </button>
        ),
      )}
    </div>
  );
};

export default UserMenu;
