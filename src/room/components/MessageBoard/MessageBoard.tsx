/**
 * MessageBoard – hlavní výpis zpráv.
 *
 * XChat vrací zprávy v pořadí **nejnovější nahoře**. Podle nastavení
 * `messageOrder` je buď ponecháme tak, nebo je obrátíme (nejnovější dole).
 * Auto-scroll směřuje vždy na okraj, kde leží nejčerstvější zpráva.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useEffect, useMemo, useRef } from 'react';
import { useRoomStore } from '../../hooks/useRoomStore';
import type { RoomMessage } from '../../../api/types';
import { toast } from '../../../core/toast';
import './MessageBoard.scss';

export interface MessageBoardProps {
  /** Pořadí zpráv – ovlivňuje render i směr auto-scrollu. */
  order: 'newest-first' | 'newest-last';
  /** Můj nick – pro highlight v příchozích zprávách. */
  myNick: string;
  /** Zvýrazňovat šeptané zprávy pozadím + proužkem. */
  highlightWhispers: boolean;
  /** Zvýrazňovat můj nick žlutě ve všech příchozích zprávách. */
  highlightMyNick: boolean;  /** Zvýraznit hlášky o vyhození z místnosti červenou barvou. */
  highlightKick: boolean;  /** Skrýt systémové hlášky „Špatný příkaz" úplně z výpisu. */
  hideBadCommand: boolean;  /** Filtr typu zobrazených zpráv (ovládání v InfoStripu). */
  messageFilter: 'all' | 'room' | 'whisper';
  /**
   * Barevné rozlišování zpráv podle uživatele. Při `false` ignorujeme inline
   * `color` z XChatu a vše se zobrazí jednotnou barvou skinu.
   */
  userColorsEnabled: boolean;
  /**
   * Vylepšené příkazy v místnosti – u hlášek `Info` / `Info2` přidá
   * odkaz `(profil)` na veřejný profil XChatu v novém okně.
   */
  enhancedRoomCommands: boolean;
  /** Klik na klikatelný nick v systémové zprávě → otevře šeptací okno. */
  onSelectUser: (nick: string) => void;
}

/** Escaping speciálních znaků pro regex (jméno uživatele). */
const escapeRegex = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Obalí výskyty nicku `myNick` v HTML žlutou značkou. Respektuje HTML tagy
 * a `&entity;` (nezasahuje dovnitř).
 */
const highlightNickInHtml = (html: string, myNick: string): string => {
  if (!myNick) return html;
  const re = new RegExp(
    `(^|[^\\p{L}\\p{N}_])(${escapeRegex(myNick)})(?=[^\\p{L}\\p{N}_]|$)`,
    'giu',
  );
  // Nahradíme jen v textových úsecích – rozdělíme podle tagů/entit.
  const parts = html.split(/(<[^>]+>|&[^;\s]+;)/g);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p || p[0] === '<' || (p[0] === '&' && p.endsWith(';'))) continue;
    parts[i] = p.replace(re, '$1<mark class="xct-msg__hl">$2</mark>');
  }
  return parts.join('');
};

