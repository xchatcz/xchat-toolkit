/**
 * AdminTab – panel „Správce" v Sidebaru. Každý formulář má vlastní
 * tlačítko „Uložit" a toast odezvu.
 *
 * Stránky, které se parsují:
 *   - modchat?op=rightadmin     → předat správcovství, vyhodit, vzít zpět, popisek
 *   - modchat?op=adminpageng    → filtry vstupu, nastavení místnosti, klíče
 *   - room/intro.php?rid=…      → popisek (dlouhý) + podmínky vstupu
 *
 * Seznam klíčů („Seznam povolených a zakázaných uživatelů") se
 * v Sidebaru nezobrazuje – otevírá se samostatný overlay přes
 * odkaz „Klíče v místnosti" na konci tabu.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import type { FormEvent, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

import XChatApi, { XChatUrls } from '../../../../api/XChatApi';
import type {
  AdminKeyEntry,
  AdminPageData,
  RightAdminData,
  RoomContext,
  RoomDetail,
  RoomIntroData,
} from '../../../../api/types';
import { isAdminStar } from '../../../../core/stars';
import { isSuperAdmin } from '../../../../core/superAdmins';
import { toast } from '../../../../core/toast';
import { useRoomStore } from '../../../hooks/useRoomStore';
import { roomStore } from '../../../services/RoomController';
import { ChevronDownIcon } from '../../../icons/IconPalette';
import { starUrl, starTitle } from '../../../utils/xchatIcons';
import './AdminTab.scss';

export interface AdminTabProps {
  ctx: RoomContext;
  onOpenOverlay: (title: string, body: ReactNode) => void;
  /** Přepnout na tab „Online pomoc". */
  onOpenAdminsOnline?: () => void;
}

