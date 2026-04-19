/**
 * Centrální registr všech funkcí XChat Toolkitu.
 * Pořadí definuje i pořadí v Options stránce.
 */

import { DisableRoomPopup } from './DisableRoomPopup.js';
import { RoomSidebarHide } from './RoomSidebarHide.js';
import { RoomMessages } from './RoomMessages.js';
import { FavouriteEmojis } from './FavouriteEmojis.js';
import { FavouriteUsers } from './FavouriteUsers.js';
import { MoreSmiles } from './MoreSmiles.js';
import { ForumFavourite } from './ForumFavourite.js';
import { MessageCopy } from './MessageCopy.js';
import { MessageReplyFix } from './MessageReplyFix.js';

export const ALL_FEATURES = [
  RoomMessages,
  RoomSidebarHide,
  FavouriteEmojis,
  FavouriteUsers,
  MoreSmiles,
  DisableRoomPopup,
  ForumFavourite,
  MessageCopy,
  MessageReplyFix,
];
