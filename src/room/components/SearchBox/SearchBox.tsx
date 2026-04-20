/**
 * SearchBox – přepínač User / Room s textovým inputem.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useState } from 'react';
import type { RoomContext } from '../../../api/types';
import { SearchIcon } from '../../icons/IconPalette';
import './SearchBox.scss';

export interface SearchBoxProps {
  ctx: RoomContext;
}

type Mode = 'user' | 'room';

const SearchBox = ({ ctx: _ctx }: SearchBoxProps) => {
  const [mode, setMode] = useState<Mode>('user');
  const [query, setQuery] = useState('');

  const onSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    if (!query.trim()) return;
    // TODO: propojit na XChatApi.getUserDetail / getRoomDetail (overlay).
  };

  return (
    <form className="xct-search" onSubmit={onSubmit}>
      <div className="xct-search__input">
        <SearchIcon width={14} height={14} />
        <input
          type="text"
          placeholder={mode === 'user' ? 'Hledat uživatele…' : 'Hledat místnost…'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="xct-search__modes">
        <button
          type="button"
          className={`xct-search__mode ${mode === 'user' ? 'is-active' : ''}`}
          onClick={() => setMode('user')}
        >
          Uživatel
        </button>
        <button
          type="button"
          className={`xct-search__mode ${mode === 'room' ? 'is-active' : ''}`}
          onClick={() => setMode('room')}
        >
          Místnost
        </button>
      </div>
    </form>
  );
};

export default SearchBox;
