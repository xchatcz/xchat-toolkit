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
import RoomsOverlay from './components/RoomsOverlay/RoomsOverlay';
import RoomDetailsPanel from './components/RoomDetailsPanel/RoomDetailsPanel';
import type { SidebarTab } from '../api/types';
import { useFeatureOptions } from './hooks/useFeatureOptions';
import { removePreBoot } from './bootHelpers';
import './App.scss';

export interface AppProps {
  options: RoomOptions;
  controller: RoomController;
}

const App = ({ options: initialOptions, controller }: AppProps) => {
  // Live „room-app" options – přepínače v InfoStripu zapisují přímo sem.
  const [options, setOption] = useFeatureOptions<RoomOptions>('room-app', initialOptions);
  const { ctx, loading, error, favourites, users, recentJoiners, myStar, canSeeAdmin } =
    useRoomStore();
  const [tab, setTab] = useState<SidebarTab>(options.defaultSidebarTab);
  const [overlay, setOverlay] = useState<null | { title: string; body: React.ReactNode }>(null);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [roomDetailsOpen, setRoomDetailsOpen] = useState(false);
  const [pendingTarget, setPendingTarget] = useState<string | null>(null);
  const [pendingInsert, setPendingInsert] = useState<string | null>(null);
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
    );
    return () => controller.destroy();
  }, [
    controller,
    options.skinId,
    options.refreshIntervalSec,
  ]);

  // První commit React stromu → odhalíme <html> a odstraníme pre-boot spinner.
  // Nečekáme na ctx – spinnerem pokryje i loading stav samotného Reactu.
  useEffect(() => {
    removePreBoot();
  }, []);

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
  if (loading || !ctx)
    return (
      <div className="xct-boot">
        <div className="xct-boot__inner">
          <div className="xct-boot__spinner" aria-hidden="true" />
          <div>Načítám místnost…</div>
        </div>
      </div>
    );

  return (
    <div
      className={
        `xct-app xct-app--font-${options.fontFamily} xct-app--skin-${ctx.skin}` +
        (options.highlightPreKickWarning && preKickActive ? ' xct-app--pre-kick' : '')
      }
      style={{
        // Tmavé skiny s defaultní žlutou mají override na barvu ladící
        // s paletou (černý 47 = sytější žlutá, Matrix 44 = tmavě zelená).
        // Pokud si user whisperBg ručně změnil, respektujeme jeho volbu.
        ['--xct-whisper-bg' as string]:
          options.whisperBgColor !== 'rgba(255, 235, 59, 0.35)'
            ? options.whisperBgColor
            : ctx.skin === 47
              ? 'rgba(255, 215, 0, 0.55)'
              : ctx.skin === 44
                ? 'rgba(0, 60, 0, 0.55)'
                : options.whisperBgColor,
        ['--xct-mynick-hl' as string]: options.myNickHighlightColor,
        // Skin „Lidé" (48) má tapetu v pravém dolním rohu sidebaru –
        // SCSS ji čte z této proměnné, protože `chrome-extension://` URL
        // neznáme za build-time.
        ...(ctx.skin === 48
          ? {
              ['--xct-sidebar-bg-image' as string]: `url("${chrome.runtime.getURL('img/lide-room-bg.gif')}")`,
            }
          : {}),
      }}
    >
      <TopBar
        ctx={ctx}
        userCount={users.length}
        users={users}
        onOpenRoomDetails={() => setRoomDetailsOpen(true)}
        onChangeTab={setTab}
        onOpenRooms={() => setRoomsOpen(true)}
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
                messageFilter={options.messageFilter}
                userColorsEnabled={options.userColorsEnabled}
                enhancedRoomCommands={options.enhancedRoomCommands}
                onSelectUser={(nick) => setPendingTarget(nick)}
              />
            )}
            {roomsOpen && !overlay ? (
              <RoomsOverlay ctx={ctx} onClose={() => setRoomsOpen(false)} />
            ) : null}
            {roomDetailsOpen && !overlay && !roomsOpen ? (
              <RoomDetailsPanel
                ctx={ctx}
                userCount={users.length}
                onClose={() => setRoomDetailsOpen(false)}
              />
            ) : null}
          </div>
          <footer className="xct-footer">
            <InfoStrip
              ctx={ctx}
              userCount={users.length}
              onOpenRoomDetails={() => setRoomDetailsOpen(true)}
              onIdleSecondsChange={onIdleSecondsChange}
              messageFilter={options.messageFilter}
              highlightMyNick={options.highlightMyNick}
              highlightWhispers={options.highlightWhispers}
              refreshIntervalSec={options.refreshIntervalSec}
              onSetOption={setOption}
            />
            <MessageForm
              ctx={ctx}
              controller={controller}
              users={users}
              favourites={favourites}
              pendingTarget={pendingTarget}
              onTargetConsumed={() => setPendingTarget(null)}
              pendingInsert={pendingInsert}
              onInsertConsumed={() => setPendingInsert(null)}
              myStar={myStar}
              maxMessageLength={options.maxMessageLength}
            />
          </footer>
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
          onInsertText={(t) => setPendingInsert(t)}
          canSeeAdmin={canSeeAdmin}
        />
      </div>
    </div>
  );
};

export default App;
