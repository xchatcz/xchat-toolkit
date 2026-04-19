/**
 * Obal nad `chrome.storage.sync` s výchozími hodnotami a event sběrnicí.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

const STORAGE_KEY = 'xchatToolkitSettings';

/**
 * @typedef {Object} ToolkitSettings
 * @property {Record<string, boolean>} features – id funkce → zapnuto/vypnuto
 * @property {Record<string, unknown>} featureOptions – nastavení specifická pro funkci
 */

/**
 * Vytvoří výchozí nastavení ze seznamu registrovaných funkcí.
 * @param {Array<{id: string, defaultEnabled?: boolean, defaultOptions?: Record<string, unknown>}>} features
 * @returns {ToolkitSettings}
 */
export function buildDefaultSettings(features) {
  const out = { features: {}, featureOptions: {} };
  for (const feature of features) {
    out.features[feature.id] = feature.defaultEnabled !== false;
    if (feature.defaultOptions) {
      out.featureOptions[feature.id] = { ...feature.defaultOptions };
    }
  }
  return out;
}

/**
 * Načte uložené nastavení a doplní chybějící položky výchozími hodnotami.
 * @param {Array<{id: string, defaultEnabled?: boolean, defaultOptions?: Record<string, unknown>}>} features
 * @returns {Promise<ToolkitSettings>}
 */
export async function loadSettings(features) {
  const defaults = buildDefaultSettings(features);
  const raw = await chrome.storage.sync.get(STORAGE_KEY);
  const stored = raw?.[STORAGE_KEY] ?? {};
  return {
    features: { ...defaults.features, ...(stored.features ?? {}) },
    featureOptions: { ...defaults.featureOptions, ...(stored.featureOptions ?? {}) },
  };
}

/**
 * Uloží nastavení.
 * @param {ToolkitSettings} settings
 * @returns {Promise<void>}
 */
export async function saveSettings(settings) {
  await chrome.storage.sync.set({ [STORAGE_KEY]: settings });
}

/**
 * Registruje posluchače změn nastavení (z Options stránky atd.).
 * @param {(settings: ToolkitSettings) => void} listener
 * @returns {() => void} funkce pro odregistrování
 */
export function onSettingsChanged(listener) {
  const handler = (changes, area) => {
    if (area !== 'sync') return;
    const change = changes[STORAGE_KEY];
    if (!change) return;
    listener(change.newValue ?? { features: {}, featureOptions: {} });
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
}

export const SETTINGS_STORAGE_KEY = STORAGE_KEY;
