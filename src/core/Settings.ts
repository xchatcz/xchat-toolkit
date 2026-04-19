/**
 * Obal nad `chrome.storage.sync` s výchozími hodnotami a event sběrnicí.
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import type { Feature } from './Feature';

export const SETTINGS_STORAGE_KEY = 'xchatToolkitSettings';

export interface ToolkitSettings {
  features: Record<string, boolean>;
  featureOptions: Record<string, Record<string, unknown>>;
}

/** Výchozí nastavení vypočtené ze seznamu featur. */
export const buildDefaultSettings = (features: readonly Feature[]): ToolkitSettings => {
  const out: ToolkitSettings = { features: {}, featureOptions: {} };
  for (const f of features) {
    out.features[f.id] = f.defaultEnabled !== false;
    if (f.defaultOptions && Object.keys(f.defaultOptions).length > 0) {
      out.featureOptions[f.id] = { ...(f.defaultOptions as Record<string, unknown>) };
    }
  }
  return out;
};

export const loadSettings = async (features: readonly Feature[]): Promise<ToolkitSettings> => {
  const defaults = buildDefaultSettings(features);
  const raw = await chrome.storage.sync.get(SETTINGS_STORAGE_KEY);
  const stored = (raw?.[SETTINGS_STORAGE_KEY] ?? {}) as Partial<ToolkitSettings>;
  return {
    features: { ...defaults.features, ...(stored.features ?? {}) },
    featureOptions: { ...defaults.featureOptions, ...(stored.featureOptions ?? {}) },
  };
};

export const saveSettings = async (settings: ToolkitSettings): Promise<void> => {
  await chrome.storage.sync.set({ [SETTINGS_STORAGE_KEY]: settings });
};

export type SettingsListener = (settings: ToolkitSettings) => void;

export const onSettingsChanged = (listener: SettingsListener): (() => void) => {
  const handler = (
    changes: { [key: string]: chrome.storage.StorageChange },
    area: chrome.storage.AreaName,
  ) => {
    if (area !== 'sync') return;
    const change = changes[SETTINGS_STORAGE_KEY];
    if (!change) return;
    listener((change.newValue ?? { features: {}, featureOptions: {} }) as ToolkitSettings);
  };
  chrome.storage.onChanged.addListener(handler);
  return () => chrome.storage.onChanged.removeListener(handler);
};
