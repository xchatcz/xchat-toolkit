/**
 * OptionsApp – stránka Nastavení. Funkce rozdělené do kategorií
 * („Fórum", „Vzkazy", „Místnost"); u každé se dá zapnout/vypnout.
 *
 * Změny se ukládají až po kliknutí na tlačítko „Uložit" dole. Úspěch /
 * chyby hlásí toast notifikace (viz core/toast.ts).
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useEffect, useMemo, useState } from 'react';
import { FEATURES } from '../core/FeatureRegistry';
import {
  CATEGORY_LABELS,
  CATEGORY_ORDER,
  type SettingsCategory,
} from '../core/categories';
import {
  loadSettings,
  saveSettings,
  type ToolkitSettings,
} from '../core/Settings';
import {
  loadFavouriteSmileys,
  saveFavouriteSmileys,
} from '../core/favouriteSmileys';
import { FAVOURITE_SMILEYS_MAX } from '../core/superAdmins';
import { toast } from '../core/toast';
import RoomSection from './sections/RoomSection';
import DebugSection from './sections/DebugSection';

/** Stringifikované porovnání – stačí pro ploché nastavení v chrome.storage. */
const settingsEqual = (a: ToolkitSettings, b: ToolkitSettings): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

const favsToText = (nums: number[]): string => nums.join(', ');

interface ParsedFavs {
  ok: boolean;
  nums: number[];
  /** Text chybové hlášky pro toast, pokud `ok === false`. */
  error?: string;
  /** Kolik validních čísel bylo zahozeno kvůli limitu – pro warning toast. */
  overLimit: number;
}

/**
 * Rozparsuje textové pole „1, 5, 12" na pole čísel. Povolí čárku, středník
 * i mezery jako oddělovače. Duplikáty spojí, výsledek seřadí vzestupně.
 */
const parseFavs = (text: string): ParsedFavs => {
  const trimmed = text.trim();
  if (!trimmed) return { ok: true, nums: [], overLimit: 0 };
  const parts = trimmed.split(/[\s,;]+/).filter(Boolean);
  const nums: number[] = [];
  const seen = new Set<number>();
  for (const p of parts) {
    const n = Number(p);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) {
      return {
        ok: false,
        nums: [],
        error: `Neplatná hodnota: „${p}". Povolená jsou jen kladná celá čísla oddělená čárkou.`,
        overLimit: 0,
      };
    }
    if (seen.has(n)) continue;
    seen.add(n);
    nums.push(n);
  }
  nums.sort((a, b) => a - b);
  const overLimit = Math.max(0, nums.length - FAVOURITE_SMILEYS_MAX);
  return {
    ok: true,
    nums: nums.slice(0, FAVOURITE_SMILEYS_MAX),
    overLimit,
  };
};

