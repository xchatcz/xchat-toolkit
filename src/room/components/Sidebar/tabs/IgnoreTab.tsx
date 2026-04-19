/**
 * IgnoreTab – seznam ignorovaných uživatelů.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import type { RoomContext } from '../../../../api/types';

export interface IgnoreTabProps {
  ctx: RoomContext;
}

const IgnoreTab = ({ ctx: _ctx }: IgnoreTabProps) => (
  <div className="xct-tab-empty">Ignorovaní uživatelé – doplníme v dalším kroku.</div>
);

export default IgnoreTab;
