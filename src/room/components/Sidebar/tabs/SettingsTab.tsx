/**
 * SettingsTab – rychlé nastavení místnosti (skin, interval atd.).
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import type { MouseEvent } from 'react';

import type { RoomContext } from '../../../../api/types';

export interface SettingsTabProps {
  ctx: RoomContext;
}

/** Otevře Options stránku rozšíření v novém panelu. */
const openExtensionOptions = (e: MouseEvent<HTMLAnchorElement>) => {
  e.preventDefault();
  const url = chrome.runtime.getURL('src/options/options.html');
  window.open(url, '_blank', 'noopener,noreferrer');
};

const SettingsTab = ({ ctx }: SettingsTabProps) => {
  const optionsUrl = chrome.runtime.getURL('src/options/options.html');
  return (
    <div className="xct-tab">
      <p>
        Místnost: <strong>{ctx.roomName.trim()}</strong>
      </p>
      <p>Skin: {ctx.skin}</p>
      <p>
        <a
          className="xct-settings-link"
          href={optionsUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={openExtensionOptions}
        >
          Otevřít nastavení rozšíření ↗
        </a>
      </p>
    </div>
  );
};

export default SettingsTab;
