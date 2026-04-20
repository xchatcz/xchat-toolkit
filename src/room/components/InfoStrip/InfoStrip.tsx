/**
 * InfoStrip – proužek nad formulářem (info z op=infopage).
 *
 * Odchytává klik na existující odkaz `<a href="javascript:roominfo(rid)">`
 * (uvnitř vráceného HTML) a otevírá overlay s detailem místnosti – místo
 * aby spouštěl původní XChat JS (ten v naší React stránce beztak neexistuje).
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import type { RoomContext } from '../../../api/types';
import { XChatHttp, XChatUrls } from '../../../api/XChatApi';
import { requestQue } from '../../services/RequestQue';
import RoomDetailsPanel from '../RoomDetailsPanel/RoomDetailsPanel';
import './InfoStrip.scss';

export interface InfoStripProps {
  ctx: RoomContext;
  /** Aktuální počet uživatelů (zobrazí se v overlay). */
  userCount: number;
  /** Otevření overlay nad MessageBoard (řídí App.tsx). */
  onOpenOverlay: (title: string, body: ReactNode) => void;
}

/** Z `href="javascript:roominfo(123)"` vytáhne číslo (nebo null). */
const parseRoominfoHref = (href: string | null): number | null => {
  if (!href) return null;
  const m = href.match(/roominfo\((\d+)\)/i);
  return m ? Number(m[1]) : null;
};

const InfoStrip = ({ ctx, userCount, onOpenOverlay }: InfoStripProps) => {
  const [html, setHtml] = useState<string>('');
  // Drží nejnovější `onOpenOverlay` / props, aby si delegovaný handler
  // vždy četl aktuální hodnoty, i když se komponenta rerenderne.
  const propsRef = useRef({ ctx, userCount, onOpenOverlay });
  propsRef.current = { ctx, userCount, onOpenOverlay };

  useEffect(() => {
    const stop = requestQue.every(
      15_000,
      async () => {
        const doc = await XChatHttp.fetchDocument(
          XChatUrls.roomInfoPage(ctx.xhash, ctx.rid, ctx.skin, ctx.roomName),
        );
        const body = doc.body?.innerHTML ?? '';
        setHtml(body);
      },
      'room-info',
    );
    return stop;
  }, [ctx.xhash, ctx.rid, ctx.skin, ctx.roomName]);

  // Event delegace na kontejneru – chytí kliky na <a href="javascript:roominfo(…)">.
  const handleClick = (e: MouseEvent<HTMLDivElement>): void => {
    const link = (e.target as HTMLElement).closest('a');
    if (!link) return;
    const rid = parseRoominfoHref(link.getAttribute('href'));
    if (rid == null) return;
    // Náš React kontext – ignorujeme RID z href a použijeme ten z ctx
    // (stejná místnost), aby sedělo `roomName`/`userCount` bez dalšího
    // parsování. V praxi `roominfo(rid)` vždy odkazuje na aktuální místnost.
    e.preventDefault();
    e.stopPropagation();
    const { ctx: c, userCount: uc, onOpenOverlay: open } = propsRef.current;
    open(
      `Informace o místnosti: ${c.roomName}`,
      <RoomDetailsPanel ctx={c} userCount={uc} />,
    );
  };

  return (
    <div className="xct-infostrip">
      <div
        className="xct-infostrip__inner"
        onClick={handleClick}
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
};

export default InfoStrip;
