/**
 * DebugSection – přepínače pro console logy a diagnostické výpisy.
 * Nastavení ukládáme pod feature `room-app`, ale platí pro celé rozšíření
 * (XCT_LOG je globální singleton konfigurovaný z mount.tsx).
 *
 * HTTP requesty se logují per kategorie (Odeslání, Refresh okna, Načtení
 * textů pro šeptání atd.), aby konzole nebyla zaplavená opakujícími se
 * refresh requesty.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import {
  HTTP_CATEGORY_LABELS,
  HTTP_CATEGORY_ORDER,
  type XctHttpCategory,
  type XctHttpFlags,
} from '../../api/XChatApi';

export interface DebugSectionProps {
  options: Record<string, unknown>;
  /** `key` ukládá do `room-app.<key>`. */
  onChange: (key: string, value: unknown) => void;
}

const EMPTY_HTTP_FLAGS: XctHttpFlags = {
  send: false,
  messages: false,
  users: false,
  'text-page': false,
  context: false,
  favourites: false,
  other: false,
};

const DebugSection = ({ options, onChange }: DebugSectionProps) => {
  const debug = (options.debug ?? {}) as Record<string, unknown>;

  const httpFlags: XctHttpFlags = {
    ...EMPTY_HTTP_FLAGS,
    ...((debug.logHttp ?? {}) as Partial<XctHttpFlags>),
  };

  const setDebug = (key: string, value: unknown): void => {
    onChange('debug', { ...debug, [key]: value });
  };

  const setHttp = (cat: XctHttpCategory, value: boolean): void => {
    setDebug('logHttp', { ...httpFlags, [cat]: value });
  };

  const setAllHttp = (value: boolean): void => {
    const next: XctHttpFlags = { ...EMPTY_HTTP_FLAGS };
    for (const c of HTTP_CATEGORY_ORDER) next[c] = value;
    setDebug('logHttp', next);
  };

  const allHttpOn = HTTP_CATEGORY_ORDER.every((c) => httpFlags[c]);

  const getBool = (key: string, def: boolean): boolean => {
    const v = debug[key];
    return typeof v === 'boolean' ? v : def;
  };

  return (
    <div className="xct-opt-debug">
      <p className="xct-opt-debug__intro">
        Přepíná hlášky vypisované do vývojářské konzole (F12). Nastavení se
        projeví při příštím vstupu do místnosti.
      </p>

      {/* HTTP requesty per kategorie */}
      <div className="xct-opt-debug__group">
        <div className="xct-opt-debug__group-head">
          <span className="xct-opt-debug__group-title">
            Logovat HTTP requesty
          </span>
          <button
            type="button"
            className="xct-opt-debug__bulk"
            onClick={() => setAllHttp(!allHttpOn)}
          >
            {allHttpOn ? 'Vypnout vše' : 'Zapnout vše'}
          </button>
        </div>
        <p className="xct-opt-debug__desc">
          Pro každou kategorii zvlášť – status, metoda, čas a velikost
          odpovědi.
        </p>
        <ul className="xct-opt-debug__sublist">
          {HTTP_CATEGORY_ORDER.map((cat) => (
            <li key={cat} className="xct-opt-debug__subitem">
              <label>
                <input
                  type="checkbox"
                  checked={httpFlags[cat]}
                  onChange={(e) => setHttp(cat, e.target.checked)}
                />
                <span className="xct-opt-debug__name">
                  {HTTP_CATEGORY_LABELS[cat]}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {/* Ostatní hlášky */}
      <ul className="xct-opt-debug__list">
        <li className="xct-opt-debug__item">
          <label>
            <input
              type="checkbox"
              checked={getBool('logInfo', false)}
              onChange={(e) => setDebug('logInfo', e.target.checked)}
            />
            <span className="xct-opt-debug__name">Informační hlášky (info)</span>
          </label>
          <p className="xct-opt-debug__desc">
            Parsery, rozpoznaný kontext místnosti, „submit OK", „getRoomMessages
            → N zpráv", zdroj WTKN tokenu apod.
          </p>
        </li>

        <li className="xct-opt-debug__item">
          <label>
            <input
              type="checkbox"
              checked={getBool('logWarn', true)}
              onChange={(e) => setDebug('logWarn', e.target.checked)}
            />
            <span className="xct-opt-debug__name">Varování (warn)</span>
          </label>
          <p className="xct-opt-debug__desc">
            Retry WTKN, chybějící kontext, nerozpoznané řádky. Chyby (error) se
            vypisují vždy.
          </p>
        </li>
      </ul>
    </div>
  );
};

export default DebugSection;
