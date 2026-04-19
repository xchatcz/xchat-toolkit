/**
 * Typy pro XChat API – sjednocené z phplib a původního JS.
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

/** Pohlaví uživatele (0 = muž, 1 = žena). */
export type Sex = 0 | 1;

/** Hvězdička u uživatele – 0 bez, 1 modrá, 2 zelená, 3 žlutá, 4 červená, 5 černá. */
export type Star = 0 | 1 | 2 | 3 | 4 | 5;

/** Skin ID (viz SKIN_PALETTES). */
export type SkinId = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16;

/** Kontext aktuální místnosti – získaný z room-top-frame HTML. */
export interface RoomContext {
  rid: number;
  cid: number;
  uid: number;
  xhash: string;
  myNick: string;
  roomName: string;
  sex: Sex;
  skin: SkinId;
}

/** Detail uživatele ze scripts/user.php. */
export interface UserDetail {
  nick: string;
  firstName: string;
  lastName: string;
  age: number | null;
  certified: boolean;
  sex: Sex;
  star: Star;
  email: string;
  createdAt: number | null;
  lastOnlineAt: number | null;
  spokenSeconds: number;
  topPosition: number;
  photoUrl: string;
}

/** Záznam místnosti, kde je uživatel online (scripts/wonline.php). */
export interface UserRoomPresence {
  rid: number;
  idle: string;
  guestLink: string;
  roomName: string;
}

/** Přehled, kde je uživatel online. */
export interface WhereOnline {
  online: boolean;
  rooms: UserRoomPresence[];
}

/** Záznam místnosti ze scripts/rooms.php (rid, trvalá, počet lidí, název). */
export interface RoomListItem {
  rid: number;
  permanent: boolean;
  userCount: number;
  name: string;
}

/** Detail místnosti (scripts/room.php). */
export interface RoomDetail {
  rid: number;
  name: string;
  description: string;
  createdAt: number | null;
  userCount: number;
  admin: string;
  permanentAdmins: string[];
  www: string;
  map: string;
  cid: number;
}

/** Administrátor XChatu (scripts/admin.php). */
export interface AdminInfo {
  nick: string;
  sex: Sex;
  star: Star;
  online: boolean;
}

/** Zpráva v místnosti. */
export type RoomMessageKind = 'message' | 'whisper' | 'system' | 'advert';

export interface RoomMessage {
  id: string;
  kind: RoomMessageKind;
  /** Odchozí (moje) varianta – `umsg_roomi`, `umsg_whisperi`, … */
  outgoing?: boolean;
  time: string;
  nick: string | null;
  html: string;
  text: string;
  targetNick?: string | null;
  /** Barva fontu (pokud je `<font color="…">`). */
  color?: string | null;
}

/** Uživatel v místnosti. */
export interface RoomUser {
  nick: string;
  idleSeconds: number;
  onlineSince: string;
  star: Star;
  sex: Sex;
  certified: boolean;
  isAdmin: boolean;
  /** URL na avatarový obrázek, pokud byl v HTML nalezen. */
  avatarUrl?: string;
}

/** Záložka v pravém sloupci. */
export type SidebarTab = 'users' | 'smilies' | 'settings' | 'ignore' | 'admin';