const AdminTab = ({ ctx, onOpenOverlay, onOpenAdminsOnline }: AdminTabProps) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Data ze 3 stránek:
  const [rightAdmin, setRightAdmin] = useState<RightAdminData | null>(null);
  const [adminPage, setAdminPage] = useState<AdminPageData | null>(null);
  const [intro, setIntro] = useState<RoomIntroData | null>(null);
  // Detail místnosti (stálí správci, dočasný správce) + flag
  // „stálá / uživatelská místnost" (z rooms.php) – nutné pro rozhodnutí,
  // které sekce tabu zobrazit.
  const [roomDetail, setRoomDetail] = useState<RoomDetail | null>(null);
  const [roomPermanent, setRoomPermanent] = useState<boolean | null>(null);

  // Formulářové stavy (editovatelné) – odvozené z načtených dat.
  const [handoverNick, setHandoverNick] = useState('');
  const [kickNick, setKickNick] = useState('');
  const [kickReason, setKickReason] = useState('');
  const [unkickNick, setUnkickNick] = useState('');

  const [timeFilter, setTimeFilter] = useState(0);
  const [certFilter, setCertFilter] = useState<0 | 1>(0);
  const [starFilter, setStarFilter] = useState<0 | 2 | 4 | 8>(0);
  const [sexFilter, setSexFilter] = useState<-1 | 0 | 1>(-1);

  const [locked, setLocked] = useState(false);
  const [nohist, setNohist] = useState(false);
  const [nowhisper, setNowhisper] = useState(false);
  const [phone, setPhone] = useState(false);
  const [lang, setLang] = useState<0 | 1 | 2>(0);

  const [introTitle, setIntroTitle] = useState('');
  const [introDisclaimer, setIntroDisclaimer] = useState('');

  // Zaneprázdněnost jednotlivých formulářů – aby disablovalo jen ten pravý.
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const setBusyFor = (key: string, val: boolean): void =>
    setBusy((prev) => ({ ...prev, [key]: val }));

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ra, ap, ri, rd, rl] = await Promise.all([
        XChatApi.getRightAdmin(ctx.xhash, ctx.rid, ctx.skin),
        XChatApi.getAdminPage(ctx.xhash, ctx.rid, ctx.skin),
        XChatApi.getRoomIntroSettings(ctx.xhash, ctx.rid),
        XChatApi.getRoomDetail(ctx.rid),
        XChatApi.getRoomsList(),
      ]);
      setRightAdmin(ra);
      setAdminPage(ap);
      setIntro(ri);
      setRoomDetail(rd);
      const me = rl.find((r) => r.rid === ctx.rid);
      setRoomPermanent(me?.permanent ?? null);

      setTimeFilter(ap.timeFilter);
      setCertFilter(ap.certFilter);
      setStarFilter(ap.starFilter);
      setSexFilter(ap.sexFilter);

      setLocked(ap.locked);
      setNohist(ap.nohist);
      setNowhisper(ap.nowhisper);
      setPhone(ap.phone);
      setLang(ap.lang);

      setIntroTitle(ri.title);
      setIntroDisclaimer(ri.disclaimer);
    } catch (err) {
      setError(String(err));
      toast.error(`Načtení správcovských dat selhalo: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [ctx.xhash, ctx.rid, ctx.skin]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // ── Handlery formulářů ──────────────────────────────────────────────────

  const handleHandover = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!handoverNick) return;
    setBusyFor('handover', true);
    try {
      await XChatApi.handOverAdmin(ctx.xhash, ctx.rid, ctx.skin, handoverNick);
      toast.success(`Správcovství předáno uživateli ${handoverNick}.`);
      setHandoverNick('');
      await loadAll();
    } catch (err) {
      toast.error(`Předání správcovství selhalo: ${String(err)}`);
    } finally {
      setBusyFor('handover', false);
    }
  };

  const handleHandoverAuto = async (): Promise<void> => {
    setBusyFor('handover', true);
    try {
      await XChatApi.handOverAdmin(ctx.xhash, ctx.rid, ctx.skin, '#');
      toast.success('Správcovství předáno automaticky.');
      await loadAll();
    } catch (err) {
      toast.error(`Automatické předání selhalo: ${String(err)}`);
    } finally {
      setBusyFor('handover', false);
    }
  };

  const handleKick = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!kickNick) return;
    setBusyFor('kick', true);
    try {
      await XChatApi.kickUser(ctx.xhash, ctx.rid, ctx.skin, kickNick, kickReason);
      toast.success(`Uživatel ${kickNick} byl vyhozen.`);
      setKickNick('');
      setKickReason('');
      await loadAll();
    } catch (err) {
      toast.error(`Vyhození selhalo: ${String(err)}`);
    } finally {
      setBusyFor('kick', false);
    }
  };

  const handleUnkick = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!unkickNick) return;
    setBusyFor('unkick', true);
    try {
      await XChatApi.unkickUser(ctx.xhash, ctx.rid, ctx.skin, unkickNick);
      toast.success(`Uživatel ${unkickNick} byl vzat zpět.`);
      setUnkickNick('');
      await loadAll();
    } catch (err) {
      toast.error(`Vzetí zpět selhalo: ${String(err)}`);
    } finally {
      setBusyFor('unkick', false);
    }
  };

  // „Vzít zpět všechny" – pošle do místnosti chat příkaz `/unkickall`.
  // Server příkaz vyhodnotí a vrátí všechny vyhozené zpět.
  const handleUnkickAll = async (): Promise<void> => {
    setBusyFor('unkickAll', true);
    try {
      const { wtkn: cachedWtkn } = roomStore.get();
      const { wtkn } = await XChatApi.sendMessageToRoom(
        ctx.xhash,
        ctx.rid,
        ctx.skin,
        '/unkickall',
        '~',
        cachedWtkn,
      );
      if (wtkn !== cachedWtkn) roomStore.set({ wtkn });
      toast.success('Všichni vyhození byli vzati zpět.');
      await loadAll();
    } catch (err) {
      toast.error(`Vzetí všech zpět selhalo: ${String(err)}`);
    } finally {
      setBusyFor('unkickAll', false);
    }
  };

  const handleFilters = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setBusyFor('filters', true);
    try {
      await XChatApi.saveRoomFilters(ctx.xhash, ctx.rid, ctx.skin, {
        timeFilter,
        certFilter,
        starFilter,
        sexFilter,
      });
      toast.success('Filtry vstupu uloženy.');
    } catch (err) {
      toast.error(`Uložení filtrů selhalo: ${String(err)}`);
    } finally {
      setBusyFor('filters', false);
    }
  };

  const handleRoomSettings = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    setBusyFor('room', true);
    try {
      await XChatApi.saveRoomSettings(ctx.xhash, ctx.rid, ctx.skin, {
        locked,
        nohist,
        nowhisper,
        phone,
        lang,
      });
      toast.success('Nastavení místnosti uloženo.');
    } catch (err) {
      toast.error(`Uložení nastavení selhalo: ${String(err)}`);
    } finally {
      setBusyFor('room', false);
    }
  };

  // Rychlý přepínač zámku z „Další volby" – uloží i ostatní stávající
  // hodnoty z formuláře „Základní nastavení" (saveRoomSettings je atomické).
  const handleToggleLock = async (): Promise<void> => {
    setBusyFor('lockToggle', true);
    const next = !locked;
    try {
      await XChatApi.saveRoomSettings(ctx.xhash, ctx.rid, ctx.skin, {
        locked: next,
        nohist,
        nowhisper,
        phone,
        lang,
      });
      setLocked(next);
      toast.success(next ? 'Místnost zamknuta.' : 'Místnost odemknuta.');
    } catch (err) {
      toast.error(`Změna stavu zámku selhala: ${String(err)}`);
    } finally {
      setBusyFor('lockToggle', false);
    }
  };

  const handleIntro = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!intro) return;
    setBusyFor('intro', true);
    try {
      await XChatApi.saveRoomIntro(ctx.xhash, ctx.rid, {
        title: introTitle,
        disclaimer: introDisclaimer,
        pass: intro.pass,
        captcha: intro.captcha,
        fontcolor: intro.fontcolor,
        color: intro.color,
        image: intro.image,
      });
      toast.success('Popisek a podmínky uloženy.');
      // Popisek se objevuje i v rightAdmin – znovu načteme, ať je v sync.
      await loadAll();
    } catch (err) {
      toast.error(`Uložení popisku/podmínek selhalo: ${String(err)}`);
    } finally {
      setBusyFor('intro', false);
    }
  };

  const openKeysOverlay = (): void => {
    onOpenOverlay(
      'Klíče v místnosti',
      <AdminKeysOverlay ctx={ctx} initialKeys={adminPage?.keys ?? []} />,
    );
  };

  // Hvězdičku přihlášeného uživatele má už RoomController v roomStore
  // (z loadAdminPermissions) – ber ji rovnou odtud, žádný extra fetch.
  const { myStar } = useRoomStore();

  // Role v aktuální místnosti – rozhodují, které sekce tabu zobrazit.
  // Pravidla:
  //   - Superadmin / admin (hvězdička ≥ zelená) / stálý správce této místnosti
  //     → vidí úplně všechno.
  //   - Dočasný správce (room.admin == myNick) bez výše uvedeného:
  //       • ve stálé místnosti vidí jen Vyhodit, Klíče, Vzít zpět, Předat.
  //       • v uživatelské (nestálé) místnosti vidí všechno.
  const { showAllSections, isXChatAdmin } = useMemo(() => {
    const myNickLc = (ctx.myNick ?? '').toLowerCase();
    const superAdmin = isSuperAdmin(ctx.myNick);
    const highStar = isAdminStar(myStar);
    const isPermAdmin =
      !!roomDetail &&
      roomDetail.permanentAdmins.some((n) => n.toLowerCase() === myNickLc) &&
      myNickLc !== '';
    const isRoomAdmin =
      !!roomDetail &&
      (roomDetail.admin ?? '').toLowerCase() === myNickLc &&
      myNickLc !== '';
    // Dokud neznáme „permanent" flag místnosti, raději ukážeme všechno –
    // lepší než falešně skrýt stálému správci.
    const isUserRoom = roomPermanent === false;
    const privileged = superAdmin || highStar || isPermAdmin;
    const onlyTempAdmin = isRoomAdmin && !privileged;
    // Omezený pohled: dočasný správce, ve stálé místnosti, bez ostatních rolí.
    const limited = onlyTempAdmin && !isUserRoom;
    return {
      showAllSections: !limited,
      // „Administrátor XChatu" = zelená/žlutá/červená/černá hvězdička nebo superadmin.
      isXChatAdmin: superAdmin || highStar,
    };
  }, [ctx.myNick, myStar, roomDetail, roomPermanent]);

  // ── Render ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="xct-tab xct-admintab">
        <div className="xct-admintab__loading">Načítám správcovský panel…</div>
      </div>
    );
  }

  if (error || !rightAdmin || !adminPage || !intro) {
    return (
      <div className="xct-tab xct-admintab">
        <div className="xct-admintab__error">{error ?? 'Nepodařilo se načíst data.'}</div>
      </div>
    );
  }

  return (
    <div className="xct-tab xct-admintab">
      {/* Vyhodit (rightadmin) – vždy rozbalená. */}
      <Section title="Vyhodit uživatele" defaultOpen={!isXChatAdmin}>
        <form className="xct-admintab__form" onSubmit={handleKick}>
          <label
            className="xct-admintab__label xct-admintab__label--block"
            htmlFor="xct-admin-kick"
          >
            Uživatel
          </label>
          <select
            id="xct-admin-kick"
            className="xct-admintab__select"
            value={kickNick}
            onChange={(e) => setKickNick(e.target.value)}
            disabled={busy.kick}
          >
            <option value="">Vyberte uživatele…</option>
            {rightAdmin.kickCandidates.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <label
            className="xct-admintab__label xct-admintab__label--block"
            htmlFor="xct-admin-kick-reason"
          >
            Důvod vyhození
          </label>
          <input
            id="xct-admin-kick-reason"
            className="xct-admintab__input"
            type="text"
            value={kickReason}
            onChange={(e) => setKickReason(e.target.value)}
            disabled={busy.kick}
          />
          <div className="xct-admintab__actions">
            <button
              type="submit"
              className="xct-btn xct-btn--block"
              disabled={busy.kick || !kickNick}
            >
              Vyhodit
            </button>
          </div>
        </form>
      </Section>

      {/* Další volby – tlačítka pro otevření overlayů a externích odkazů.
         Default rozbalená. */}
      <Section title="Další volby" defaultOpen>
        <div className="xct-admintab__buttons">
          <button
            type="button"
            className="xct-btn xct-btn--block xct-btn--large xct-admintab__keys-btn"
            onClick={openKeysOverlay}
          >
            Klíče v místnosti ({adminPage.keys.length})
          </button>
          {onOpenAdminsOnline ? (
            <button
              type="button"
              className="xct-btn xct-btn--block xct-btn--large xct-admintab__keys-btn"
              onClick={onOpenAdminsOnline}
            >
              Pomoc online
            </button>
          ) : null}
          <button
            type="button"
            className="xct-btn xct-btn--block xct-btn--large xct-admintab__keys-btn"
            onClick={() => void handleToggleLock()}
            disabled={busy.lockToggle}
          >
            {locked ? 'Odemknout místnost' : 'Zamknout místnost'}
          </button>
          <a
            className="xct-btn xct-btn--block xct-btn--large xct-admintab__keys-btn"
            href={`${XChatUrls.hashPrefix(ctx.xhash)}/admin/`}
            target="_blank"
            rel="noreferrer"
          >
            Administrace
          </a>
        </div>
      </Section>

      {/* Základní nastavení (adminpageng) – pod „Vyhodit uživatele".
         Default open: jsem-li administrátor XChatu (zelená+ hvězdička). */}
      {showAllSections ? (
        <Section title="Základní nastavení" defaultOpen={isXChatAdmin}>
          <form className="xct-admintab__form" onSubmit={handleRoomSettings}>
            <label className="xct-admintab__checkbox-row">
              <input
                type="checkbox"
                checked={locked}
                onChange={(e) => setLocked(e.target.checked)}
                disabled={busy.room}
              />
              Místnost je zamknutá
            </label>
            <label className="xct-admintab__checkbox-row">
              <input
                type="checkbox"
                checked={nohist}
                onChange={(e) => setNohist(e.target.checked)}
                disabled={busy.room}
              />
              Nezobrazovat historii
            </label>
            <label className="xct-admintab__checkbox-row">
              <input
                type="checkbox"
                checked={nowhisper}
                onChange={(e) => setNowhisper(e.target.checked)}
                disabled={busy.room}
              />
              Zakázat šeptání
            </label>
            <label className="xct-admintab__checkbox-row">
              <input
                type="checkbox"
                checked={phone}
                onChange={(e) => setPhone(e.target.checked)}
                disabled={busy.room}
              />
              Jen s ověřeným telefonem
            </label>
            <div className="xct-admintab__label xct-admintab__label--block">
              Jazyk v místnosti:
            </div>
            <div className="xct-admintab__radio-group">
              {([
                [0, 'CZ'],
                [1, 'US'],
                [2, 'SK'],
              ] as const).map(([val, label]) => (
                <label key={val} className="xct-admintab__checkbox-row">
                  <input
                    type="radio"
                    name="xct-admin-lang"
                    checked={lang === val}
                    onChange={() => setLang(val)}
                    disabled={busy.room}
                  />
                  {label}
                </label>
              ))}
            </div>
            <div className="xct-admintab__actions">
              <button type="submit" className="xct-btn xct-btn--block" disabled={busy.room}>
                Uložit
              </button>
            </div>
          </form>
        </Section>
      ) : null}

      {/* Vzít zpět – default rozbalená, je-li koho vzít zpět (≥ 1). */}
      <Section
        title="Vzít uživatele zpět"
        defaultOpen={rightAdmin.unkickCandidates.length >= 1}
      >
        <form className="xct-admintab__form" onSubmit={handleUnkick}>
          <label
            className="xct-admintab__label xct-admintab__label--block"
            htmlFor="xct-admin-unkick"
          >
            Uživatel
          </label>
          <select
            id="xct-admin-unkick"
            className="xct-admintab__select"
            value={unkickNick}
            onChange={(e) => setUnkickNick(e.target.value)}
            disabled={busy.unkick || rightAdmin.unkickCandidates.length === 0}
          >
            <option value="">
              {rightAdmin.unkickCandidates.length === 0
                ? 'Nikoho nelze vzít zpět'
                : 'Vyberte uživatele…'}
            </option>
            {rightAdmin.unkickCandidates.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <div className="xct-admintab__actions xct-admintab__actions--stack">
            <button
              type="submit"
              className="xct-btn xct-btn--block"
              disabled={busy.unkick || !unkickNick}
            >
              Vzít vybraného zpět
            </button>
            <button
              type="button"
              className="xct-btn xct-btn--ghost xct-btn--block"
              onClick={() => void handleUnkickAll()}
              disabled={busy.unkickAll || rightAdmin.unkickCandidates.length === 0}
            >
              Vzít zpět všechny
            </button>
          </div>
        </form>
      </Section>

      {/* Předat správcovství – default zabalená. */}
      <Section title="Předat správcovství">
        <form className="xct-admintab__form" onSubmit={handleHandover}>
          <label
            className="xct-admintab__label xct-admintab__label--block"
            htmlFor="xct-admin-handover"
          >
            Nový správce
          </label>
          <select
            id="xct-admin-handover"
            className="xct-admintab__select"
            value={handoverNick}
            onChange={(e) => setHandoverNick(e.target.value)}
            disabled={busy.handover}
          >
            <option value="">Vyberte uživatele…</option>
            {rightAdmin.newAdminCandidates.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <div className="xct-admintab__actions xct-admintab__actions--stack">
            <button
              type="submit"
              className="xct-btn xct-btn--block"
              disabled={busy.handover || !handoverNick}
            >
              Předat
            </button>
            <button
              type="button"
              className="xct-btn xct-btn--ghost xct-btn--block"
              onClick={() => void handleHandoverAuto()}
              disabled={busy.handover}
            >
              Předat automaticky
            </button>
          </div>
        </form>
      </Section>

      {showAllSections ? (
        <>
          {/* Popisek + podmínky vstupu (room/intro.php) – default zabalená. */}
          <Section title="Před vstupem">
            <form className="xct-admintab__form" onSubmit={handleIntro}>
              <label
                className="xct-admintab__label xct-admintab__label--block"
                htmlFor="xct-admin-title"
              >
                Popisek (max 50 znaků)
              </label>
              <input
                id="xct-admin-title"
                className="xct-admintab__input"
                type="text"
                maxLength={50}
                value={introTitle}
                onChange={(e) => setIntroTitle(e.target.value)}
                disabled={busy.intro}
              />
              <label
                className="xct-admintab__label xct-admintab__label--block"
                htmlFor="xct-admin-disclaimer"
              >
                Podmínky pro vstup
              </label>
              <textarea
                id="xct-admin-disclaimer"
                className="xct-admintab__textarea"
                value={introDisclaimer}
                onChange={(e) => setIntroDisclaimer(e.target.value)}
                disabled={busy.intro}
              />
              <div className="xct-admintab__actions">
                <button type="submit" className="xct-btn xct-btn--block" disabled={busy.intro}>
                  Uložit
                </button>
              </div>
            </form>
          </Section>

          {/* Filtry vstupu (adminpageng) – default zabalená. */}
          <Section title="Filtry pro vstup">
            <form className="xct-admintab__form" onSubmit={handleFilters}>
              <label
                className="xct-admintab__label xct-admintab__label--block"
                htmlFor="xct-admin-time"
              >
                Min. minut online
              </label>
              <input
                id="xct-admin-time"
                className="xct-admintab__input"
                type="number"
                min={0}
                value={timeFilter}
                onChange={(e) => setTimeFilter(Math.max(0, Number(e.target.value) || 0))}
                disabled={busy.filters}
              />
              <label
                className="xct-admintab__label xct-admintab__label--block"
                htmlFor="xct-admin-cert"
              >
                Mohou sem
              </label>
              <select
                id="xct-admin-cert"
                className="xct-admintab__select"
                value={certFilter}
                onChange={(e) => setCertFilter(Number(e.target.value) === 1 ? 1 : 0)}
                disabled={busy.filters}
              >
                <option value={0}>všichni</option>
                <option value={1}>certifikovaní</option>
              </select>
              <label
                className="xct-admintab__label xct-admintab__label--block"
                htmlFor="xct-admin-star"
              >
                Hvězdičky
              </label>
              <select
                id="xct-admin-star"
                className="xct-admintab__select"
                value={starFilter}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setStarFilter(v === 2 || v === 4 || v === 8 ? (v as 2 | 4 | 8) : 0);
                }}
                disabled={busy.filters}
              >
                <option value={0}>všichni</option>
                <option value={2}>jen modré a vyšší</option>
                <option value={4}>jen zelené a vyšší</option>
                <option value={8}>jen žluté a vyšší</option>
              </select>
              <label
                className="xct-admintab__label xct-admintab__label--block"
                htmlFor="xct-admin-sex"
              >
                Pohlaví
              </label>
              <select
                id="xct-admin-sex"
                className="xct-admintab__select"
                value={sexFilter}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setSexFilter(v === 0 || v === 1 ? (v as 0 | 1) : -1);
                }}
                disabled={busy.filters}
              >
                <option value={-1}>všichni</option>
                <option value={0}>muži</option>
                <option value={1}>ženy</option>
              </select>
              <div className="xct-admintab__actions">
                <button type="submit" className="xct-btn xct-btn--block" disabled={busy.filters}>
                  Uložit
                </button>
              </div>
            </form>
          </Section>
        </>
      ) : null}
    </div>
  );
};

export default AdminTab;

// ─── Pomocná komponenta: rozbalovací sekce s animovaným zobáčkem ──────────

interface SectionProps {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

const Section = ({ title, defaultOpen = false, children }: SectionProps) => (
  <details className="xct-admintab__section" open={defaultOpen}>
    <summary className="xct-admintab__section-summary">
      <span className="xct-admintab__section-chevron" aria-hidden="true">
        <ChevronDownIcon width={14} height={14} />
      </span>
      <span className="xct-admintab__legend">{title}</span>
    </summary>
    <div className="xct-admintab__section-body">{children}</div>
  </details>
);

// ─── Overlay „Klíče v místnosti" ───────────────────────────────────────────

interface AdminKeysOverlayProps {
  ctx: RoomContext;
  initialKeys: AdminKeyEntry[];
}

const AdminKeysOverlay = ({ ctx, initialKeys }: AdminKeysOverlayProps) => {
  const [keys, setKeys] = useState<AdminKeyEntry[]>(initialKeys);
  const [addNick, setAddNick] = useState('');
  const [addAction, setAddAction] = useState<'g' | 'b'>('b');
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const setBusyFor = (key: string, val: boolean): void =>
    setBusy((prev) => ({ ...prev, [key]: val }));

  const refresh = useCallback(async () => {
    try {
      const ap = await XChatApi.getAdminPage(ctx.xhash, ctx.rid, ctx.skin);
      setKeys(ap.keys);
    } catch (err) {
      toast.error(`Obnovení seznamu klíčů selhalo: ${String(err)}`);
    }
  }, [ctx.xhash, ctx.rid, ctx.skin]);

  const handleAdd = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    const nick = addNick.trim();
    if (!nick) return;
    setBusyFor('add', true);
    try {
      await XChatApi.addRoomKey(ctx.xhash, ctx.rid, ctx.skin, nick, addAction);
      toast.success(
        addAction === 'g'
          ? `${nick} přidán mezi povolené.`
          : `${nick} přidán mezi zakázané.`,
      );
      setAddNick('');
      await refresh();
    } catch (err) {
      toast.error(`Přidání klíče selhalo: ${String(err)}`);
    } finally {
      setBusyFor('add', false);
    }
  };

  const handleModify = async (nick: string, action: 'g' | 'b' | 'r'): Promise<void> => {
    setBusyFor(nick, true);
    try {
      await XChatApi.modifyRoomKey(ctx.xhash, ctx.rid, ctx.skin, nick, action);
      const msg =
        action === 'r'
          ? `${nick} odebrán ze seznamu.`
          : action === 'g'
            ? `${nick} je nyní povolený.`
            : `${nick} je nyní zakázaný.`;
      toast.success(msg);
      await refresh();
    } catch (err) {
      toast.error(`Změna klíče selhala: ${String(err)}`);
    } finally {
      setBusyFor(nick, false);
    }
  };

  return (
    <div className="xct-admin-keys">
      <form className="xct-admin-keys__add" onSubmit={handleAdd}>
        <h4 className="xct-admin-keys__legend">Přidat uživatele na seznam</h4>
        <div className="xct-admin-keys__row">
          <input
            className="xct-admin-keys__input"
            type="text"
            placeholder="Nick"
            value={addNick}
            onChange={(e) => setAddNick(e.target.value)}
            disabled={busy.add}
            autoComplete="off"
            maxLength={32}
          />
          <label className="xct-admintab__checkbox-row">
            <input
              type="radio"
              name="xct-keys-add-action"
              checked={addAction === 'g'}
              onChange={() => setAddAction('g')}
              disabled={busy.add}
            />
            Povolený
          </label>
          <label className="xct-admintab__checkbox-row">
            <input
              type="radio"
              name="xct-keys-add-action"
              checked={addAction === 'b'}
              onChange={() => setAddAction('b')}
              disabled={busy.add}
            />
            Zakázaný
          </label>
          <button
            type="submit"
            className="xct-btn"
            disabled={busy.add || !addNick.trim()}
          >
            Uložit
          </button>
        </div>
      </form>

      {keys.length === 0 ? (
        <div className="xct-admin-keys__empty">Seznam je prázdný.</div>
      ) : (
        <table className="xct-admin-keys__table">
          <thead>
            <tr>
              <th>Uživatel</th>
              <th>Povolený</th>
              <th>Zakázaný</th>
              <th>Odebrat</th>
              <th>Upravoval</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <AdminKeyRow
                key={k.nick}
                entry={k}
                busy={!!busy[k.nick]}
                onCommit={(action) => void handleModify(k.nick, action)}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

interface AdminKeyRowProps {
  entry: AdminKeyEntry;
  busy: boolean;
  onCommit: (action: 'g' | 'b' | 'r') => void;
}

const AdminKeyRow = ({ entry, busy, onCommit }: AdminKeyRowProps) => {
  const [action, setAction] = useState<'g' | 'b' | 'r'>(entry.action);
  const radioName = `xct-key-${entry.nick}`;
  // Provoz (šedá hvězdička g.gif) má vlastní ikonku a title, jinak
  // použijeme klasické barevné hvězdičky ze `starUrl`.
  const superAdmin = entry.modifierSuperAdmin;
  const starSrc = superAdmin
    ? 'https://ximg.cz/x4/star/g.gif'
    : starUrl(entry.modifierStar);
  const starAlt = superAdmin ? 'Provoz' : starTitle(entry.modifierStar);
  const showStar = superAdmin || entry.modifierStar > 0;
  return (
    <tr>
      <td className="xct-admin-keys__nick">{entry.nick}</td>
      <td className="xct-admin-keys__radio">
        <input
          type="radio"
          name={radioName}
          checked={action === 'g'}
          onChange={() => setAction('g')}
          disabled={busy}
        />
      </td>
      <td className="xct-admin-keys__radio">
        <input
          type="radio"
          name={radioName}
          checked={action === 'b'}
          onChange={() => setAction('b')}
          disabled={busy}
        />
      </td>
      <td className="xct-admin-keys__radio">
        <input
          type="radio"
          name={radioName}
          checked={action === 'r'}
          onChange={() => setAction('r')}
          disabled={busy}
        />
      </td>
      <td className="xct-admin-keys__mod">
        {showStar ? (
          <img
            src={starSrc}
            alt={starAlt}
            title={starAlt}
            width={11}
            height={10}
          />
        ) : null}
        {entry.modifiedBy || '—'}
      </td>
      <td className="xct-admin-keys__action">
        <button
          type="button"
          className="xct-btn"
          onClick={() => onCommit(action)}
          disabled={busy}
        >
          Provést
        </button>
      </td>
    </tr>
  );
};
