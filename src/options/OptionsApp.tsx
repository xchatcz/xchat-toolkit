/**
 * OptionsApp – stránka Nastavení. Funkce rozdělené do kategorií
 * („Fórum", „Vzkazy", „Místnost"); u každé se dá zapnout/vypnout.
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
import RoomSection from './sections/RoomSection';
import DebugSection from './sections/DebugSection';

const OptionsApp = () => {
  const [settings, setSettings] = useState<ToolkitSettings | null>(null);

  useEffect(() => {
    void loadSettings(FEATURES).then(setSettings);
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

  if (!settings) return <div className="xct-opt-loading">Načítám nastavení…</div>;

  const update = (next: ToolkitSettings): void => {
    setSettings(next);
    void saveSettings(next);
  };

  const toggle = (id: string, on: boolean): void =>
    update({ ...settings, features: { ...settings.features, [id]: on } });

  const setRoomOption = (key: string, value: unknown): void => {
    const room = (settings.featureOptions['room-app'] ?? {}) as Record<string, unknown>;
    update({
      ...settings,
      featureOptions: {
        ...settings.featureOptions,
        'room-app': { ...room, [key]: value },
      },
    });
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
                    checked={settings.features[f.id] !== false}
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
                (settings.featureOptions['room-app'] ?? {}) as Record<string, unknown>
              }
              onChange={setRoomOption}
            />
          ) : null}
        </section>
      ))}

      {/* Logování / diagnostika – úplně dole, napříč celým rozšířením. */}
      <section className="xct-opt__section">
        <h2 className="xct-opt__section-title">Logování a diagnostika</h2>
        <DebugSection
          options={
            (settings.featureOptions['room-app'] ?? {}) as Record<string, unknown>
          }
          onChange={setRoomOption}
        />
      </section>
    </div>
  );
};

export default OptionsApp;
