/**
 * AdminTab – panel admina místnosti. Nabízí tlačítko „Další volby",
 * které otevře {@link RoomOverlay} s kompletní administrací.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import type { ReactNode } from 'react';
import type { RoomContext } from '../../../../api/types';

export interface AdminTabProps {
  ctx: RoomContext;
  onOpenOverlay: (title: string, body: ReactNode) => void;
}

const AdminTab = ({ ctx: _ctx, onOpenOverlay }: AdminTabProps) => (
  <div className="xct-tab">
    <p className="xct-tab-empty">Admin panel se doplní v dalším kroku.</p>
    <button
      type="button"
      className="xct-btn"
      onClick={() =>
        onOpenOverlay(
          'Správa místnosti',
          <div>Kompletní administrace se sem později vykreslí.</div>,
        )
      }
    >
      Další volby
    </button>
  </div>
);

export default AdminTab;
