/**
 * Content script bootstrap. Na základě aktuální URL rozhodne, kterou funkci
 * spustit (forum/messages/room). Běží ve všech stránkách xchat.cz na
 * document_start, ale konkrétní features se aktivují jen když odpovídá URL.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { FEATURES } from '../core/FeatureRegistry';
import { loadSettings, onSettingsChanged, type ToolkitSettings } from '../core/Settings';
import type { Feature } from '../core/Feature';

const activate = (feature: Feature, settings: ToolkitSettings): void => {
  if (settings.features[feature.id] === false) return;
  const options = (settings.featureOptions[feature.id] ?? feature.defaultOptions) as object;
  try {
    Promise.resolve(feature.run({ options })).catch((err) =>
      console.error(`[XChat Toolkit] ${feature.id} selhal:`, err),
    );
  } catch (err) {
    console.error(`[XChat Toolkit] ${feature.id} selhal (sync):`, err);
  }
};

const runApplicable = async (): Promise<void> => {
  const href = location.href;
  const applicable = FEATURES.filter((f) => f.appliesTo(href));
  if (applicable.length === 0) return;

  // KRITICKÉ: synchronně – bez čekání na storage – zavoláme prepare() každé
  // matching feature. Právě tohle stihne zastavit načítání frameů dřív, než
  // se vůbec začnou vytvářet.
  for (const feature of applicable) {
    try {
      feature.prepare();
    } catch (err) {
      console.error(`[XChat Toolkit] ${feature.id} prepare selhal:`, err);
    }
  }

  const settings = await loadSettings(FEATURES);

  // Funkce s `runAt: 'start'` spustíme okamžitě,
  // ostatní až po DOMContentLoaded.
  const ready = (cb: () => void): void => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', cb, { once: true });
    } else {
      cb();
    }
  };
  for (const feature of applicable) {
    if (feature.runAt === 'start') activate(feature, settings);
    else ready(() => activate(feature, settings));
  }
};

void runApplicable();

// Znovu-aktivujeme při změně nastavení (např. přepnutí feature v Options).
onSettingsChanged(() => {
  // Pro jednoduchost reloadneme – detailní diff by vyžadoval per-feature hook.
  // (React Room app má vlastní real-time vazby přes useSettings uvnitř.)
});
