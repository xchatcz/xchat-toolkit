/**
 * AdminsOnline – speciální tab v Sidebaru vyvolaný z UserMenu „Pomoc online".
 *
 * Zatím placeholder – do budoucna zobrazí seznam online adminů
 * a nabídne rychlý kontakt / hlášení.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import type { RoomContext } from '../../../../api/types';

export interface AdminsOnlineTabProps {
  ctx: RoomContext;
}

const AdminsOnlineTab = ({ ctx: _ctx }: AdminsOnlineTabProps) => (
  <div className="xct-tab">
    <h3 className="xct-tab__title">Pomoc online</h3>
    <p>
      Tady se brzy objeví seznam administrátorů, kteří jsou právě online
      a mohou ti pomoct s problémem v místnosti nebo s účtem.
    </p>
    <p className="xct-tab-empty">Modul se připravuje.</p>
  </div>
);

export default AdminsOnlineTab;
