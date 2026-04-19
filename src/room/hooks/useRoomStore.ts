/**
 * useRoomStore – React hook nad {@link roomStore} (pub/sub mimo React).
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useSyncExternalStore } from 'react';
import { roomStore, type RoomState } from '../services/RoomController';

const subscribe = (cb: () => void): (() => void) => roomStore.subscribe(cb);
const getSnapshot = (): RoomState => roomStore.get();

export const useRoomStore = (): RoomState =>
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
