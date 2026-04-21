/**
 * RoomSection – detailní nastavení feature „Místnost" (skin, interval, tab).
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { SKINS } from '../../room/skins/palettes';
import { parseColor, toHex, toRgba } from '../color';

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
  // Skin: buď číslo (2..26), nebo speciální 'auto' – převezme se z XChatu.
  const skinRaw = options.skinId;
  const skinValue: string = skinRaw === 'auto' ? 'auto' : String(skinRaw ?? 'auto');
  const refresh = Number(options.refreshIntervalSec ?? 5);
  const tab = String(options.defaultSidebarTab ?? 'users');
  const order = String(options.messageOrder ?? 'newest-first');
  const fontFamily = String(options.fontFamily ?? 'sans');
  const highlightWhispers = Boolean(options.highlightWhispers ?? true);
  const highlightMyNick = Boolean(options.highlightMyNick ?? false);
  const userColorsEnabled = Boolean(options.userColorsEnabled ?? true);
  const highlightKick = Boolean(options.highlightKick ?? true);
  const highlightPreKickWarning = Boolean(options.highlightPreKickWarning ?? false);
  const hideBadCommand = Boolean(options.hideBadCommand ?? false);

  // Barva pozadí šeptů – rozparsujeme do hex + alpha pro picker.
  const whisperBgRaw = String(options.whisperBgColor ?? 'rgba(255, 235, 59, 0.35)');
  const whisperBg = parseColor(whisperBgRaw) ?? { r: 255, g: 235, b: 59, a: 0.35 };
  const whisperHex = toHex(whisperBg.r, whisperBg.g, whisperBg.b);
  const whisperAlpha = whisperBg.a;
  const setWhisperColor = (hex: string, alpha: number): void => {
    const parsed = parseColor(hex);
    if (!parsed) return;
    onChange('whisperBgColor', toRgba(parsed.r, parsed.g, parsed.b, alpha));
  };

  // Barva zvýraznění mého nicku – stejný pattern jako u šeptů.
  const myNickHlRaw = String(options.myNickHighlightColor ?? 'rgba(255, 255, 0, 1)');
  const myNickHl = parseColor(myNickHlRaw) ?? { r: 255, g: 255, b: 0, a: 1 };
  const myNickHex = toHex(myNickHl.r, myNickHl.g, myNickHl.b);
  const myNickAlpha = myNickHl.a;
  const setMyNickColor = (hex: string, alpha: number): void => {
    const parsed = parseColor(hex);
    if (!parsed) return;
    onChange('myNickHighlightColor', toRgba(parsed.r, parsed.g, parsed.b, alpha));
  };

  return (
    <div className="xct-opt-room">
      <div className="xct-opt-room__row">
        <label>Barevné schéma</label>
        <select
          value={skinValue}
          onChange={(e) => {
            const v = e.target.value;
            onChange('skinId', v === 'auto' ? 'auto' : Number(v));
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

      {highlightWhispers ? (
        <div className="xct-opt-room__row xct-opt-room__row--color">
          <label>Barva pozadí šeptů</label>
          <div className="xct-opt-color">
            <input
              type="color"
              value={whisperHex}
              onChange={(e) => setWhisperColor(e.target.value, whisperAlpha)}
              title="Kapátko / výběr barvy"
            />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={whisperAlpha}
              onChange={(e) => setWhisperColor(whisperHex, Number(e.target.value))}
              title="Průsvitnost"
            />
            <span
              className="xct-opt-color__preview"
              style={{ backgroundColor: whisperBgRaw }}
              aria-hidden="true"
            />
            <code className="xct-opt-color__value">{whisperBgRaw}</code>
          </div>
        </div>
      ) : null}

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

      {highlightMyNick ? (
        <div className="xct-opt-room__row xct-opt-room__row--color">
          <label>Barva zvýraznění mého nicku</label>
          <div className="xct-opt-color">
            <input
              type="color"
              value={myNickHex}
              onChange={(e) => setMyNickColor(e.target.value, myNickAlpha)}
              title="Kapátko / výběr barvy"
            />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={myNickAlpha}
              onChange={(e) => setMyNickColor(myNickHex, Number(e.target.value))}
              title="Průsvitnost"
            />
            <span
              className="xct-opt-color__preview"
              style={{ backgroundColor: myNickHlRaw }}
              aria-hidden="true"
            />
            <code className="xct-opt-color__value">{myNickHlRaw}</code>
          </div>
        </div>
      ) : null}

      <div className="xct-opt-room__row">
        <label>
          <input
            type="checkbox"
            checked={userColorsEnabled}
            onChange={(e) => onChange('userColorsEnabled', e.target.checked)}
          />{' '}
          Barevně rozlišovat zprávy podle uživatele
        </label>
      </div>

      <div className="xct-opt-room__row">
        <label>
          <input
            type="checkbox"
            checked={highlightKick}
            onChange={(e) => onChange('highlightKick', e.target.checked)}
          />{' '}
          Červeně zvýraznit hlášky o vyhození z místnosti
        </label>
      </div>

      <div className="xct-opt-room__row">
        <label>
          <input
            type="checkbox"
            checked={highlightPreKickWarning}
            onChange={(e) => onChange('highlightPreKickWarning', e.target.checked)}
          />{' '}
          Zvýraznit pozadí červeně 5 minut před vyhozením
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
