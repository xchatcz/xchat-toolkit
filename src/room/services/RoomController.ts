/**
 * RoomController – hlavní business logika Room UI mimo React komponenty.
 *
 * Drží frontu {@link requestQue}, provádí periodické načítání zpráv a
 * další endpoint voláme jen přes ni. Komponenty čtou state přes React
 * hooky ({@link useRoomStore}) napojené na jednoduchý publish/subscribe.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { XChatApi } from '../../api/XChatApi';
import type { RoomContext, RoomMessage, SkinId } from '../../api/types';
import { requestQue } from './RequestQue';
export interface RoomState {
  ctx: RoomContext | null;
  messages: RoomMessage[];
  loading: boolean;
  error: string | null;
  lastUpdatedAt: number;
}

type Listener = (s: RoomState) => void;

/** Jednoduché úložiště stavu pro Room – pub/sub (bez Reduxu). */
export class RoomStore {
  private state: RoomState = {
    ctx: null,
    messages: [],
    loading: false,
    error: null,
    lastUpdatedAt: 0,
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
    } catch (err) {
      console.error('[XChat Toolkit] RoomController.init selhal:', err);
      roomStore.set({
        loading: false,
        error: String((err as Error).message ?? err),
      });
    }
  }

  destroy(): void {
    this.stopRefresh?.();
    this.stopRefresh = null;
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
}
