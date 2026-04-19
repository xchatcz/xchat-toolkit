/**
 * Registr všech funkcí rozšíření (non-React stránky + Room React app jako feature).
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { Feature } from './Feature';
import { ForumFavourite } from '../features/Forum/ForumFavourite';
import { MessageCopy } from '../features/Messages/MessageCopy';
import { MessageReplyFix } from '../features/Messages/MessageReplyFix';
import { RoomApp } from '../features/Room/RoomApp';

export const FEATURES: readonly Feature[] = Object.freeze([
  new RoomApp(),
  new MessageCopy(),
  new MessageReplyFix(),
  new ForumFavourite(),
]);
