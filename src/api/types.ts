/**
 * Typy pro XChat API – sjednocené z phplib a původního JS.
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

/** Pohlaví uživatele (0 = muž, 1 = žena). */
export type Sex = 0 | 1;

/**
 * Hvězdička u uživatele – přesně ty hodnoty, co používá XChat v URL
 * obrázku `…/star/x{N}.gif`:
 *   0  = žádná
 *   1  = černá
 *   2  = modrá
 *   4  = zelená
 *   8  = žlutá
 *   16 = červená
 */
export type Star = 0 | 1 | 2 | 4 | 8 | 16;

/** Skin ID (viz SKIN_PALETTES). */
export type SkinId = 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 26 | 44 | 45 | 46 | 47 | 48;

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

/**
 * Detail místnosti z dialogu `modchat?op=roominfo&rid=…`.
 *
 * Narozdíl od {@link RoomDetail} (který je plain-text z `scripts/room.php`)
 * tahle struktura přichází z HTML tabulky s řádky „název / kategorie / popis
 * / jazyk / správce / stálý správce / fórum / srazy / filtry…". Uchováváme
 * popis jako HTML, aby byly zachované smajlíky `<img>` a odkazy.
 */
export interface RoomInfoDialog {
  name: string;
  category: string;
  /** HTML (smajlíky `<img>`, odkazy). */
  descriptionHtml: string;
  /** Plain-text fallback pro alty smajlíků. */
  descriptionText: string;
  language: string;
  admin: string;
  permanentAdmin: string;
  forum: { label: string; href: string } | null;
  meetings: string;
  filters: {
    minutes: string;
    allowed: string;
    stars: string;
    sex: string;
    phone: string;
  };
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
  /**
   * Typ systémové události – používá se pro styling a pro
   * {@link RoomController.processSystemEvents}.
   */
  systemEvent?: 'join' | 'leave' | 'kick' | null;
  /** `System->Me: Nick X se tě pokouší vykopnout`. */
  isSelfKickAttempt?: boolean;
  /** `System->Me: Špatný příkaz`. */
  isBadCommand?: boolean;
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

/** Stálý správce místnosti (scripts/ss.php). */
export interface PermanentRoomAdmin {
  nick: string;
  online: boolean;
}

/** Oblíbený uživatel z poznámek (Notes). */
export interface FavouriteUser {
  nick: string;
  vip: boolean;
  enter: boolean;
  sms: boolean;
  /** Místnosti, kde je nick aktuálně online (rid + název). */
  rooms: Array<{ rid: number; roomName: string }>;
  /** Textový popis z poznámek. */
  comment: string[];
}

/** Záložka v pravém sloupci. */
export type SidebarTab = 'users' | 'smilies' | 'settings' | 'ignore' | 'admin' | 'adminsOnline';

// ─── Správa místnosti (tab „Správce") ───────────────────────────────────────

/**
 * Data ze stránky `modchat?op=rightadmin` – „Správcovské akce" v místnosti.
 * Obsahuje seznam kandidátů pro předání, výběr uživatelů pro vyhození a
 * „vzít zpět", plus aktuální popisek místnosti.
 */
export interface RightAdminData {
  /** Kandidáti na nového správce (select #sel_newadmin). */
  newAdminCandidates: string[];
  /** Uživatelé v místnosti, které lze vyhodit (select #sel_kick). */
  kickCandidates: string[];
  /** Vyhození uživatelé, které lze vzít zpět (select name="unk"). */
  unkickCandidates: string[];
  /** Aktuální popisek místnosti (input name="desc"). */
  desc: string;
}

/**
 * Data ze stránky `modchat?op=adminpageng` – „Správce – další volby".
 * Obsahuje filtry vstupu, nastavení místnosti a seznam klíčů (g/b).
 */
export interface AdminPageData {
  /** Min. minut online (time_filter). */
  timeFilter: number;
  /** Filtr certifikace (cert_filter): 0 = všichni, 1 = jen certifikovaní. */
  certFilter: 0 | 1;
  /** Filtr hvězdiček (star_filter): 0 = všichni, 2 = modré+, 4 = zelené+, 8 = žluté+. */
  starFilter: 0 | 2 | 4 | 8;
  /** Filtr pohlaví (sex_filter): -1 = všichni, 0 = muži, 1 = ženy. */
  sexFilter: -1 | 0 | 1;
  /** Nastavení místnosti. */
  locked: boolean;
  nohist: boolean;
  nowhisper: boolean;
  phone: boolean;
  /** Jazyk místnosti: 0 = CZ, 1 = US, 2 = SK. */
  lang: 0 | 1 | 2;
  /** Seznam klíčů (povolení/zakázaní uživatelé). */
  keys: AdminKeyEntry[];
}

/** Záznam v seznamu klíčů místnosti. */
export interface AdminKeyEntry {
  nick: string;
  /** 'g' = povolený, 'b' = zakázaný. */
  action: 'g' | 'b';
  /** Nick toho, kdo klíč naposledy upravil (z title="…"). */
  modifiedBy: string;
  /** Hvězdička editora (z `<img src="…/star/xN.gif">` nebo `g.gif`). */
  modifierStar: Star;
}

/** Data ze stránky `room/intro.php` – vstupní podmínky a popisek. */
export interface RoomIntroData {
  /** Popisek místnosti (textarea r_title, max 50 znaků). */
  title: string;
  /** Podmínky vstupu (textarea r_disclaimer). */
  disclaimer: string;
  /** Heslo – parsujeme, ale do UI nejde; při save se vrací nezměněné. */
  pass: string;
  /** Vyžadovat opsání kódu (checkbox r_captcha). */
  captcha: boolean;
  /** Barva písma (6 hex znaků bez #) – preserve-only. */
  fontcolor: string;
  /** Barva boxíků – preserve-only. */
  color: string;
  /** URL obrázku na pozadí – preserve-only. */
  image: string;
}

