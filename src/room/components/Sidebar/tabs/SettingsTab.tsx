/**
 * SettingsTab – rychlé nastavení místnosti v Sidebaru.
 *
 * Zkrácená verze voleb z Options (RoomSection). Popisky nad polem
 * (úzký Sidebar), u checkboxů inline. Barvy šeptů / mého nicku zůstávají
 * jen v Options – v Sidebaru se nevejdou.
 *
 * Ukládání je explicitní – uživatel změny potvrzuje tlačítkem „Uložit".
 * Po uložení se zobrazí toast success; pokud se měnil skin, navíc toast
 * warning s výzvou k reloadu okna (skin se aplikuje až po novém načtení).
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import type { FormEvent, MouseEvent } from 'react';
import { useEffect, useState } from 'react';

import { XChatUrls } from '../../../../api/XChatApi';
import type { RoomContext } from '../../../../api/types';
import { toast } from '../../../../core/toast';
import type { RoomOptions } from '../../../../features/Room/RoomApp';
import { SKINS } from '../../../skins/palettes';
import './SettingsTab.scss';

export interface SettingsTabProps {
  ctx: RoomContext;
  options: RoomOptions;
  onSetOption: <K extends keyof RoomOptions>(key: K, value: RoomOptions[K]) => void;
}

const INTERVALS: ReadonlyArray<5 | 10 | 15> = [5, 10, 15];
const TABS: ReadonlyArray<{ id: RoomOptions['defaultSidebarTab']; label: string }> = [
  { id: 'users', label: 'Uživatelé' },
  { id: 'smilies', label: 'Smajlíci' },
  { id: 'settings', label: 'Nastavení' },
  { id: 'ignore', label: 'Ignorace' },
  { id: 'admin', label: 'Správa' },
];
const ORDERS: ReadonlyArray<{ id: RoomOptions['messageOrder']; label: string }> = [
  { id: 'newest-first', label: 'Nejnovější nahoře' },
  { id: 'newest-last', label: 'Nejnovější dole' },
];
const FONTS: ReadonlyArray<{ id: RoomOptions['fontFamily']; label: string }> = [
  { id: 'sans', label: 'Bezpatkové' },
  { id: 'serif', label: 'Patkové' },
];

/**
 * Obecný handler pro otevření odkazu v novém panelu (zabrání navigaci
 * v iframu XChatu, kdyby selhal target="_blank").
 */
const openInNewTab = (url: string) => (e: MouseEvent<HTMLAnchorElement>): void => {
  e.preventDefault();
  window.open(url, '_blank', 'noopener,noreferrer');
};