const OptionsApp = () => {
  const [saved, setSaved] = useState<ToolkitSettings | null>(null);
  const [pending, setPending] = useState<ToolkitSettings | null>(null);

  const [savedFavs, setSavedFavs] = useState<number[]>([]);
  const [favText, setFavText] = useState<string>('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      const [s, fav] = await Promise.all([
        loadSettings(FEATURES),
        loadFavouriteSmileys(),
      ]);
      setSaved(s);
      setPending(s);
      setSavedFavs(fav.nums);
      setFavText(favsToText(fav.nums));
    })();
  }, []);

  const featuresByCategory = useMemo(() => {
    const map: Record<SettingsCategory, Array<(typeof FEATURES)[number]>> = {
      forum: [],
      'offline-messages': [],
      room: [],
    };
    for (const f of FEATURES) map[f.category].push(f);
    return map;
  }, []);

  if (!pending || !saved) {
    return <div className="xct-opt-loading">Načítám nastavení…</div>;
  }

  const dirtySettings = !settingsEqual(pending, saved);
  const dirtyFavs = favText.trim() !== favsToText(savedFavs);
  const dirty = dirtySettings || dirtyFavs;

  const toggle = (id: string, on: boolean): void => {
    setPending({ ...pending, features: { ...pending.features, [id]: on } });
  };

  const setRoomOption = (key: string, value: unknown): void => {
    const room = (pending.featureOptions['room-app'] ?? {}) as Record<string, unknown>;
    setPending({
      ...pending,
      featureOptions: {
        ...pending.featureOptions,
        'room-app': { ...room, [key]: value },
      },
    });
  };

  const handleSave = async (): Promise<void> => {
    if (saving) return;
    const parsed = parseFavs(favText);
    if (!parsed.ok) {
      toast.error(parsed.error ?? 'Chyba v seznamu oblíbených smajlíků.');
      return;
    }
    setSaving(true);
    try {
      await Promise.all([
        saveSettings(pending),
        saveFavouriteSmileys({ nums: parsed.nums }),
      ]);
      setSaved(pending);
      setSavedFavs(parsed.nums);
      setFavText(favsToText(parsed.nums));
      if (parsed.overLimit > 0) {
        toast.warning(
          `Uloženo, ale ${parsed.overLimit} čísel přesáhlo limit ${FAVOURITE_SMILEYS_MAX} a bylo zahozeno.`,
        );
      } else {
        toast.success('Nastavení uloženo.');
      }
    } catch (err) {
      toast.error(
        'Nepodařilo se uložit nastavení: ' +
          (err instanceof Error ? err.message : String(err)),
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = (): void => {
    setPending(saved);
    setFavText(favsToText(savedFavs));
  };

  return (
    <div className="xct-opt">
      <header className="xct-opt__header">
        <img
          className="xct-opt__logo"
          src={chrome.runtime.getURL('icons/icon-128.png')}
          alt="XChat Toolkit"
          width={64}
          height={64}
        />
        <h1 className="xct-opt__title">XChat Toolkit – nastavení</h1>
      </header>

      {CATEGORY_ORDER.map((cat) => (
        <section key={cat} className="xct-opt__section">
          <h2 className="xct-opt__section-title">{CATEGORY_LABELS[cat]}</h2>
          <ul className="xct-opt__features">
            {featuresByCategory[cat].map((f) => (
              <li key={f.id} className="xct-opt__feature">
                <label>
                  <input
                    type="checkbox"
                    checked={pending.features[f.id] !== false}
                    onChange={(e) => toggle(f.id, e.target.checked)}
                  />
                  <span className="xct-opt__feature-name">{f.name}</span>
                </label>
                <p className="xct-opt__feature-desc">{f.description}</p>
              </li>
            ))}
          </ul>

          {cat === 'room' ? (
            <RoomSection
              options={
                (pending.featureOptions['room-app'] ?? {}) as Record<string, unknown>
              }
              onChange={setRoomOption}
            />
          ) : null}
        </section>
      ))}

      {/* Oblíbení smajlíci – editovatelný seznam čísel oddělených čárkou. */}
      <section className="xct-opt__section">
        <h2 className="xct-opt__section-title">Oblíbení smajlíci</h2>
        <div className="xct-opt-favs">
          <label className="xct-opt-favs__label" htmlFor="xct-opt-favs-input">
            Čísla smajlíků oddělená čárkou (max {FAVOURITE_SMILEYS_MAX}). Po
            uložení se seznam seřadí vzestupně.
          </label>
          <input
            id="xct-opt-favs-input"
            type="text"
            className="xct-opt-favs__input"
            value={favText}
            onChange={(e) => setFavText(e.target.value)}
            placeholder="např. 1, 5, 12, 42"
            spellCheck={false}
            autoComplete="off"
          />
        </div>
      </section>

      {/* Logování / diagnostika – úplně dole, napříč celým rozšířením. */}
      <section className="xct-opt__section">
        <h2 className="xct-opt__section-title">Logování a diagnostika</h2>
        <DebugSection
          options={
            (pending.featureOptions['room-app'] ?? {}) as Record<string, unknown>
          }
          onChange={setRoomOption}
        />
      </section>

      <div className="xct-opt__actions">
        <button
          type="button"
          className="xct-opt__btn xct-opt__btn--secondary"
          onClick={handleReset}
          disabled={!dirty || saving}
        >
          Zahodit změny
        </button>
        <button
          type="button"
          className="xct-opt__btn xct-opt__btn--primary"
          onClick={() => void handleSave()}
          disabled={!dirty || saving}
        >
          {saving ? 'Ukládám…' : dirty ? 'Uložit' : 'Uloženo'}
        </button>
      </div>
    </div>
  );
};

export default OptionsApp;
