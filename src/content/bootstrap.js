/**
 * Obsahový bootstrap XChat Toolkitu.
 * Běží v izolovaném contextu rozšíření ve všech rámcích xchat.cz.
 * Vybere funkce odpovídající URL, zkontroluje nastavení a spustí je.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { runFeatures } from '../core/FeatureRegistry.js';
import { ALL_FEATURES } from '../features/index.js';
import { installPageFetchBridge } from './fetchBridge.js';

// Posluchač pro MAIN-world fetch proxy musí být aktivní, než se spustí
// jakýkoli page-context skript (`room-messages.js` atd.).
installPageFetchBridge();

runFeatures(ALL_FEATURES).catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[XChat Toolkit] Bootstrap selhal:', err);
});
