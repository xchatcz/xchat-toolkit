/**
 * RoomDetailsPanel – obsah overlay „Informace o místnosti".
 *
 * Otevírá se kliknutím na název místnosti v {@link InfoStrip}. Vedle
 * metadat z dialogu `op=roominfo` (kategorie, popis, jazyk, správce,
 * filtry…) zobrazuje i RID, aktuální počet uživatelů v místnosti (známe
 * z {@link useRoomStore}) a datum založení ze `scripts/room.php`.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useEffect, useState } from 'react';
import type { RoomContext, RoomDetail, RoomInfoDialog } from '../../../api/types';
import { XChatApi } from '../../../api/XChatApi';
import './RoomDetailsPanel.scss';

export interface RoomDetailsPanelProps {
  ctx: RoomContext;
  /** Aktuální počet uživatelů v místnosti – přebíráme z UsersStore. */
  userCount: number;
}

/** Formátování unixového timestampu do `d. M. YYYY HH:MM`. */
const formatCreatedAt = (ts: number | null): string => {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const RoomDetailsPanel = ({ ctx, userCount }: RoomDetailsPanelProps) => {
  const [info, setInfo] = useState<RoomInfoDialog | null>(null);
  const [detail, setDetail] = useState<RoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      XChatApi.getRoomInfoDialog(ctx.xhash, ctx.rid),
      XChatApi.getRoomDetail(ctx.rid),
    ])
      .then(([i, d]) => {
        if (cancelled) return;
        setInfo(i);
        setDetail(d);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ctx.xhash, ctx.rid]);

  if (loading) return <div className="xct-roomdetails__loading">Načítám…</div>;
  if (error) return <div className="xct-roomdetails__error">Chyba: {error}</div>;

  const name = info?.name || ctx.roomName;

  return (
    <div className="xct-roomdetails">
      <dl className="xct-roomdetails__grid">
        <dt>Název</dt>
        <dd>{name}</dd>

        <dt>RID</dt>
        <dd className="xct-roomdetails__mono">{ctx.rid}</dd>

        <dt>Počet uživatelů</dt>
        <dd>{userCount}</dd>

        <dt>Založena</dt>
        <dd>{formatCreatedAt(detail?.createdAt ?? null)}</dd>

        {info?.category ? (
          <>
            <dt>Kategorie</dt>
            <dd>{info.category}</dd>
          </>
        ) : null}

        {info?.descriptionHtml ? (
          <>
            <dt>Popis</dt>
            <dd
              className="xct-roomdetails__desc"
              dangerouslySetInnerHTML={{ __html: info.descriptionHtml }}
            />
          </>
        ) : null}

        {info?.language ? (
          <>
            <dt>Jazyk</dt>
            <dd>{info.language}</dd>
          </>
        ) : null}

        {info?.admin ? (
          <>
            <dt>Správce</dt>
            <dd>{info.admin}</dd>
          </>
        ) : null}

        {info?.permanentAdmin ? (
          <>
            <dt>Stálý správce</dt>
            <dd>{info.permanentAdmin}</dd>
          </>
        ) : null}

        {info?.forum ? (
          <>
            <dt>Fórum místnosti</dt>
            <dd>
              <a
                href={info.forum.href}
                target="_blank"
                rel="noreferrer noopener"
                className="xct-roomdetails__link"
              >
                {info.forum.label}
              </a>
            </dd>
          </>
        ) : null}

        {info?.meetings ? (
          <>
            <dt>Srazy místnosti</dt>
            <dd>{info.meetings}</dd>
          </>
        ) : null}
      </dl>

      {info ? (
        <>
          <h3 className="xct-roomdetails__section">Filtry: kdo může do místnosti</h3>
          <dl className="xct-roomdetails__grid">
            <dt>Nachatovaných minut</dt>
            <dd>{info.filters.minutes || '—'}</dd>

            <dt>Mohou sem</dt>
            <dd>{info.filters.allowed || '—'}</dd>

            <dt>Hvězdičky</dt>
            <dd>{info.filters.stars || '—'}</dd>

            <dt>Pohlaví</dt>
            <dd>{info.filters.sex || '—'}</dd>

            <dt>Telefon</dt>
            <dd>{info.filters.phone || '—'}</dd>
          </dl>
        </>
      ) : null}
    </div>
  );
};

export default RoomDetailsPanel;
