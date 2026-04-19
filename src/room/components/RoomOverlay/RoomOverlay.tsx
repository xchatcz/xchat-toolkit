/**
 * RoomOverlay – překryv nad MessageBoard pro dialogy (místnosti, admin…).
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import type { ReactNode } from 'react';
import { CloseIcon } from '../../icons/IconPalette';
import './RoomOverlay.scss';

export interface RoomOverlayProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

const RoomOverlay = ({ title, onClose, children }: RoomOverlayProps) => (
  <div className="xct-overlay" role="dialog" aria-label={title}>
    <header className="xct-overlay__header">
      <h2 className="xct-overlay__title">{title}</h2>
      <button
        type="button"
        className="xct-overlay__close"
        onClick={onClose}
        aria-label="Zavřít"
      >
        <CloseIcon width={16} height={16} />
      </button>
    </header>
    <div className="xct-overlay__body">{children}</div>
  </div>
);

export default RoomOverlay;