const MessageBoard = ({
  order,
  myNick,
  highlightWhispers,
  highlightMyNick,
  highlightKick,
  hideBadCommand,
  messageFilter,
  userColorsEnabled,
  enhancedRoomCommands,
  onSelectUser,
}: MessageBoardProps) => {
  const { messages, lastUpdatedAt } = useRoomStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  // Udržujeme si, jestli uživatel sedí u okraje, kde přibývají nové zprávy.
  // Aktualizujeme při každém scrollu; při obnově zpráv rozhodne tenhle flag,
  // jestli dojedeme na čerstvý okraj, nebo necháme pozici být.
  const stickToEdgeRef = useRef(true);

  const display = useMemo(() => {
    let list = hideBadCommand
      ? messages.filter((m) => !m.isBadCommand)
      : messages;
    if (messageFilter === 'room') {
      // „Místnost" = schováváme jen šepty. Systémové hlášky, reklamy
      // a běžné zprávy zůstávají viditelné.
      list = list.filter((m) => m.kind !== 'whisper');
    } else if (messageFilter === 'whisper') {
      list = list.filter((m) => m.kind === 'whisper');
    }
    return order === 'newest-last' ? [...list].reverse() : list;
  }, [messages, order, hideBadCommand, messageFilter]);

  const EDGE_PX = 24; // tolerance – jemné posunutí nepovažujeme za „odscrollovaný"

  const handleScroll = (): void => {
    const el = scrollRef.current;
    if (!el) return;
    if (order === 'newest-last') {
      const distanceFromBottom = el.scrollHeight - el.clientHeight - el.scrollTop;
      stickToEdgeRef.current = distanceFromBottom <= EDGE_PX;
    } else {
      stickToEdgeRef.current = el.scrollTop <= EDGE_PX;
    }
  };

  // Obnova zpráv: skoč na okraj jen pokud tam uživatel sedí, jinak pozici nech.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    if (!stickToEdgeRef.current) return;
    el.scrollTop = order === 'newest-last' ? el.scrollHeight : 0;
  }, [lastUpdatedAt]);

  // Změna pořadí (z Options) – vždy skoč na čerstvý okraj a resetuj stick.
  useEffect(() => {
    stickToEdgeRef.current = true;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = order === 'newest-last' ? el.scrollHeight : 0;
  }, [order]);

  const boardClass =
    'xct-board' +
    (highlightWhispers ? ' xct-board--hl-whispers' : '') +
    (highlightMyNick ? ' xct-board--hl-mynick' : '') +
    (highlightKick ? ' xct-board--hl-kick' : '');

  // Delegace kliků: klikatelný nick uvnitř HTML (zabalený s `data-xct-whisper-nick`
  // v `transformSystemWhispers`) se zachytí tady a otevře šeptací okno.
  const handleBoardClick = (e: React.MouseEvent<HTMLDivElement>): void => {
    const target = e.target as HTMLElement | null;

    // Speciální systémová hláška „Uživatel X žádá o povolení vstupu" má
    // odkaz `(zde povolit)` mířící na `modchat?op=rightadmin&…&anick=NICK`.
    // Místo otevření nového okna stačí URL zavolat na pozadí (XChat to
    // potvrdí prostým fetchem) a zobrazit toast.
    //
    // POZN.: XChat původně dává `target="menupage"`, ale `normalizeLinksInHtml`
    // tu hodnotu přepíše na `_blank` – proto detekujeme PODLE URL, ne
    // podle atributu target.
    const link = target?.closest<HTMLAnchorElement>('a[href]');
    if (link) {
      const href = link.getAttribute('href') ?? '';
      if (/[?&]op=rightadmin\b/.test(href) && /[?&]anick=/.test(href)) {
        e.preventDefault();
        e.stopPropagation();
        const nick = decodeURIComponent(
          /[?&]anick=([^&]+)/.exec(href)?.[1] ?? '',
        );
        // Vizuálně označíme link jako „už klepnuto" (escape klikání 2×).
        link.classList.add('xct-msg__allow-link--pending');
        // Resolve relativní/absolutní URL přes location (jistota bez `<base>`).
        const absoluteUrl = (() => {
          try {
            return new URL(href, window.location.href).toString();
          } catch {
            return href;
          }
        })();
        // Stránka místnosti běží na `xchat.cz`, takže URL je same-origin
        // → přímý `fetch` (bez service worker proxy, ten u téhle URL
        // házel „Failed to fetch"). Cookies pošleme, redirect ignorujeme
        // (zajímá nás jen, že server request přijal a vrátil 2xx/3xx).
        void (async () => {
          try {
            const res = await fetch(absoluteUrl, {
              method: 'GET',
              credentials: 'include',
              cache: 'no-store',
              redirect: 'follow',
            });
            if (!res.ok) {
              throw new Error(`HTTP ${res.status} ${res.statusText}`);
            }
            toast.success(`Uživateli ${nick} povolen vstup`);
          } catch (err) {
            link.classList.remove('xct-msg__allow-link--pending');
            toast.error(`Povolení vstupu selhalo: ${String((err as Error)?.message ?? err)}`);
          }
        })();
        return;
      }
    }

    const nickEl = target?.closest<HTMLElement>('[data-xct-whisper-nick]');
    if (!nickEl) return;
    const nick = nickEl.getAttribute('data-xct-whisper-nick');
    if (!nick) return;
    e.preventDefault();
    e.stopPropagation();
    onSelectUser(nick);
  };

  return (
    <div className={boardClass} ref={scrollRef} onScroll={handleScroll} onClick={handleBoardClick}>
      {display.length === 0 ? (
        <div className="xct-board__empty">Žádné zprávy.</div>
      ) : (
        display.map((m) => (
          <MessageItem
            key={m.id}
            msg={m}
            myNick={myNick}
            highlightMyNick={highlightMyNick}
            userColorsEnabled={userColorsEnabled}
            enhancedRoomCommands={enhancedRoomCommands}
          />
        ))
      )}
    </div>
  );
};

interface MessageItemProps {
  msg: RoomMessage;
  myNick: string;
  highlightMyNick: boolean;
  userColorsEnabled: boolean;
  enhancedRoomCommands: boolean;
}

/** Escape pro vsazení řetězce do HTML atributu / textu. */
const escapeHtml = (s: string): string =>
  s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

/**
 * Detekuje výsledky příkazů `/info` a `/info2` (`Info:` / `Info2:` za
 * `System->Me:`) a přidá na konec bublinky odkaz `(profil)` v novém okně.
 * Anonymní URL `https://www.xchat.cz/$Nick` – bez xhash, bez trackingu.
 */
