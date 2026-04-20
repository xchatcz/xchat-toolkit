/**
 * Hook pro live nastavení konkrétní feature uložené v `chrome.storage.sync`.
 *
 * Řeší dvě věci:
 *  1) v paměti drží aktuální hodnoty (init = `initial` z mount.tsx, pak se
 *     doplní případné změny z jiné karty přes `storage.onChanged`);
 *  2) `setOption(key, value)` současně přepočítá lokální stav a asynchronně
 *     persistuje do storage. Přepínače v UI reagují okamžitě.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadSettings, saveSettings, onSettingsChanged } from '../../core/Settings';
import { FEATURES } from '../../core/FeatureRegistry';

export const useFeatureOptions = <O extends object>(
  featureId: string,
  initial: O,
): [O, <K extends keyof O>(key: K, value: O[K]) => void] => {
  const [opts, setOpts] = useState<O>(initial);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  // Poslouchej změny z jiných tabů (Options otevřené v druhém okně atd.).
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
        const full = await loadSettings(FEATURES);
        const cur = (full.featureOptions[featureId] ?? {}) as Record<string, unknown>;
        await saveSettings({
          ...full,
          featureOptions: {
            ...full.featureOptions,
            [featureId]: { ...cur, [key as string]: value },
          },
        });
      })();
    },
    [featureId],
  );

  return [opts, setOption];
};
