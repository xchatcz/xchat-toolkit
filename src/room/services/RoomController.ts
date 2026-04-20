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

/** Výstup `XChatApi.getSendContext` uložený v paměti RoomControlleru. */
export interface SendCtx {
  wtkn: string | null;
  action: string;
  hiddenInputs: Record<string, string>;
  recipients: Array<{ value: string; label: string }>;
  textInputName: string;
  submitName: string;
  submitValue: string;
}

export interface RoomState {
  ctx: RoomContext | null;
  messages: RoomMessage[];
  users: RoomUser[];
  loading: boolean;
  error: string | null;
  lastUpdatedAt: number;
  sendCtx: SendCtx | null;
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
    sendCtx: null,
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

      // Paralelně: send-context (wtkn, form) + oblíbení. Neblokujeme init.
      void this.loadSendContext(ctxWithSkin);
      void this.loadFavourites(ctxWithSkin.xhash);
    } catch (err) {
      console.error('[XChat Toolkit] RoomController.init selhal:', err);
      roomStore.set({
        loading: false,
        error: String((err as Error).message ?? err),
      });
    }
  }

  /** Načte form+wtkn pro odesílání zpráv. */
  private async loadSendContext(ctx: RoomContext): Promise<void> {
    try {
      const sc = await requestQue.enqueue(
        () => XChatApi.getSendContext(ctx.xhash, ctx.rid, ctx.skin),
        'send-ctx',
      );
      roomStore.set({ sendCtx: sc });
    } catch (err) {
      XCT_LOG.warn('loadSendContext selhal:', err);
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
   * Při první chybě (wtkn stale) automaticky obnoví sendCtx a zkusí znovu.
   */
  async send(text: string, target: string): Promise<void> {
    const msg = text.trim();
    if (!msg) return;
    const state = roomStore.get();
    const ctx = state.ctx;
    if (!ctx) throw new Error('Kontext místnosti není načten.');

    let sc = state.sendCtx;
    if (!sc) {
      sc = await XChatApi.getSendContext(ctx.xhash, ctx.rid, ctx.skin);
      if (!sc) throw new Error('Formulář pro odeslání nebyl nalezen.');
      roomStore.set({ sendCtx: sc });
    }

    const tgt = target && target !== '' ? target : '~';
    try {
      await XChatApi.sendRoomMessage(sc, msg, tgt);
    } catch (err) {
      XCT_LOG.warn('send: první pokus selhal – obnovuji wtkn', err);
      const fresh = await XChatApi.getSendContext(ctx.xhash, ctx.rid, ctx.skin);
      if (!fresh) throw err;
      roomStore.set({ sendCtx: fresh });
      await XChatApi.sendRoomMessage(fresh, msg, tgt);
    }
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
          const users = await XChatApi.getRoomUsers(ctx.xhash, ctx.rid, ctx.cid, ctx.skin);
          roomStore.set({ users });
        } catch (err) {
          XCT_LOG.warn('startUsersRefresh tick selhal:', err);
        }
      },
      'room-users',
    );
  }
}
