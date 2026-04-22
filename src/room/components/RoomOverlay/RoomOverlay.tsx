/**
 * RoomOverlay – překryv nad MessageBoard pro dialogy (místnosti, admin…).
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useEffect, type ReactNode } from 'react';
import { CloseIcon } from '../../icons/IconPalette';
import './RoomOverlay.scss';

export interface RoomOverlayProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

const RoomOverlay = ({ title, onClose, children }: RoomOverlayProps) => {
  // Esc zavře overlay – konzistentní s RoomsOverlay a RoomDetailsPanel.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
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
};

export default RoomOverlay;
