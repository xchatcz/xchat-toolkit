/**
 * InfoStrip – proužek nad formulářem (info z op=infopage) + klikatelný
 * název místnosti, který otevře overlay s detailem místnosti.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useEffect, useState, type ReactNode } from 'react';
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

const InfoStrip = ({ ctx, userCount, onOpenOverlay }: InfoStripProps) => {
  const [html, setHtml] = useState<string>('');

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

  const openDetails = (): void => {
    onOpenOverlay(
      `Informace o místnosti: ${ctx.roomName}`,
      <RoomDetailsPanel ctx={ctx} userCount={userCount} />,
    );
  };

  return (
    <div className="xct-infostrip">
      <button
        type="button"
        className="xct-infostrip__name"
        onClick={openDetails}
        title="Zobrazit detail místnosti"
      >
        {ctx.roomName}
      </button>
      <div className="xct-infostrip__inner" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
};

export default InfoStrip;
