/**
 * RoomSection – detailní nastavení feature „Místnost" (skin, interval, tab).
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { SKINS } from '../../room/skins/palettes';

export interface RoomSectionProps {
  options: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

const INTERVALS: ReadonlyArray<5 | 10 | 15> = [5, 10, 15];
const TABS: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'users', label: 'Uživatelé' },
  { id: 'smilies', label: 'Smajlíci' },
  { id: 'settings', label: 'Nastavení' },
  { id: 'ignore', label: 'Ignorace' },
  { id: 'admin', label: 'Správa' },
];
const ORDERS: ReadonlyArray<{ id: 'newest-first' | 'newest-last'; label: string }> = [
  { id: 'newest-first', label: 'Nejnovější nahoře (scroll nahoru)' },
  { id: 'newest-last', label: 'Nejnovější dole (scroll dolů)' },
];
const FONTS: ReadonlyArray<{ id: 'sans' | 'serif'; label: string }> = [
  { id: 'sans', label: 'Bezpatkové (Segoe UI, Arial)' },
  { id: 'serif', label: 'Patkové (Georgia, Times)' },
];

const RoomSection = ({ options, onChange }: RoomSectionProps) => {
  const skinId = Number(options.skinId ?? 2);
  const refresh = Number(options.refreshIntervalSec ?? 5);
  const tab = String(options.defaultSidebarTab ?? 'users');
  const order = String(options.messageOrder ?? 'newest-first');
  const fontFamily = String(options.fontFamily ?? 'sans');
  const highlightWhispers = Boolean(options.highlightWhispers ?? true);
  const highlightMyNick = Boolean(options.highlightMyNick ?? false);
  const hideBadCommand = Boolean(options.hideBadCommand ?? false);

  return (
    <div className="xct-opt-room">
      <div className="xct-opt-room__row">
        <label>Barevné schéma</label>
        <select value={skinId} onChange={(e) => onChange('skinId', Number(e.target.value))}>
          {SKINS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="xct-opt-room__row">
        <label>Interval obnovování zpráv</label>
        <select
          value={refresh}
          onChange={(e) => onChange('refreshIntervalSec', Number(e.target.value))}
        >
          {INTERVALS.map((i) => (
            <option key={i} value={i}>
              {i} s
            </option>
          ))}
        </select>
      </div>

      <div className="xct-opt-room__row">
        <label>Výchozí záložka bočního panelu</label>
        <select value={tab} onChange={(e) => onChange('defaultSidebarTab', e.target.value)}>
          {TABS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="xct-opt-room__row">
        <label>Pořadí zpráv</label>
        <select value={order} onChange={(e) => onChange('messageOrder', e.target.value)}>
          {ORDERS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      <div className="xct-opt-room__row">
        <label>Písmo místnosti</label>
        <select value={fontFamily} onChange={(e) => onChange('fontFamily', e.target.value)}>
          {FONTS.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <div className="xct-opt-room__row">
        <label>
          <input
            type="checkbox"
            checked={highlightWhispers}
            onChange={(e) => onChange('highlightWhispers', e.target.checked)}
          />{' '}
          Zvýrazňovat šeptané zprávy (pozadí + proužek)
        </label>
      </div>

      <div className="xct-opt-room__row">
        <label>
          <input
            type="checkbox"
            checked={highlightMyNick}
            onChange={(e) => onChange('highlightMyNick', e.target.checked)}
          />{' '}
          Žlutě zvýraznit můj nick v příchozích zprávách
        </label>
      </div>

      <div className="xct-opt-room__row">
        <label>
          <input
            type="checkbox"
            checked={hideBadCommand}
            onChange={(e) => onChange('hideBadCommand', e.target.checked)}
          />{' '}
          Skrýt systémové hlášky „Špatný příkaz"
        </label>
      </div>
    </div>
  );
};

export default RoomSection;
