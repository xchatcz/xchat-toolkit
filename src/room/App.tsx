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
import { getSkin, paletteToCssVars } from './skins/palettes';
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
  // Zda právě trvá varování „zbývá < 5 min do vyhození" (nemluvil ≥ 40 min).
  // InfoStrip nám sekundy hlásí přes callback – ukládáme jen booleanovou
  // hodnotu přes práh, aby se App nepřekresloval každou sekundu.
  const [preKickActive, setPreKickActive] = useState(false);

  const onIdleSecondsChange = useMemo(
    () => (sec: number) => {
      const active = sec >= 40 * 60;
      setPreKickActive((prev) => (prev === active ? prev : active));
    },
    [],
  );

  useEffect(() => {
    controller.init(
      options.skinId as SkinId | 'auto',
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

  // Při volbě „Načíst z XChatu" přepíšeme CSS paletu podle skutečného
  // skinu, který XChat vrátil v kontextu místnosti. Při fixním čísle
  // už paletu nastavil mount.tsx synchronně před mountem.
  useEffect(() => {
    if (options.skinId !== 'auto') return;
    if (!ctx?.skin) return;
    const vars = paletteToCssVars(getSkin(ctx.skin).palette);
    const root = document.documentElement;
    for (const [k, v] of Object.entries(vars)) {
      root.style.setProperty(k, v);
    }
  }, [options.skinId, ctx?.skin]);

  const closeOverlay = useMemo(() => () => setOverlay(null), []);

  // Titulek karty – název místnosti na prvním místě, pak „XChat" za pomlčkou.
  useEffect(() => {
    document.title = ctx?.roomName
      ? `${ctx.roomName} – XChat`
      : 'XChat – načítám místnost…';
  }, [ctx?.roomName]);

  if (error) return <div className="xct-error">Chyba: {error}</div>;
  if (loading || !ctx) return <div className="xct-loading">Načítám místnost…</div>;

  return (
    <div
      className={
        `xct-app xct-app--font-${options.fontFamily}` +
        (options.highlightPreKickWarning && preKickActive ? ' xct-app--pre-kick' : '')
      }
      style={{ ['--xct-whisper-bg' as string]: options.whisperBgColor }}
    >
      <TopBar
        ctx={ctx}
        userCount={users.length}
        users={users}
        onOpenOverlay={(title, body) => setOverlay({ title, body })}
        onChangeTab={setTab}
      />
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
                highlightKick={options.highlightKick}
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
        <InfoStrip
          ctx={ctx}
          userCount={users.length}
          onOpenOverlay={(title, body) => setOverlay({ title, body })}
          onIdleSecondsChange={onIdleSecondsChange}
        />
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
