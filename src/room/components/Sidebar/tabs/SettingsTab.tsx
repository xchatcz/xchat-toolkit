/**
 * SettingsTab – rychlé nastavení místnosti (skin, interval atd.).
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import type { RoomContext } from '../../../../api/types';

export interface SettingsTabProps {
  ctx: RoomContext;
}

const SettingsTab = ({ ctx }: SettingsTabProps) => (
  <div className="xct-tab">
    <p>
      Místnost: <strong>{ctx.roomName.trim()}</strong>
    </p>
    <p>Skin: {ctx.skin}</p>
    <p className="xct-tab-empty">Detailní nastavení řešíme v Možnostech rozšíření.</p>
  </div>
);

export default SettingsTab;
