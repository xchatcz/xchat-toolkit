/**
 * IgnoreTab – seznam ignorovaných uživatelů.
 *
 * Napojení přímo na XChat endpoint `modchat?op=ignorepage`:
 *   - GET bez parametrů → výpis
 *   - GET s `inick=NICK&ign_submit=Přidat` → přidání
 *   - GET s `ign_delete=NICK` → smazání
 *
 * Každá mutace vrací zpět kompletní ignorepage, kterou parsujeme – server
 * je tedy jediným zdrojem pravdy a lokální stav se po mutaci překreslí
 * podle ní (žádné optimistic updates). Toast se zobrazí jen při neúspěchu.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import type { FormEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';

import XChatApi from '../../../../api/XChatApi';
import type { RoomContext } from '../../../../api/types';
import { toast } from '../../../../core/toast';
import { CloseIcon } from '../../../icons/IconPalette';
import './IgnoreTab.scss';

export interface IgnoreTabProps {
  ctx: RoomContext;
}

const IgnoreTab = ({ ctx }: IgnoreTabProps) => {
  const [nicks, setNicks] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState('');

  const refresh = useCallback(async () => {
    try {
      const list = await XChatApi.getIgnoredUsers(ctx.xhash, ctx.rid, ctx.skin);
      setNicks(list);
    } catch (err) {
      toast.error(`Nepodařilo se načíst seznam ignorací: ${String(err)}`);
    } finally {
      setLoading(false);
    }
  }, [ctx.xhash, ctx.rid, ctx.skin]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const handleAdd = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    const nick = input.trim();
    if (!nick || busy) return;
    setBusy(true);
    try {
      const list = await XChatApi.addIgnoredUser(ctx.xhash, ctx.rid, ctx.skin, nick);
      setNicks(list);
      setInput('');
    } catch (err) {
      toast.error(`Přidání do ignorace selhalo: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (nick: string): Promise<void> => {
    if (busy) return;
    setBusy(true);
    try {
      const list = await XChatApi.removeIgnoredUser(ctx.xhash, ctx.rid, ctx.skin, nick);
      setNicks(list);
    } catch (err) {
      toast.error(`Odebrání z ignorace selhalo: ${String(err)}`);
    } finally {
      setBusy(false);
    }
  };

  const trimmed = input.trim();

  return (
    <div className="xct-tab xct-ignoretab">
      <form className="xct-ignoretab__add" onSubmit={handleAdd}>
        <label htmlFor="xct-ignore-input" className="xct-ignoretab__label">
          Přidat uživatele do ignorace
        </label>
        <div className="xct-ignoretab__add-row">
          <input
            id="xct-ignore-input"
            type="text"
            className="xct-ignoretab__input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Nick"
            maxLength={32}
            autoComplete="off"
            disabled={busy}
          />
          <button
            type="submit"
            className="xct-btn"
            disabled={busy || trimmed.length === 0}
          >
            Přidat
          </button>
        </div>
      </form>

      <div className="xct-ignoretab__list-head">
        Ignorovaní uživatelé
        {!loading ? <span className="xct-ignoretab__count"> ({nicks.length})</span> : null}
      </div>

      {loading ? (
        <div className="xct-ignoretab__empty">Načítám…</div>
      ) : nicks.length === 0 ? (
        <div className="xct-ignoretab__empty">Zatím nikoho neignoruješ.</div>
      ) : (
        <ul className="xct-ignoretab__list">
          {nicks.map((nick) => (
            <li key={nick} className="xct-ignoretab__item">
              <span className="xct-ignoretab__nick">{nick}</span>
              <button
                type="button"
                className="xct-ignoretab__remove"
                onClick={() => handleRemove(nick)}
                disabled={busy}
                title={`Odebrat ${nick} z ignorace`}
                aria-label={`Odebrat ${nick} z ignorace`}
              >
                <CloseIcon width={14} height={14} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default IgnoreTab;
