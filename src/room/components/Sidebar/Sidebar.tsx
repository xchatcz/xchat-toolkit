/**
 * Sidebar – pravý panel s pěti záložkami.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import type { ReactNode } from 'react';
import { useMemo } from 'react';
import type {
  FavouriteUser,
  RoomContext,
  RoomUser,
  SidebarTab,
} from '../../../api/types';
import type { RoomOptions } from '../../../features/Room/RoomApp';
import {
  UsersIcon,
  SmileIcon,
  GearIcon,
  BanIcon,
  CrownIcon,
} from '../../icons/IconPalette';
import UsersTab from './tabs/UsersTab';
import SmiliesTab from './tabs/SmiliesTab';
import SettingsTab from './tabs/SettingsTab';
import IgnoreTab from './tabs/IgnoreTab';
import AdminTab from './tabs/AdminTab';
import AdminsOnlineTab from './tabs/AdminsOnlineTab';
import './Sidebar.scss';

export interface SidebarProps {
  ctx: RoomContext;
  activeTab: SidebarTab;
  onChangeTab: (tab: SidebarTab) => void;
  onOpenOverlay: (title: string, body: ReactNode) => void;
  users: RoomUser[];
  favourites: FavouriteUser[];
  /** Nicky, které právě vstoupily do místnosti – pulsují v UsersTab. */
  recentJoiners: string[];
  onSelectUser: (nick: string) => void;
  /**
   * Vložit text do MessageFormu (např. `*44*` kliknutím v SmiliesTab).
   */
  onInsertText: (text: string) => void;
  /**
   * Smí uživatel vidět záložku „Správa"? Zjišťuje se jen on-load v
   * {@link RoomController.loadAdminPermissions}. Default je `false`,
   * tj. záložka není v navigaci vůbec k dispozici.
   */
  canSeeAdmin: boolean;
  /** Nastavení místnosti – pro rychlé úpravy v Sidebar „Nastavení". */
  options: RoomOptions;
  /** Setter jednotlivé hodnoty v options (reaktivní). */
  onSetOption: <K extends keyof RoomOptions>(key: K, value: RoomOptions[K]) => void;
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
  { id: 'admin', label: 'Správa', icon: CrownIcon },
];

const Sidebar = ({
  ctx,
  activeTab,
  onChangeTab,
  onOpenOverlay,
  users,
  favourites,
  recentJoiners,
  onSelectUser,
  onInsertText,
  canSeeAdmin,
  options,
  onSetOption,
}: SidebarProps) => {
  // Seznam tabů filtrujeme dle oprávnění: bez práv správce záložka
  // „Správa" v navigaci vůbec není. Uživatel na ni pak ani nemůže kliknout.
  const visibleTabs = useMemo(
    () => (canSeeAdmin ? TABS : TABS.filter((t) => t.id !== 'admin')),
    [canSeeAdmin],
  );

  // Pokud by byl nastaven „admin" jako výchozí, ale uživatel ho nesmí vidět,
  // ignorujeme to a ukážeme první dostupný tab (Uživatelé). Nemutujeme stav –
  // prostě render fallback.
  const effectiveTab: SidebarTab =
    activeTab === 'admin' && !canSeeAdmin ? 'users' : activeTab;

  return (
    <aside className="xct-sidebar">
      <nav className="xct-sidebar__tabs" role="tablist">
        {visibleTabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={effectiveTab === t.id}
              className={`xct-sidebar__tab ${effectiveTab === t.id ? 'is-active' : ''}`}
              onClick={() => onChangeTab(t.id)}
              title={t.label}
            >
              <Icon width={18} height={18} />
            </button>
          );
        })}
      </nav>
      <div className="xct-sidebar__panel">
        {effectiveTab === 'users' ? (
          <UsersTab
            users={users}
            favourites={favourites}
            recentJoiners={recentJoiners}
            onSelectUser={onSelectUser}
          />
        ) : null}
        {effectiveTab === 'smilies' ? <SmiliesTab ctx={ctx} onInsertText={onInsertText} /> : null}
        {effectiveTab === 'settings' ? (
          <SettingsTab ctx={ctx} options={options} onSetOption={onSetOption} />
        ) : null}
        {effectiveTab === 'ignore' ? <IgnoreTab ctx={ctx} /> : null}
        {effectiveTab === 'admin' && canSeeAdmin ? (
          <AdminTab ctx={ctx} onOpenOverlay={onOpenOverlay} />
        ) : null}
        {effectiveTab === 'adminsOnline' ? (
          <AdminsOnlineTab ctx={ctx} onSelectUser={onSelectUser} />
        ) : null}
      </div>
    </aside>
  );
};

export default Sidebar;
