/**
 * RoomController – hlavní business logika Room UI mimo React komponenty.
 *
 * Drží frontu {@link requestQue}, provádí periodické načítání zpráv a
 * další endpoint voláme jen přes ni. Komponenty čtou state přes React
 * hooky ({@link useRoomStore}) napojené na jednoduchý publish/subscribe.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { XChatApi, XCT_LOG } from '../../api/XChatApi';
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

  /** Extrahuje xhash a slug ze současné URL `/~$xhash/modchat/room/{slug}`. */
  static parseLocation(): { xhash: string; slug: string } | null {
    const m = location.pathname.match(/^\/~(\$[^/]+)\/modchat\/room\/([^/?#]+)\/?$/);
    if (!m) return null;
    return { xhash: m[1], slug: m[2] };
  }

  async init(skinId: SkinId, refreshIntervalSec: number): Promise<void> {
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
      const ctxWithSkin: RoomContext = { ...ctx, skin: skinId };
      roomStore.set({ ctx: ctxWithSkin, loading: false });
      this.startMessageRefresh(ctxWithSkin, refreshIntervalSec);
      this.startUsersRefresh(ctxWithSkin);

      // Paralelně: WTKN token + oblíbení. Neblokujeme init.
      void this.loadWtkn(ctxWithSkin);
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
  private async loadWtkn(ctx: RoomContext): Promise<void> {
    try {
      const wtkn = await requestQue.enqueue(
        () => XChatApi.getWtknToken(ctx.xhash, ctx.rid, ctx.skin),
        'wtkn',
      );
      roomStore.set({ wtkn });
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
  }

  destroy(): void {
    this.stopRefresh?.();
    this.stopRefresh = null;
    this.stopUsersRefresh?.();
    this.stopUsersRefresh = null;
    requestQue.clear();
  }

  private startMessageRefresh(ctx: RoomContext, intervalSec: number): void {
    this.stopRefresh?.();
    this.stopRefresh = requestQue.every(
      intervalSec * 1000,
      async () => {
        const messages = await XChatApi.getRoomMessages(ctx.xhash, ctx.rid, ctx.skin);
        roomStore.set({ messages, lastUpdatedAt: Date.now() });
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
}
