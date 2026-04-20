/**
 * MessageForm – textový řádek pro odeslání zprávy do místnosti.
 *
 * Forma volá {@link RoomController.send}, která postne zprávu na XChat
 * přes skrytý `<form accept-charset="ISO-8859-2">` + iframe. Browser se
 * postará o správné kódování znaků.
 *
 * Pořadí vstupů: nick | text | příjemce | odeslat.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useEffect, useMemo, useState } from 'react';
import type { FavouriteUser, RoomContext, RoomUser } from '../../../api/types';
import { SendIcon } from '../../icons/IconPalette';
import type { RoomController } from '../../services/RoomController';
import './MessageForm.scss';

export interface MessageFormProps {
  ctx: RoomContext;
  controller: RoomController;
  /** Uživatelé aktuálně v místnosti (pro dropdown). */
  users: RoomUser[];
  /** Oblíbení z Notes – do dropdownu se dostanou jen VIP online mimo místnost. */
  favourites: FavouriteUser[];
  /** Externě nastavený cíl (např. klik na nick v UsersTab). */
  pendingTarget?: string | null;
  /** Zavolá se poté, co formulář pendingTarget převezme. */
  onTargetConsumed?: () => void;
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
  const [target, setTarget] = useState<string>('~'); // "~" = všem
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Externí volba cíle (klik na uživatele v UsersTab).
  useEffect(() => {
    if (pendingTarget && pendingTarget !== target) {
      setTarget(pendingTarget);
      onTargetConsumed?.();
    }
    // záměrně bez target v deps – chceme reagovat jen na změnu pendingTarget
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingTarget]);

  const inRoomNicks = useMemo(
    () => new Set(users.map((u) => u.nick.toLowerCase())),
    [users],
  );

  // VIP z Notes, kteří nejsou v místnosti (aby se zbytečně nedublovali).
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

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    const msg = text.trim();
    if (!msg) return;
    setBusy(true);
    setError(null);
    try {
      await controller.send(msg, target);
      // Úspěch → teprve teď vyprázdníme input. Při chybě text zůstane,
      // aby uživatel neztratil napsaný obsah.
      setText('');
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

  return (
    <form className="xct-form" onSubmit={onSubmit}>
      <label className="xct-form__label">{ctx.myNick}:</label>
      <input
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
        <option value="~">Všem</option>
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
