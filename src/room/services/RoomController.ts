/**
 * RoomController – hlavní business logika Room UI mimo React komponenty.
 *
 * Drží frontu {@link requestQue}, provádí periodické načítání zpráv a
 * další endpoint voláme jen přes ni. Komponenty čtou state přes React
 * hooky ({@link useRoomStore}) napojené na jednoduchý publish/subscribe.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { XChatApi, XChatRooms, XCT_LOG } from '../../api/XChatApi';
import type {
  FavouriteUser,
  RoomContext,
  RoomMessage,
  RoomUser,
  SkinId,
} from '../../api/types';
import { requestQue } from './RequestQue';

export interface RoomState {
  ctx: RoomContext | null;
  messages: RoomMessage[];
  users: RoomUser[];
  loading: boolean;
  error: string | null;
  lastUpdatedAt: number;
  /** WTKN token pro odesílání zpráv (získá se jednou po vstupu do místnosti). */
  wtkn: string | null;
  favourites: FavouriteUser[];
  /**
   * Nicky uživatelů, kteří právě vstoupili do místnosti – pro jemnou pulsaci
   * v seznamu v Sidebaru. Nicky v original-case. Po 5 s každý sám odpadne.
   */
  recentJoiners: string[];
}

type Listener = (s: RoomState) => void;

/** Jednoduché úložiště stavu pro Room – pub/sub (bez Reduxu). */
export class RoomStore {
  private state: RoomState = {
    ctx: null,
    messages: [],
    users: [],
    loading: false,
    error: null,
    lastUpdatedAt: 0,
    wtkn: null,
    favourites: [],
    recentJoiners: [],
  };
  private readonly listeners = new Set<Listener>();

  get(): RoomState {
    return this.state;
  }

  set(partial: Partial<RoomState>): void {
    this.state = { ...this.state, ...partial };
    for (const l of this.listeners) l(this.state);
  }

  subscribe(l: Listener): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }
}

export const roomStore = new RoomStore();

export class RoomController {
  private stopRefresh: (() => void) | null = null;
  private stopUsersRefresh: (() => void) | null = null;
  /** Parametry pro opětovné spuštění message refreshe po force reloadu. */
  private messageRefreshCtx: RoomContext | null = null;
  private messageRefreshIntervalMs = 0;
  /**
   * Klíče systémových zpráv (`time::text`), které jsme už zpracovali.
   * Používá se k detekci nově příchozích join/leave hlášek, abychom
   * na každou zareagovali jen jednou.
   */
  private readonly seenSystemKeys = new Set<string>();
  /** První batch zpráv po vstupu do místnosti – neoznačujeme jako nové. */
  private firstMessagesSeen = false;
  /** Timery pro odstranění nicků ze `recentJoiners` po 5 s. */
  private readonly pulseTimers = new Map<string, number>();

  /** Doba, po kterou nick pulsuje v seznamu uživatelů (5 s dle zadání). */
  private static readonly PULSE_DURATION_MS = 5000;