const SettingsTab = ({ ctx, options, onSetOption }: SettingsTabProps) => {
  // Lokální draft – změny se zapisují až po kliknutí na „Uložit".
  const [draft, setDraft] = useState<RoomOptions>(options);

  // Když se options změní zvenčí (např. jiná záložka), synchronizuj draft.
  useEffect(() => {
    setDraft(options);
  }, [options]);

  const toolkitOptionsUrl = chrome.runtime.getURL('src/options/options.html');
  const xchatSettingsUrl = `${XChatUrls.hashPrefix(ctx.xhash)}/settings/`;

  const fontSize = Math.max(1, Math.min(10, Math.round(draft.messageFontSize ?? 5)));
  const skinValue = draft.skinId === 'auto' ? 'auto' : String(draft.skinId);

  const update = <K extends keyof RoomOptions>(key: K, value: RoomOptions[K]): void => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>): void => {
    e.preventDefault();

    // Projdi všechny klíče a persistuj jen ty, co se skutečně změnily.
    const changedKeys = (Object.keys(draft) as Array<keyof RoomOptions>).filter(
      (k) => draft[k] !== options[k],
    );
    if (changedKeys.length === 0) {
      toast.success('Nastavení uloženo.');
      return;
    }

    const skinChanged = changedKeys.includes('skinId');
    for (const key of changedKeys) {
      onSetOption(key, draft[key]);
    }
    toast.success('Nastavení uloženo.');
    if (skinChanged) {
      toast.warning('Pro aplikaci nového barevného schématu obnov okno místnosti.');
    }
  };

  return (
    <form className="xct-tab xct-settingstab" onSubmit={handleSubmit}>
      {/* 1) Velikost textů */}
      <div className="xct-settingstab__row">
        <label htmlFor="xct-st-fontsize" className="xct-settingstab__label">
          Velikost textů ({fontSize})
        </label>
        <input
          id="xct-st-fontsize"
          type="range"
          min={1}
          max={10}
          step={1}
          value={fontSize}
          onChange={(e) => update('messageFontSize', Number(e.target.value))}
        />
      </div>

      {/* 2) Barevné schéma */}
      <div className="xct-settingstab__row">
        <label htmlFor="xct-st-skin" className="xct-settingstab__label">
          Barevné schéma
        </label>
        <select
          id="xct-st-skin"
          value={skinValue}
          onChange={(e) => {
            const v = e.target.value;
            update('skinId', v === 'auto' ? 'auto' : Number(v));
          }}
        >
          <option value="auto">Načíst z XChatu</option>
          {SKINS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {/* 3) Interval obnovování */}
      <div className="xct-settingstab__row">
        <label htmlFor="xct-st-refresh" className="xct-settingstab__label">
          Interval obnovování
        </label>
        <select
          id="xct-st-refresh"
          value={draft.refreshIntervalSec}
          onChange={(e) =>
            update('refreshIntervalSec', Number(e.target.value) as 5 | 10 | 15)
          }
        >
          {INTERVALS.map((i) => (
            <option key={i} value={i}>
              {i} s
            </option>
          ))}
        </select>
      </div>

      {/* 4) Výchozí záložka */}
      <div className="xct-settingstab__row">
        <label htmlFor="xct-st-tab" className="xct-settingstab__label">
          Výchozí záložka
        </label>
        <select
          id="xct-st-tab"
          value={draft.defaultSidebarTab}
          onChange={(e) =>
            update('defaultSidebarTab', e.target.value as RoomOptions['defaultSidebarTab'])
          }
        >
          {TABS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* 5) Pořadí zpráv */}
      <div className="xct-settingstab__row">
        <label htmlFor="xct-st-order" className="xct-settingstab__label">
          Pořadí zpráv
        </label>
        <select
          id="xct-st-order"
          value={draft.messageOrder}
          onChange={(e) =>
            update('messageOrder', e.target.value as RoomOptions['messageOrder'])
          }
        >
          {ORDERS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {/* 6) Písmo místnosti */}
      <div className="xct-settingstab__row">
        <label htmlFor="xct-st-font" className="xct-settingstab__label">
          Písmo místnosti
        </label>
        <select
          id="xct-st-font"
          value={draft.fontFamily}
          onChange={(e) =>
            update('fontFamily', e.target.value as RoomOptions['fontFamily'])
          }
        >
          {FONTS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      {/* 7) Zvýrazňovat šeptání */}
      <div className="xct-settingstab__row xct-settingstab__row--check">
        <label>
          <input
            type="checkbox"
            checked={draft.highlightWhispers}
            onChange={(e) => update('highlightWhispers', e.target.checked)}
          />{' '}
          Zvýrazňovat šeptání
        </label>
      </div>

      {/* 8) Zprávy uživatelů barevně */}
      <div className="xct-settingstab__row xct-settingstab__row--check">
        <label>
          <input
            type="checkbox"
            checked={draft.userColorsEnabled}
            onChange={(e) => update('userColorsEnabled', e.target.checked)}
          />{' '}
          Zprávy uživatelů barevně
        </label>
      </div>

      {/* 9) Zvýraznit můj nick */}
      <div className="xct-settingstab__row xct-settingstab__row--check">
        <label>
          <input
            type="checkbox"
            checked={draft.highlightMyNick}
            onChange={(e) => update('highlightMyNick', e.target.checked)}
          />{' '}
          Zvýraznit můj nick
        </label>
      </div>

      {/* 10) Zvýraznit vyhozené uživatele */}
      <div className="xct-settingstab__row xct-settingstab__row--check">
        <label>
          <input
            type="checkbox"
            checked={draft.highlightKick}
            onChange={(e) => update('highlightKick', e.target.checked)}
          />{' '}
          Zvýraznit vyhozené uživatele
        </label>
      </div>

      {/* 11) Skrýt neplatné příkazy */}
      <div className="xct-settingstab__row xct-settingstab__row--check">
        <label>
          <input
            type="checkbox"
            checked={draft.hideBadCommand}
            onChange={(e) => update('hideBadCommand', e.target.checked)}
          />{' '}
          Skrýt neplatné příkazy
        </label>
      </div>

      {/* 12) Vylepšené příkazy v místnosti */}
      <div className="xct-settingstab__row xct-settingstab__row--check">
        <label>
          <input
            type="checkbox"
            checked={draft.enhancedRoomCommands}
            onChange={(e) => update('enhancedRoomCommands', e.target.checked)}
          />{' '}
          Vylepšené příkazy v místnosti
        </label>
      </div>

      <div className="xct-settingstab__actions">
        <button type="submit" className="xct-btn xct-btn--block">
          Uložit
        </button>
      </div>

      <div className="xct-settingstab__links">
        <a
          href={toolkitOptionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={openInNewTab(toolkitOptionsUrl)}
        >
          Otevřít nastavení toolkitu ↗
        </a>
        <a
          href={xchatSettingsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={openInNewTab(xchatSettingsUrl)}
        >
          Otevřít nastavení XChatu ↗
        </a>
      </div>
    </form>
  );
};

export default SettingsTab;
