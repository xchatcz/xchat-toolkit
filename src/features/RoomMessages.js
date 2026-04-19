/**
 * Velký „toolkit" pro hlavní sklo XChatu. Musí běžet v page-world (MAIN world)
 * protože potřebuje přímý přístup k `window.top.*` globálům (roomframe,
 * infopage, dataframe.refresh, whisper_to, cID, …) a k `document.domain`.
 *
 * Feature pouze vloží `<script src>` ukazující na web-accessible resource
 * rozšíření. Všechna logika je v `src/page/room-messages.js`.
 */

import { Feature } from '../core/Feature.js';
import { injectPageScript } from '../core/pageInject.js';

export class RoomMessages extends Feature {
  static id = 'room-messages';
  static name = 'Hlavní sklo – zprávy a ovládání';
  static description =
    'Pokročilé ovládání hlavního skla: lehký polling, fronta požadavků, whisper okna, historie zpráv, pozdravy, tichý auto-refresh.';
  static matches = [
    /\/modchat\?.*op=startframe/,
    /\/modchat\?.*op=infopage/,
    /\/modchat\?.*op=titlepage/,
    /\/modchat\?.*op=reloadpage/,
    /\/modchat\?.*op=roomframeng/,
    /\/modchat\?.*op=roomtopng/,
    /\/modchat\?.*op=textpageng/,
    /\/history\.html/,
  ];
  static runAt = 'start';

  run() {
    // Pořadí injekce je kritické:
    //  1) fetch proxy – musí přepsat window.fetch dřív než kdokoli volá fetch,
    //  2) xchatApi – vystaví window.__xchatApi (centralizovaná XChat komunikace),
    //  3) room-messages – vlastní toolkit, který obojí používá.
    // `<script async=false>` v `injectPageScript` zajišťuje sériové provedení.
    injectPageScript('src/page/xchatFetchProxy.js');
    injectPageScript('src/page/xchatApi.js');
    injectPageScript('src/page/room-messages.js');
  }
}