const appendProfileLink = (html: string, text: string): string => {
  // Pattern: `Info:` / `Info2:` následovaný (nick) – XChat dává nick jako
  // první token v závorce. Dovolíme v nicku i tečky / pomlčky / podtržítka.
  const m = text.match(/\bInfo2?:\s*\(([\p{L}\p{N}._-]+)\)/iu);
  if (!m) return html;
  const nick = m[1];
  const url = `https://www.xchat.cz/$${encodeURIComponent(nick)}`;
  const link =
    ` <a class="xct-msg__profile" href="${escapeHtml(url)}" target="_blank"` +
    ` rel="noopener noreferrer">(profil)</a>`;
  return html + link;
};

// ─── Normalizace odkazů ────────────────────────────────────────────────────
// Parametry odstraňované z každé URL (trackery). `utm_*` je jakákoliv varianta.
const TRACKING_PARAM_RE = /^(utm_.+|fbclid|gclid|mc_eid|mc_cid|yclid|_hsenc|_hsmi|igshid|mkt_tok)$/i;

/** Odstraní trackovací parametry z URL. Neplatné URL vrátí beze změny. */
const stripTrackingParams = (url: string): string => {
  try {
    const u = new URL(url);
    const keys: string[] = [];
    u.searchParams.forEach((_v, k) => {
      if (TRACKING_PARAM_RE.test(k)) keys.push(k);
    });
    for (const k of keys) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return url;
  }
};

// Regex URL v textových uzlech. Záměrně jen `http(s)://…` + `www.…`,
// abychom nechytali e-maily, smajlíky `*N*` apod. Koncová interpunkce
// (`.,;:!?)`)`) se ořízne, aby se nepřipojila do odkazu.
const URL_RE = /\b(https?:\/\/|www\.)[^\s<>"']+/gi;

/**
 * Normalizace odkazů v HTML zprávy:
 *  - text-plain URL → `<a>` (auto-link),
 *  - existující `<a>`: pokud jeho viditelný text není zkrácen třemi tečkami
 *    (`…` / `...`), přepíšeme `href` tak, aby odpovídal zobrazenému textu
 *    (XChat někdy do `href` dává tracker-link),
 *  - všem `<a>` nastavíme `target="_blank"` + `rel="noopener noreferrer"`,
 *  - ze všech `href` odstraníme `utm_*`, `fbclid` a podobné parametry.
 */
const normalizeLinksInHtml = (html: string): string => {
  if (!html) return html;
  try {
    const doc = new DOMParser().parseFromString(`<div>${html}</div>`, 'text/html');
    const root = doc.body.firstElementChild as HTMLElement | null;
    if (!root) return html;

    // 1) Auto-link textových uzlů mimo existující <a>.
    const textNodes: Text[] = [];
    const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n: Node | null = walker.nextNode();
    while (n) {
      const t = n as Text;
      if (!t.parentElement?.closest('a')) textNodes.push(t);
      n = walker.nextNode();
    }
    for (const tn of textNodes) {
      const src = tn.data;
      if (!/https?:\/\/|www\./i.test(src)) continue;
      const frag = doc.createDocumentFragment();
      let lastIdx = 0;
      const re = new RegExp(URL_RE.source, 'gi');
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        let url = m[0];
        // Ořež závěrečnou interpunkci, aby nebyla součástí odkazu.
        const trailing = url.match(/[.,;:!?)\]]+$/);
        if (trailing) url = url.slice(0, -trailing[0].length);
        const start = m.index;
        const end = start + url.length;
        if (start > lastIdx) {
          frag.appendChild(doc.createTextNode(src.slice(lastIdx, start)));
        }
        const href = url.startsWith('www.') ? `https://${url}` : url;
        const a = doc.createElement('a');
        a.href = href;
        a.textContent = url;
        frag.appendChild(a);
        lastIdx = end;
      }
      if (lastIdx === 0) continue;
      if (lastIdx < src.length) {
        frag.appendChild(doc.createTextNode(src.slice(lastIdx)));
      }
      tn.parentNode?.replaceChild(frag, tn);
    }

    // 2) Úprava všech <a>: href podle textu (pokud text není zkrácen),
    //    target/rel, strip trackerů.
    root.querySelectorAll('a').forEach((a) => {
      const text = (a.textContent ?? '').trim();
      const isTruncated = /…$|\.{3}$/.test(text);
      // Pokud zobrazený text sám vypadá jako URL a není zkrácený,
      // bereme ho jako zdroj pravdy pro href.
      if (!isTruncated && /^(https?:\/\/|www\.)\S+$/i.test(text)) {
        const canonical = text.startsWith('www.') ? `https://${text}` : text;
        a.setAttribute('href', canonical);
      }
      const href = a.getAttribute('href');
      if (href) {
        const cleaned = stripTrackingParams(href);
        if (cleaned !== href) a.setAttribute('href', cleaned);
      }
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });

    return root.innerHTML;
  } catch {
    return html;
  }
};

