/**
 * Hook pro live nastavení konkrétní feature uložené v `chrome.storage.sync`.
 *
 * Řeší dvě věci:
 *  1) v paměti drží aktuální hodnoty (init = `initial` z mount.tsx, pak se
 *     doplní případné změny z jiné karty přes `storage.onChanged`);
 *  2) `setOption(key, value)` současně přepočítá lokální stav a asynchronně
 *     persistuje do storage. Přepínače v UI reagují okamžitě.
 *
 * Pozor: NEimportujeme `FEATURES` (z FeatureRegistry) – způsobilo by to
 * cyklický import (FeatureRegistry → RoomApp → mount → App → tenhle hook),
 * což v runtime vrací nekompletní modul a hook by selhal při prvním volání.
 * Místo toho čteme/zapisujeme raw `chrome.storage.sync` přímo.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SETTINGS_STORAGE_KEY,
  onSettingsChanged,
  type ToolkitSettings,
} from '../../core/Settings';

export const useFeatureOptions = <O extends object>(
  featureId: string,
  initial: O,
): [O, <K extends keyof O>(key: K, value: O[K]) => void] => {
  const [opts, setOpts] = useState<O>(initial);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    const off = onSettingsChanged((next) => {
      const remote = next.featureOptions?.[featureId] as O | undefined;
      if (!remote) return;
      setOpts((prev) => ({ ...prev, ...remote }));
    });
    return off;
  }, [featureId]);

  const setOption = useCallback(
    <K extends keyof O>(key: K, value: O[K]): void => {
      const next = { ...optsRef.current, [key]: value };
      setOpts(next);
      void (async () => {
        const raw = await chrome.storage.sync.get(SETTINGS_STORAGE_KEY);
        const stored = (raw?.[SETTINGS_STORAGE_KEY] ?? {
          features: {},
          featureOptions: {},
        }) as ToolkitSettings;
        const cur = (stored.featureOptions?.[featureId] ?? {}) as Record<string, unknown>;
        const merged: ToolkitSettings = {
          features: stored.features ?? {},
          featureOptions: {
            ...(stored.featureOptions ?? {}),
            [featureId]: { ...cur, [key as string]: value },
          },
        };
        await chrome.storage.sync.set({ [SETTINGS_STORAGE_KEY]: merged });
      })();
    },
    [featureId],
  );

  return [opts, setOption];
};
