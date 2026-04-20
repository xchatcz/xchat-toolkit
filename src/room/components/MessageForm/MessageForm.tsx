/**
 * MessageForm – textový řádek pro odeslání zprávy do místnosti.
 *
 * Forma volá {@link RoomController.send}, která postne zprávu na XChat
 * (POST `/modchat` s `op=textpageng&aid=6&textarea=…&target=…`).
 *
 * Pořadí vstupů: nick | text | příjemce | odeslat.
 *
 * Funkce navíc:
 *  - Po úspěšném odeslání se focus vrátí do textového pole (reply-chain).
 *  - Tabulátor = doplňování nicků z aktuálního seznamu příjemců.
 *    Oddělovač za dokončeným nickem je `": "`. Opakovaný Tab cyklí mezi
 *    více shodami a pak zpět na originální prefix. Jakákoli jiná klávesa
 *    cyklus resetuje.
 *  - Vlastní nick (label „elza:") se zobrazuje ve správné velikosti písmen –
 *    XChat v HTML má `var my_nick` lowercase; proto případně přepíšeme
 *    podle shody v seznamu uživatelů, kde je zachován originál.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FavouriteUser, RoomContext, RoomUser } from '../../../api/types';
import { SendIcon } from '../../icons/IconPalette';
import type { RoomController } from '../../services/RoomController';
import './MessageForm.scss';

export interface MessageFormProps {
  ctx: RoomContext;
  controller: RoomController;
  users: RoomUser[];
  favourites: FavouriteUser[];
  pendingTarget?: string | null;
  onTargetConsumed?: () => void;
}

const COMPLETION_SUFFIX = ': ';

interface TabCycle {
  startPos: number;
  originalPrefix: string;
  candidates: readonly string[];
  index: number;
  appendSuffix: boolean;
}

const MessageForm = ({
  ctx,
  controller,
  users,
  favourites,
  pendingTarget,
  onTargetConsumed,
}: MessageFormProps) => {
  const [text, setText] = useState('');
  const [target, setTarget] = useState<string>('~');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const tabCycleRef = useRef<TabCycle | null>(null);

  useEffect(() => {
    if (pendingTarget && pendingTarget !== target) {
      setTarget(pendingTarget);
      onTargetConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTarget]);

  const inRoomNicks = useMemo(
    () => new Set(users.map((u) => u.nick.toLowerCase())),
    [users],
  );

  const vipOutside = useMemo(() => {
    return favourites
      .filter((f) => f.vip && !inRoomNicks.has(f.nick.toLowerCase()))
      .map((f) => f.nick)
      .sort((a, b) => a.localeCompare(b, 'cs'));
  }, [favourites, inRoomNicks]);

  const usersSorted = useMemo(
    () => [...users].map((u) => u.nick).sort((a, b) => a.localeCompare(b, 'cs')),
    [users],
  );

  const completionNicks = useMemo(() => {
    const seen = new Set<string>();
    // Vlastní nick do tab-completion nepatří – nikdy si sám sobě neadresuji.
    const myKey = (ctx.myNick ?? '').toLowerCase();
    if (myKey) seen.add(myKey);
    const out: string[] = [];
    for (const n of [...usersSorted, ...vipOutside]) {
      const k = n.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(n);
    }
    return out;
  }, [usersSorted, vipOutside, ctx.myNick]);

  const displayNick = useMemo(() => {
    const needle = (ctx.myNick ?? '').toLowerCase();
    if (!needle) return ctx.myNick;
    const found = users.find((u) => u.nick.toLowerCase() === needle);
    return found?.nick ?? ctx.myNick;
  }, [users, ctx.myNick]);

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const msg = text.trim();
    if (!msg) return;
    setBusy(true);
    setError(null);
    try {
      await controller.send(msg, target);
      setText('');
      tabCycleRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 0);
    } catch (err) {
      const errMsg =
        err instanceof Error ? err.message : 'Nepodařilo se odeslat zprávu.';
      // eslint-disable-next-line no-console
      console.error('[XChat Toolkit] send selhal:', err);
      setError(errMsg);
    } finally {
      setBusy(false);
    }
  };

  /**
   * Tab-completion přes NATIVNÍ `keydown` s capture fází – musí chytit Tab
   * dřív než React synthetic handlery a dřív než default akce prohlížeče
   * (přesun focusu na další prvek). Jinak by Tab v userscriptovém prostředí
   * (parent frame, vkládaný třetími stranami) občas utekl.
   */
  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;

    const handler = (e: KeyboardEvent): void => {
      if (e.key !== 'Tab') {
        // Jakákoli jiná klávesa ukončí probíhající cyklus.
        tabCycleRef.current = null;
        return;
      }
      if (e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) return;

      e.preventDefault();
      e.stopPropagation();

      const value = input.value;
      const caret = input.selectionStart ?? value.length;

      const cycle = tabCycleRef.current;
      if (cycle) {
        const total = cycle.candidates.length + 1; // +1 = originální prefix
        const nextIndex = (cycle.index + 1) % total;
        const isOriginal = nextIndex === cycle.candidates.length;
        const replacement = isOriginal
          ? cycle.originalPrefix
          : cycle.candidates[nextIndex] +
            (cycle.appendSuffix ? COMPLETION_SUFFIX : '');
        const before = value.slice(0, cycle.startPos);
        const after = value.slice(caret);
        const next = before + replacement + after;
        setText(next);
        tabCycleRef.current = { ...cycle, index: nextIndex };
        const newCaret = cycle.startPos + replacement.length;
        requestAnimationFrame(() => {
          input.setSelectionRange(newCaret, newCaret);
        });
        return;
      }

      // Nový cyklus – poslední token od předchozí mezery.
      const before = value.slice(0, caret);
      const m = before.match(/(\S+)$/);
      const prefix = m ? m[1] : '';
      if (!prefix) return;
      const startPos = caret - prefix.length;

      const needle = prefix.toLowerCase();
      const candidates = completionNicks.filter((n) =>
        n.toLowerCase().startsWith(needle),
      );
      if (candidates.length === 0) return;

      const appendSuffix = /^\s*$/.test(value.slice(0, startPos));
      const first = candidates[0];
      const replacement = first + (appendSuffix ? COMPLETION_SUFFIX : '');
      const next = value.slice(0, startPos) + replacement + value.slice(caret);
      setText(next);
      tabCycleRef.current = {
        startPos,
        originalPrefix: prefix,
        candidates,
        index: 0,
        appendSuffix,
      };
      const newCaret = startPos + replacement.length;
      requestAnimationFrame(() => {
        input.setSelectionRange(newCaret, newCaret);
      });
    };

    input.addEventListener('keydown', handler, true);
    return () => input.removeEventListener('keydown', handler, true);
  }, [completionNicks]);

  return (
    <form className="xct-form" onSubmit={onSubmit}>
      <label className="xct-form__label">{displayNick}:</label>
      <input
        ref={inputRef}
        type="text"
        className="xct-form__input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Napsat zprávu…"
        disabled={busy}
        autoFocus
      />
      <select
        className="xct-form__target"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        aria-label="Cíl zprávy"
      >
        <option value="~">Všem ({users.length})</option>
        {usersSorted.map((n) => (
          <option key={`u-${n}`} value={n}>
            {n}
          </option>
        ))}
        {vipOutside.length > 0 ? (
          <option disabled value="__sep_vip">
            — VIP —
          </option>
        ) : null}
        {vipOutside.map((n) => (
          <option key={`v-${n}`} value={n}>
            {n}
          </option>
        ))}
      </select>
      <button type="submit" className="xct-form__send" disabled={busy || !text.trim()}>
        <SendIcon width={16} height={16} />
      </button>
      {error ? <div className="xct-form__error" role="alert">{error}</div> : null}
    </form>
  );
};

export default MessageForm;
