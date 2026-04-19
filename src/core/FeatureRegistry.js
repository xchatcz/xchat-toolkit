/**
 * Registr funkcí + dispatcher pro content script.
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { loadSettings } from './Settings.js';

/**
 * Inicializuje funkce pro aktuální rámec.
 * @param {Array<typeof import('./Feature.js').Feature>} features
 */
export async function runFeatures(features) {
  const href = location.href;
  const matching = features.filter((F) => F.appliesTo(href));
  if (matching.length === 0) return;

  const settings = await loadSettings(features);
  const enabled = matching.filter((F) => settings.features[F.id] !== false);
  if (enabled.length === 0) return;

  for (const FeatureClass of enabled) {
    const options = settings.featureOptions[FeatureClass.id] ?? {};
    const start = async () => {
      try {
        const instance = new FeatureClass();
        await instance.run({ options });
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error(`[XChat Toolkit] Funkce "${FeatureClass.id}" selhala:`, err);
      }
    };

    if (FeatureClass.runAt === 'start') {
      start();
    } else if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  }
}
