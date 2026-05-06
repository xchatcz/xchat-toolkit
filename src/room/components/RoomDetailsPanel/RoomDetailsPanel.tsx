/**
 * RoomDetailsPanel – overlay „Informace o místnosti".
 *
 * Stejná grafika jako {@link RoomsOverlay} – spodní polovina MessageBoardu,
 * hlavička barvou MessageFormu. Obsah je rozdělen na dva sloupce:
 *   vlevo  … stávající metadata (název, RID, počet uživatelů, založena,
 *            kategorie, popis, jazyk, správce, filtry…),
 *   vpravo … pravidla / podmínky vstupu (sexwarn + disclaimer + omezení).
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useEffect, useState } from 'react';
import type { RoomContext, RoomDetail, RoomInfoDialog } from '../../../api/types';
import { XChatApi } from '../../../api/XChatApi';
import { CloseIcon } from '../../icons/IconPalette';
import './RoomDetailsPanel.scss';

export interface RoomDetailsPanelProps {
  ctx: RoomContext;
  /** Aktuální počet uživatelů v místnosti – přebíráme z UsersStore. */
  userCount: number;
  onClose: () => void;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Formátování unixového timestampu jako `d.m.Y H:i`. */
const formatCreatedAt = (ts: number | null): string => {
  if (!ts) return '—';
  const d = new Date(ts * 1000);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

/**
 * Spočítá stáří v letech / měsících / dnech a vrátí jeden údaj
 * s českým skloňováním.
 */
const formatAge = (ts: number | null): string | null => {
  if (!ts) return null;
  const now = Date.now() / 1000;
  const secs = Math.max(0, now - ts);
  const days = Math.floor(secs / 86400);
  if (days <= 0) return 'dnes';

  const years = Math.floor(days / 365.25);
  if (years >= 1) {
    if (years === 1) return '1 rok';
    if (years >= 2 && years <= 4) return `${years} roky`;
    return `${years} let`;
  }
  const months = Math.floor(days / 30.44);
  if (months >= 1) {
    if (months === 1) return '1 měsíc';
    if (months >= 2 && months <= 4) return `${months} měsíce`;
    return `${months} měsíců`;
  }
  if (days === 1) return '1 den';
  if (days >= 2 && days <= 4) return `${days} dny`;
  return `${days} dní`;
};

const RoomDetailsPanel = ({ ctx, userCount, onClose }: RoomDetailsPanelProps) => {
  const [info, setInfo] = useState<RoomInfoDialog | null>(null);
  const [detail, setDetail] = useState<RoomDetail | null>(null);
  const [rulesHtml, setRulesHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Esc zavře overlay.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      XChatApi.getRoomInfoDialog(ctx.xhash, ctx.rid),
      XChatApi.getRoomDetail(ctx.rid),
      XChatApi.getRoomRules(ctx.rid),
    ])
      .then(([i, d, r]) => {
        if (cancelled) return;
        setInfo(i);
        setDetail(d);
        setRulesHtml(r);
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

  const name = info?.name || ctx.roomName;
  const createdAt = detail?.createdAt ?? null;
  const age = formatAge(createdAt);
  const createdLabel =
    createdAt != null
      ? `${formatCreatedAt(createdAt)}${age ? ` (${age})` : ''}`
      : '—';

  return (
    <div className="xct-roominfo-overlay" role="dialog" aria-label="Informace o místnosti">
      <header className="xct-roominfo-overlay__header">
        <h2 className="xct-roominfo-overlay__title">
          Informace o místnosti
          {name ? (
            <span className="xct-roominfo-overlay__room-name">– {name}</span>
          ) : null}
        </h2>
        <button
          type="button"
          className="xct-roominfo-overlay__close"
          onClick={onClose}
          aria-label="Zavřít"
          title="Zavřít (Esc)"
        >
          <CloseIcon width={16} height={16} />
        </button>
      </header>

      <div className="xct-roominfo-overlay__scroll">
        {loading ? (
          <div className="xct-roominfo-overlay__hint">Načítám…</div>
        ) : error ? (
          <div className="xct-roominfo-overlay__error">Chyba: {error}</div>
        ) : (
          <div className="xct-roominfo-overlay__cols">
            {/* ─── Levý sloupec – metadata + filtry ──────────────────── */}
            <section className="xct-roominfo-overlay__col">
              <dl className="xct-roominfo-overlay__grid">
                <dt>Název</dt>
                <dd>{name}</dd>

                <dt>RID</dt>
                <dd className="xct-roominfo-overlay__mono">{ctx.rid}</dd>

                <dt>Počet uživatelů</dt>
                <dd>{userCount}</dd>

                <dt>Založena</dt>
                <dd>{createdLabel}</dd>

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
                      className="xct-roominfo-overlay__desc"
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
                        className="xct-roominfo-overlay__link"
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

                {detail?.www ? (
                  <>
                    <dt>WWW</dt>
                    <dd>
                      <a
                        href={detail.www}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="xct-roominfo-overlay__link"
                      >
                        {detail.www}
                      </a>
                    </dd>
                  </>
                ) : null}

                {detail?.map ? (
                  <>
                    <dt>Mapa</dt>
                    <dd>
                      <a
                        href={detail.map}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="xct-roominfo-overlay__link"
                      >
                        {detail.map}
                      </a>
                    </dd>
                  </>
                ) : null}
              </dl>

              {info ? (
                <>
                  <h3 className="xct-roominfo-overlay__section">
                    Filtry: kdo může do místnosti
                  </h3>
                  <dl className="xct-roominfo-overlay__grid">
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
            </section>

            {/* ─── Pravý sloupec – pravidla ──────────────────────────── */}
            <section className="xct-roominfo-overlay__col">
              <h3 className="xct-roominfo-overlay__section">Pravidla místnosti</h3>
              {rulesHtml ? (
                <div
                  className="xct-roominfo-overlay__rules"
                  dangerouslySetInnerHTML={{ __html: rulesHtml }}
                />
              ) : (
                <div className="xct-roominfo-overlay__hint xct-roominfo-overlay__hint--muted">
                  -
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default RoomDetailsPanel;