  /** Extrahuje xhash a slug ze současné URL `/~$xhash/modchat/room/{slug}`. */
  static parseLocation(): { xhash: string; slug: string } | null {
    const m = location.pathname.match(/^\/~(\$[^/]+)\/modchat\/room\/([^/?#]+)\/?$/);
    if (!m) return null;
    return { xhash: m[1], slug: m[2] };
  }

  async init(
    skinId: SkinId | 'auto',
    refreshIntervalSec: number,
    logWtknOnLoad = false,
  ): Promise<void> {
    const loc = RoomController.parseLocation();
    if (!loc) {
      roomStore.set({ error: 'Neznámé URL – nejde o stránku místnosti.' });
      return;
    }
    roomStore.set({ loading: true, error: null });

    try {
      const ctx = await requestQue.enqueue(
        () => XChatApi.getRoomContext(loc.xhash, loc.slug),
        'room-context',
      );
      if (!ctx) {
        // Zkusíme uložit syrovou odpověď pro diagnostiku.
        console.warn('[XChat Toolkit] parseRoomContext vrátil null – viz Network panel.');
        throw new Error(
          'Nepodařilo se naparsovat kontext místnosti (var rid ani <frame src> nebyly rozpoznány).',
        );
      }
      // Pokud uživatel zvolil 'auto', necháme skin, který vrátil XChat.
      // Jinak přepíšeme paletu vybraným skinem z Options.
      const effectiveSkin: SkinId = skinId === 'auto' ? ctx.skin : skinId;
      const ctxWithSkin: RoomContext = { ...ctx, skin: effectiveSkin };
      roomStore.set({ ctx: ctxWithSkin, loading: false });
      this.startMessageRefresh(ctxWithSkin, refreshIntervalSec);
      this.startUsersRefresh(ctxWithSkin);

      // Paralelně: WTKN token + oblíbení. Neblokujeme init.
      void this.loadWtkn(ctxWithSkin, logWtknOnLoad);
      void this.loadFavourites(ctxWithSkin.xhash);
    } catch (err) {
      console.error('[XChat Toolkit] RoomController.init selhal:', err);
      roomStore.set({
        loading: false,
        error: String((err as Error).message ?? err),
      });
    }
  }

  /** Jednorázově načte WTKN token pro odesílání zpráv. */
  private async loadWtkn(ctx: RoomContext, logOnLoad: boolean): Promise<void> {
    try {
      const wtkn = await requestQue.enqueue(
        () => XChatApi.getWtknToken(ctx.xhash, ctx.rid, ctx.skin),
        'wtkn',
      );
      roomStore.set({ wtkn });
      if (logOnLoad && wtkn) {
        // Záměrně přes přímý `console.log`, aby se vypsalo nezávisle na
        // zapnutých kategoriích XCT_LOG (uživatel si o to explicitně řekl).
        // Doplníme i zdroj parsování (form-action / input / js-var / fallback)
        // a URL textpageng – ať se dá ručně ověřit přes Network panel.
        let source = '?';
        let url = '?';
        try {
          const diag = (window as unknown as Record<string, unknown>)
            .__XCT_TEXTPAGENG as { html?: string; url?: string } | undefined;
          if (diag?.html) {
            source = XChatRooms.parseWtknWithSource(diag.html)?.source ?? '?';
          }
          if (diag?.url) url = diag.url;
        } catch {
          /* ignore */
        }
        // eslint-disable-next-line no-console
        console.log(
          '[XChat Toolkit] WTKN token:',
          wtkn,
          `(source: ${source})`,
          `\n  url: ${url}`,
          '\n  tip: copy(window.__XCT_TEXTPAGENG.html)',
        );
      }
    } catch (err) {
      XCT_LOG.warn('loadWtkn selhal:', err);
    }
  }

  /** Načte oblíbené (VIP) z Notes. */
  private async loadFavourites(xhash: string): Promise<void> {
    try {
      const favs = await requestQue.enqueue(
        () => XChatApi.getFavouriteUsers(xhash),
        'favourites',
      );
      roomStore.set({ favourites: favs });
    } catch (err) {
      XCT_LOG.warn('loadFavourites selhal:', err);
    }
  }

  /**
   * Odeslání zprávy (volá MessageForm). Target `""` nebo `"~"` = všem.
   * Při stale WTKN high-level `sendMessageToRoom` sám obnoví token.
   * Po úspěšném odeslání okamžitě refreshne sklo (reset intervalu),
   * aby se nově poslaná zpráva hned objevila.
   */
  async send(text: string, target: string): Promise<void> {
    const msg = text.trim();
    if (!msg) return;
    const state = roomStore.get();
    const ctx = state.ctx;
    if (!ctx) throw new Error('Kontext místnosti není načten.');

    const tgt = target && target !== '' ? target : '~';
    const { wtkn } = await XChatApi.sendMessageToRoom(
      ctx.xhash,
      ctx.rid,
      ctx.skin,
      msg,
      tgt,
      state.wtkn,
    );
    // Uložíme (potenciálně obnovený) WTKN zpět do store.
    if (wtkn !== state.wtkn) roomStore.set({ wtkn });
    // Force refresh – zpráva se objeví okamžitě, ne až za interval.
    void this.forceRefreshMessages();
  }

  /**
   * Okamžitě natáhne zprávy z místnosti a resetuje periodický interval.
   * Použití: po odeslání zprávy, po kliknutí „Obnovit", …
   */
  async forceRefreshMessages(): Promise<void> {
    const ctx = this.messageRefreshCtx;
    if (!ctx) return;
    try {
      const messages = await requestQue.enqueue(
        () => XChatApi.getRoomMessages(ctx.xhash, ctx.rid, ctx.skin),
        'room-messages-force',
      );
      roomStore.set({ messages, lastUpdatedAt: Date.now() });
      this.processSystemEvents(messages);
    } catch (err) {
      XCT_LOG.warn('forceRefreshMessages selhal:', err);
    }
    // Interval znovu nastartujeme, aby další tick šel od teď.
    if (this.messageRefreshIntervalMs > 0) {
      this.startMessageRefresh(ctx, this.messageRefreshIntervalMs / 1000);
    }
  }

  /**
   * Mimořádný refresh seznamu uživatelů – volá se když detekujeme
   * systémovou zprávu o příchodu / odchodu uživatele, abychom nečekali
   * na pravidelný 10s interval.
   */
  async forceRefreshUsers(): Promise<void> {
    const ctx = this.messageRefreshCtx;
    if (!ctx) return;
    try {
      const users = await requestQue.enqueue(
        () => XChatApi.getRoomUsers(ctx.xhash, ctx.rid, ctx.skin),
        'room-users-force',
      );
      roomStore.set({ users });
    } catch (err) {
      XCT_LOG.warn('forceRefreshUsers selhal:', err);
    }
  }

  destroy(): void {
    this.stopRefresh?.();
    this.stopRefresh = null;
    this.stopUsersRefresh?.();
    this.stopUsersRefresh = null;
    for (const t of this.pulseTimers.values()) window.clearTimeout(t);
    this.pulseTimers.clear();
    requestQue.clear();
  }

  private startMessageRefresh(ctx: RoomContext, intervalSec: number): void {
    this.stopRefresh?.();
    this.messageRefreshCtx = ctx;
    this.messageRefreshIntervalMs = intervalSec * 1000;
    this.stopRefresh = requestQue.every(
      intervalSec * 1000,
      async () => {
        const messages = await XChatApi.getRoomMessages(ctx.xhash, ctx.rid, ctx.skin);
        roomStore.set({ messages, lastUpdatedAt: Date.now() });
        this.processSystemEvents(messages);
      },
      'room-messages',
    );
  }

  private startUsersRefresh(ctx: RoomContext): void {
    this.stopUsersRefresh?.();
    this.stopUsersRefresh = requestQue.every(
      10_000,
      async () => {
        try {
          const users = await XChatApi.getRoomUsers(ctx.xhash, ctx.rid, ctx.skin);
          roomStore.set({ users });
        } catch (err) {
          XCT_LOG.warn('startUsersRefresh tick selhal:', err);
        }
      },
      'room-users',
    );
  }

  /**
   * Prohledá čerstvé systémové zprávy a:
   *  - Na každý detekovaný příchod / odchod vyvolá {@link forceRefreshUsers}
   *    (seznam uživatelů se tak ihned aktualizuje, nečekáme 10 s interval).
   *  - Příchozí uživatele přidá do `recentJoiners` a po 5 s je zase odebere –
   *    to se v UI projeví jemnou pulsací v sidebaru.
   *
   * První batch zpráv (hned po vstupu do místnosti) ignorujeme, protože jsou
   * tam i staré hlášky z minulosti – ty nechceme zpětně pulsovat.
   */
  private processSystemEvents(messages: RoomMessage[]): void {
    if (!this.firstMessagesSeen) {
      for (const m of messages) {
        if (m.kind === 'system') this.seenSystemKeys.add(RoomController.sysKey(m));
      }
      this.firstMessagesSeen = true;
      return;
    }
    let anyChange = false;
    const newJoiners: string[] = [];
    for (const m of messages) {
      if (m.kind !== 'system') continue;
      const key = RoomController.sysKey(m);
      if (this.seenSystemKeys.has(key)) continue;
      this.seenSystemKeys.add(key);
      if (!m.systemEvent) continue;
      // Nick získáme z HTML: `<b class="system …">NICK</b>` (u "kicked" je
      // to vyhozený uživatel – toho taky okamžitě refreshneme, odešel).
      const nickMatch = m.html.match(
        /<b[^>]*class=["'][^"']*\bsystem\s+(?:in|out|kicked)\b[^"']*["'][^>]*>([^<]+)<\/b>/i,
      );
      const nick = nickMatch
        ? RoomController.decodeEntities(nickMatch[1]).trim()
        : '';
      anyChange = true;
      if (m.systemEvent === 'join' && nick) newJoiners.push(nick);
    }
    if (anyChange) {
      void this.forceRefreshUsers();
    }
    for (const nick of newJoiners) {
      this.markJoiner(nick);
    }
    // Zabraň neomezenému růstu seznamu – pamatujeme si jen posledních 500.
    if (this.seenSystemKeys.size > 500) {
      const arr = Array.from(this.seenSystemKeys);
      this.seenSystemKeys.clear();
      for (const k of arr.slice(-250)) this.seenSystemKeys.add(k);
    }
  }

  private static sysKey(m: RoomMessage): string {
    return `${m.time}::${m.text}`;
  }

  private static decodeEntities(s: string): string {
    const el = document.createElement('textarea');
    el.innerHTML = s;
    return el.value;
  }

  private markJoiner(nick: string): void {
    const key = nick.toLowerCase();
    const prev = roomStore.get().recentJoiners;
    if (!prev.some((n) => n.toLowerCase() === key)) {
      roomStore.set({ recentJoiners: [...prev, nick] });
    }
    const existing = this.pulseTimers.get(key);
    if (existing) window.clearTimeout(existing);
    const t = window.setTimeout(() => {
      const curr = roomStore.get().recentJoiners;
      roomStore.set({
        recentJoiners: curr.filter((n) => n.toLowerCase() !== key),
      });
      this.pulseTimers.delete(key);
    }, RoomController.PULSE_DURATION_MS);
    this.pulseTimers.set(key, t);
  }
}
