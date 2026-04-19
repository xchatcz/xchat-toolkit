/**
 * Kategorie nastavení v Options stránce.
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

export type SettingsCategory = 'forum' | 'offline-messages' | 'room';

export const CATEGORY_LABELS: Record<SettingsCategory, string> = {
  forum: 'Fórum',
  'offline-messages': 'Vzkazy',
  room: 'Místnost',
};

export const CATEGORY_ORDER: SettingsCategory[] = ['room', 'offline-messages', 'forum'];