const MessageItem = ({
  msg,
  myNick,
  highlightMyNick,
  userColorsEnabled,
  enhancedRoomCommands,
}: MessageItemProps) => {
  // Modifikátory pro barvení / výrazné styly přímo na řádku zprávy.
  const mods: string[] = [`xct-msg--${msg.kind}`];
  if (msg.outgoing) mods.push('xct-msg--out');
  if (msg.kind === 'system' && msg.systemEvent) {
    mods.push(`xct-msg--sys-${msg.systemEvent}`);
  }
  // System->Me odpovědi (Info, příkazy nelze provést, Nick X byl vykopnut …)
  // chceme renderovat stejně velkým písmem jako běžné zprávy – ne v malém
  // systémovém fontu určeném pro join/leave hlášky.
  if (
    msg.kind === 'system' &&
    msg.nick?.toLowerCase() === 'system' &&
    !!msg.targetNick
  ) {
    mods.push('xct-msg--sys-to-me');
  }
  if (msg.isSelfKickAttempt) mods.push('xct-msg--kick-attempt');
  if (msg.isBadCommand) mods.push('xct-msg--bad-cmd');
  if (msg.kind === 'advert') mods.push('xct-msg--advert');

  // Advert má vynucenou barvu #aa0088 přes CSS – inline `msg.color` od XChatu
  // u reklamy ignorujeme. Ostatní typy berou barvu z atributu `color`, ale
  // jen pokud je povolené barevné rozlišování uživatelů.
  const style =
    userColorsEnabled && msg.color && msg.kind !== 'advert'
      ? { color: msg.color }
      : undefined;

  // Tučně a případně žlutý highlight mého nicku – pouze když je v Options
  // zapnuto `highlightMyNick` a jde o příchozí zprávu (ne můj outgoing,
  // ne system/advert).
  const canHl =
    highlightMyNick &&
    !!myNick &&
    !msg.outgoing &&
    msg.kind !== 'system' &&
    msg.kind !== 'advert';
  let bodyHtml = canHl ? highlightNickInHtml(msg.html, myNick) : msg.html;

  // Vylepšené příkazy: na /info a /info2 přidáme za text odkaz na profil.
  // Detekce přes `msg.text` – filtrujeme jen whispery od `System` adresované
  // mně, aby se link nepřipojil třeba u reklamy která má v textu „Info2:".
  if (
    enhancedRoomCommands &&
    msg.kind === 'whisper' &&
    msg.nick?.toLowerCase() === 'system' &&
    !!msg.targetNick &&
    msg.targetNick.toLowerCase() === myNick.toLowerCase()
  ) {
    bodyHtml = appendProfileLink(bodyHtml, msg.text);
  }

  // Normalizace odkazů: auto-link plain-text URL, target=_blank + strip
  // trackovacích parametrů, oprava href u netruncated aktivních odkazů.
  // Reklamu necháváme beze změny – XChat tam dává vlastní affiliate.
  if (msg.kind !== 'advert') {
    bodyHtml = normalizeLinksInHtml(bodyHtml);
  }

  // Příchozí šept se zobrazuje s prefixem `Sender->MyNick:` – i tady chceme
  // můj nick zvýraznit (v `.xct-msg__target`). U odchozích zpráv nic
  // nezvýrazňujeme (stejné pravidlo jako u těla zprávy, viz `canHl`).
  const nickIsMe =
    canHl && !!msg.nick && msg.nick.toLowerCase() === myNick.toLowerCase();
  const targetIsMe =
    canHl &&
    !!msg.targetNick &&
    msg.targetNick.toLowerCase() === myNick.toLowerCase();

  return (
    <div className={`xct-msg ${mods.join(' ')}`} style={style}>
      {msg.time ? (
        <>
          <span className="xct-msg__time">{msg.time}</span>
          {' '}
        </>
      ) : null}
      <span className="xct-msg__body">
        {msg.nick ? (
          <span className="xct-msg__nick">
            {nickIsMe ? <mark className="xct-msg__hl">{msg.nick}</mark> : msg.nick}
            {msg.targetNick ? (
              <span className="xct-msg__target">
                {'->'}
                {targetIsMe ? (
                  <mark className="xct-msg__hl">{msg.targetNick}</mark>
                ) : (
                  msg.targetNick
                )}
              </span>
            ) : null}
            {': '}
          </span>
        ) : null}
        <span className="xct-msg__text" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
      </span>
    </div>
  );
};

export default MessageBoard;

