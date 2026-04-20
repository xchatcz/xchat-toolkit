/**
 * App – kořen React aplikace místnosti.
 *
 * Stará se o inicializaci {@link RoomController} a layout stránky:
 *
 * ```
 * ┌────────────────────────────────────────────┐
 * │ TopBar                                     │
 * ├────────────────────────────┬───────────────┤
 * │                            │               │
 * │ MessageBoard               │ Sidebar       │
 * │                            │               │
 * ├────────────────────────────┤               │
 * │ InfoStrip                  │               │
 * ├────────────────────────────┤               │
 * │ MessageForm                │               │
 * └────────────────────────────┴───────────────┘
 * ```
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useEffect, useMemo, useState } from 'react';
import type { RoomOptions } from '../features/Room/RoomApp';
import type { SkinId } from '../api/types';
import type { RoomController } from './services/RoomController';
import { useRoomStore } from './hooks/useRoomStore';
import TopBar from './components/TopBar/TopBar';
import Sidebar from './components/Sidebar/Sidebar';
import MessageBoard from './components/MessageBoard/MessageBoard';
import InfoStrip from './components/InfoStrip/InfoStrip';
import MessageForm from './components/MessageForm/MessageForm';
import RoomOverlay from './components/RoomOverlay/RoomOverlay';
import type { SidebarTab } from '../api/types';
import './App.scss';

export interface AppProps {
  options: RoomOptions;
  controller: RoomController;
}

const App = ({ options, controller }: AppProps) => {
  const { ctx, loading, error, favourites, users, recentJoiners } = useRoomStore();
  const [tab, setTab] = useState<SidebarTab>(options.defaultSidebarTab);
  const [overlay, setOverlay] = useState<null | { title: string; body: React.ReactNode }>(null);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);

  useEffect(() => {
    controller.init(
      options.skinId as SkinId,
      options.refreshIntervalSec,
      options.debug?.logWtknOnLoad ?? false,
    );
    return () => controller.destroy();
  }, [
    controller,
    options.skinId,
    options.refreshIntervalSec,
    options.debug?.logWtknOnLoad,
  ]);

  const closeOverlay = useMemo(() => () => setOverlay(null), []);

  if (error) return <div className="xct-error">Chyba: {error}</div>;
  if (loading || !ctx) return <div className="xct-loading">Načítám místnost…</div>;

  return (
    <div className={`xct-app xct-app--font-${options.fontFamily}`}>
      <TopBar ctx={ctx} />
      <div className="xct-body">
        <main className="xct-main">
          <div className="xct-main__board">
            {overlay ? (
              <RoomOverlay title={overlay.title} onClose={closeOverlay}>
                {overlay.body}
              </RoomOverlay>
            ) : (
              <MessageBoard
                order={options.messageOrder}
                myNick={ctx.myNick}
                highlightWhispers={options.highlightWhispers}
                highlightMyNick={options.highlightMyNick}
                hideBadCommand={options.hideBadCommand}
              />
            )}
          </div>
        </main>
        <Sidebar
          ctx={ctx}
          activeTab={tab}
          onChangeTab={setTab}
          onOpenOverlay={(title, body) => setOverlay({ title, body })}
          users={users}
          favourites={favourites}
          recentJoiners={recentJoiners}
          onSelectUser={(nick) => setPendingTarget(nick)}
        />
      </div>
      <footer className="xct-footer">
        <InfoStrip ctx={ctx} />
        <MessageForm
          ctx={ctx}
          controller={controller}
          users={users}
          favourites={favourites}
          pendingTarget={pendingTarget}
          onTargetConsumed={() => setPendingTarget(null)}
        />
      </footer>
    </div>
  );
};

export default App;
