/**
 * Sidebar – pravý panel s pěti záložkami.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import type { ReactNode } from 'react';
import type {
  FavouriteUser,
  RoomContext,
  RoomUser,
  SidebarTab,
} from '../../../api/types';
import {
  UsersIcon,
  SmileIcon,
  GearIcon,
  BanIcon,
  ShieldIcon,
} from '../../icons/IconPalette';
import UsersTab from './tabs/UsersTab';
import SmiliesTab from './tabs/SmiliesTab';
import SettingsTab from './tabs/SettingsTab';
import IgnoreTab from './tabs/IgnoreTab';
import AdminTab from './tabs/AdminTab';
import './Sidebar.scss';

export interface SidebarProps {
  ctx: RoomContext;
  activeTab: SidebarTab;
  onChangeTab: (tab: SidebarTab) => void;
  onOpenOverlay: (title: string, body: ReactNode) => void;
  users: RoomUser[];
  favourites: FavouriteUser[];
  onSelectUser: (nick: string) => void;
}

interface TabDef {
  id: SidebarTab;
  label: string;
  icon: typeof UsersIcon;
}

const TABS: TabDef[] = [
  { id: 'users', label: 'Uživatelé', icon: UsersIcon },
  { id: 'smilies', label: 'Smajlíci', icon: SmileIcon },
  { id: 'settings', label: 'Nastavení', icon: GearIcon },
  { id: 'ignore', label: 'Ignorace', icon: BanIcon },
  { id: 'admin', label: 'Správa', icon: ShieldIcon },
];

const Sidebar = ({
  ctx,
  activeTab,
  onChangeTab,
  onOpenOverlay,
  users,
  favourites,
  onSelectUser,
}: SidebarProps) => (
  <aside className="xct-sidebar">
    <nav className="xct-sidebar__tabs" role="tablist">
      {TABS.map((t) => {
        const Icon = t.icon;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={activeTab === t.id}
            className={`xct-sidebar__tab ${activeTab === t.id ? 'is-active' : ''}`}
            onClick={() => onChangeTab(t.id)}
            title={t.label}
          >
            <Icon width={18} height={18} />
          </button>
        );
      })}
    </nav>
    <div className="xct-sidebar__panel">
      {activeTab === 'users' ? (
        <UsersTab users={users} favourites={favourites} onSelectUser={onSelectUser} />
      ) : null}
      {activeTab === 'smilies' ? <SmiliesTab /> : null}
      {activeTab === 'settings' ? <SettingsTab ctx={ctx} /> : null}
      {activeTab === 'ignore' ? <IgnoreTab ctx={ctx} /> : null}
      {activeTab === 'admin' ? <AdminTab ctx={ctx} onOpenOverlay={onOpenOverlay} /> : null}
    </div>
  </aside>
);

export default Sidebar;
