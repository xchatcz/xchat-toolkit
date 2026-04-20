/**
 * UserMenu – rozbalovací menu v pravém horním rohu pod avatarem.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useEffect, useRef, useState, type RefObject } from 'react';
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
  // Minimální šířka menu = šířka otvírače + 60 px (měříme po mountu).
  const [minWidth, setMinWidth] = useState<number | null>(null);
  // Když menu nepřesahuje otvírač vlevo, levý horní roh zůstane rovný
  // (plynule navazuje na rovnou spodní hranu otvírače).
  const [flatTopLeft, setFlatTopLeft] = useState(false);

  useEffect(() => {
    if (!anchorRef?.current || !ref.current) return;
    const anchorWidth = anchorRef.current.getBoundingClientRect().width;
    // Vždy min 180 px, jinak alespoň šířka otvírače (aby nebylo menu užší).
    setMinWidth(Math.max(180, Math.ceil(anchorWidth)));
    // Po nastavení šířky změříme skutečnou šířku menu a porovnáme.
    // Levý horní roh menu (radius 8 px) „vyčnívá" vlevo od otvírače o `overhang`.
    // Pokud je ten přesah menší než radius (8 px), zaoblení se protíná
    // s rovnou spodní hranou otvírače a vypadá ošklivě – pak roh zploštíme.
    requestAnimationFrame(() => {
      if (!ref.current || !anchorRef.current) return;
      const menuWidth = ref.current.getBoundingClientRect().width;
      const anchorW = anchorRef.current.getBoundingClientRect().width;
      const overhang = menuWidth - anchorW;
      setFlatTopLeft(overhang < 8);
    });
  }, [anchorRef]);

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
  // Fotoalbum běží na vlastní subdoméně, ale používá stejný xhash.
  const fotoalbaPrefix = `https://fotoalba.xchat.cz/~${XChatUrls.normalizeXhash(ctx.xhash)}`;
  const nick = encodeURIComponent(ctx.myNick);

  const items: Item[] = [
    { label: 'Můj profil', href: `${prefix}/whoiswho/profile.php?nick=${nick}` },
    { label: 'Moje fotky', href: `${fotoalbaPrefix}/unewest.php?nick=${nick}` },
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
    <div
      className={`xct-user-menu${flatTopLeft ? ' is-flat-tl' : ''}`}
      ref={ref}
      role="menu"
      style={minWidth ? { minWidth: `${minWidth}px` } : undefined}
    >
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
