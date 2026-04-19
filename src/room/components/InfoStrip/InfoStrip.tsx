/**
 * InfoStrip – proužek nad formulářem (info z op=infopage).
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useEffect, useState } from 'react';
import type { RoomContext } from '../../../api/types';
import { XChatHttp, XChatUrls } from '../../../api/XChatApi';
import { requestQue } from '../../services/RequestQue';
import './InfoStrip.scss';

export interface InfoStripProps {
  ctx: RoomContext;
}

const InfoStrip = ({ ctx }: InfoStripProps) => {
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

  return (
    <div className="xct-infostrip">
      <div className="xct-infostrip__inner" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
};

export default InfoStrip;
