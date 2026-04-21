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
import type { FavouriteUser, RoomContext, RoomUser, Star } from '../../../api/types';
import { SendIcon } from '../../icons/IconPalette';
import { isSuperAdmin } from '../../../core/superAdmins';
import type { RoomController } from '../../services/RoomController';
import './MessageForm.scss';

export interface MessageFormProps {
  ctx: RoomContext;
  controller: RoomController;
  users: RoomUser[];
  favourites: FavouriteUser[];
  pendingTarget?: string | null;
  onTargetConsumed?: () => void;
  /**
   * Text k vložení do inputu na pozici kurzoru (např. `*44*` ze záložky
   * „Smajlíci"). Po vložení se focus vrátí do pole a parent volá
   * `onInsertConsumed`, aby se prop mohl resetovat na `null`.
   */
  pendingInsert?: string | null;
  onInsertConsumed?: () => void;
  /** Hvězdička přihlášeného uživatele (0 = žádná). */
  myStar: Star;
  /**
   * Override maximální délky zprávy z Options. `'auto'` = dopočítat podle
   * hvězdičky / superadmin statusu (200 vs 400).
   */
  maxMessageLength: 'auto' | number;
}

const COMPLETION_SUFFIX_START = ': ';
const COMPLETION_SUFFIX_INLINE = ' ';

interface TabCycle {
  startPos: number;
  originalPrefix: string;
  candidates: readonly string[];
  index: number;
  /** Přípona přidávaná za nick (`: ` na začátku řádku, ` ` uvnitř). */
  suffix: string;
}

const MessageForm = ({
  ctx,
  controller,
  users,
  favourites,
  pendingTarget,
  onTargetConsumed,
  pendingInsert,
  onInsertConsumed,
  myStar,
  maxMessageLength,
}: MessageFormProps) => {
  const [text, setText] = useState('');
  const [target, setTarget] = useState<string>('~');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Efektivní limit délky zprávy:
  //  - Options override má přednost (číslo).
  //  - Jinak: superadmin nebo jakákoli hvězdička → 400, ostatní → 200.
  const effectiveMaxLen = useMemo<number>(() => {
    if (typeof maxMessageLength === 'number' && maxMessageLength > 0) {
      return Math.floor(maxMessageLength);
    }
    const privileged = isSuperAdmin(ctx.myNick) || myStar > 0;
    return privileged ? 400 : 200;
  }, [maxMessageLength, ctx.myNick, myStar]);

  const remaining = effectiveMaxLen - text.length;
  const counterWarning = remaining < 50;

  const inputRef = useRef<HTMLInputElement | null>(null);
  const tabCycleRef = useRef<TabCycle | null>(null);
  // Krátký pulz (cca 400 ms) na inputu, když se pokusíš vložit třináctého
  // smajlíka – slouží jako vizuální signál „nelze". Doba běhu animace
  // odpovídá `xct-form-shake` v MessageForm.scss.
  const [smileLimitShake, setSmileLimitShake] = useState(false);
  const SMILE_LIMIT = 12;

  useEffect(() => {
    if (pendingTarget && pendingTarget !== target) {
      setTarget(pendingTarget);
      onTargetConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTarget]);

  // Vložení textu (např. `*44*` ze Sidebaru) na pozici kurzoru. Respektuje
  // limit délky – přebytek se ořízne stejně jako při psaní.
  //
  // Speciální chování pro smajlíky (`*N*`): musí být vždy oddělené mezerou
  // od okolí – před smajlíkem (pokud tam není mezera ani začátek) se doplní
  // mezera a stejně tak za smajlíkem, pokud za kurzorem je další znak.
  // Na konci řádku se za smajlíkem mezera nedělá.
  useEffect(() => {
    if (!pendingInsert) return;
    const input = inputRef.current;
    const caret = input?.selectionStart ?? text.length;
    const before = text.slice(0, caret);
    const after = text.slice(caret);
    const isSmile = /^\*\d+\*$/.test(pendingInsert);
    // Limit 12 smajlíků ve zprávě – třináctý už nevkládám a input krátce
    // červeně problikne. Počet se počítá z aktuálního textu před vložením.
    if (isSmile) {
      const existing = (text.match(/\*\d+\*/g) ?? []).length;
      if (existing >= SMILE_LIMIT) {
        setSmileLimitShake(false);
        // Dvojité nastavení přes rAF restartuje CSS animaci i při opakovaných
        // pokusech za sebou (jinak by druhý pokus animaci nerozpohyboval).
        requestAnimationFrame(() => setSmileLimitShake(true));
        input?.focus();
        onInsertConsumed?.();
        return;
      }
    }
    let payload = pendingInsert;
    if (isSmile) {
      const needsLead = before.length > 0 && !/\s$/.test(before);
      const needsTrail = after.length > 0 && !/^\s/.test(after);
      if (needsLead) payload = ` ${payload}`;
      if (needsTrail) payload = `${payload} `;
    }
    const next = (before + payload + after).slice(0, effectiveMaxLen);
    setText(next);
    tabCycleRef.current = null;
    const newCaret = Math.min(caret + payload.length, next.length);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(newCaret, newCaret);
    });
    onInsertConsumed?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInsert]);

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
    () => {
      // Do nabídky příjemců nezahrnujeme vlastní nick – nikdy si sám sobě
      // neadresuji zprávu.
      const myKey = (ctx.myNick ?? '').toLowerCase();
      return [...users]
        .map((u) => u.nick)
        .filter((n) => n.toLowerCase() !== myKey)
        .sort((a, b) => a.localeCompare(b, 'cs'));
    },
    [users, ctx.myNick],
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
          : cycle.candidates[nextIndex] + cycle.suffix;
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
      const suffix = appendSuffix ? COMPLETION_SUFFIX_START : COMPLETION_SUFFIX_INLINE;
      const first = candidates[0];
      const replacement = first + suffix;
      const next = value.slice(0, startPos) + replacement + value.slice(caret);
      setText(next);
      tabCycleRef.current = {
        startPos,
        originalPrefix: prefix,
        candidates,
        index: 0,
        suffix,
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
      <div className="xct-form__input-wrap">
        <input
          ref={inputRef}
          type="text"
          className={`xct-form__input${smileLimitShake ? ' is-shake' : ''}`}
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, effectiveMaxLen))}
          placeholder="Napsat zprávu…"
          disabled={busy}
          maxLength={effectiveMaxLen}
          autoFocus
          onAnimationEnd={() => setSmileLimitShake(false)}
        />
        <span
          className={`xct-form__counter${counterWarning ? ' is-warning' : ''}`}
          aria-label={`Zbývá ${remaining} z ${effectiveMaxLen} znaků`}
          title={`Zbývá ${remaining} z ${effectiveMaxLen} znaků`}
        >
          {remaining}
        </span>
      </div>
      <select
        className="xct-form__target"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
        aria-label="Cíl zprávy"
      >
        <option value="~">Všem ({usersSorted.length})</option>
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
      <button
        type="submit"
        className={`xct-form__send${busy ? ' is-busy' : ''}`}
        disabled={busy || !text.trim()}
        aria-label={busy ? 'Odesílá se…' : 'Odeslat'}
        aria-busy={busy || undefined}
      >
        {busy ? (
          <span className="xct-form__spinner" aria-hidden="true" />
        ) : (
          <SendIcon width={16} height={16} />
        )}
      </button>
      {error ? <div className="xct-form__error" role="alert">{error}</div> : null}
    </form>
  );
};

export default MessageForm;
