/**
 * SmiliesTab – paleta smajlíků v Sidebaru.
 *
 * Dvě podzáložky:
 *   1) „Oblíbení" – smajlíci uložení v `chrome.storage.sync` přes
 *      {@link loadFavouriteSmileys}. Kliknutím vložím `*N*` do MessageFormu,
 *      Ctrl+klik odebere z oblíbených.
 *   2) „Všichni smajlíci" – stránkovaný katalog z `/~$xhash/settings/smiles.php`
 *      s fulltextovým vyhledáváním podle popisku (přes `search-txt`).
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useEffect, useMemo, useState } from 'react';
import type { RoomContext } from '../../../../api/types';
import {
  XChatEmoji,
  XChatHttp,
  XChatSmilesCatalog,
  XChatUrls,
  type SmileCatalogEntry,
  type SmilesCatalogPage,
} from '../../../../api/XChatApi';
import {
  loadFavouriteSmileys,
  onFavouriteSmileysChanged,
  removeFavouriteSmiley,
  type FavouriteSmileys,
} from '../../../../core/favouriteSmileys';
import { FAVOURITE_SMILEYS_MAX } from '../../../../core/superAdmins';
import './SmiliesTab.scss';

export interface SmiliesTabProps {
  ctx: RoomContext;
  onInsertText: (text: string) => void;
}

type SubTab = 'favourites' | 'all';

const SmiliesTab = ({ ctx, onInsertText }: SmiliesTabProps) => {
  const [subTab, setSubTab] = useState<SubTab>('favourites');
  const [favs, setFavs] = useState<FavouriteSmileys>({ nums: [] });

  useEffect(() => {
    void loadFavouriteSmileys().then(setFavs);
    const off = onFavouriteSmileysChanged(setFavs);
    return off;
  }, []);

  const insertSmile = (num: number): void => onInsertText(`*${num}*`);

  return (
    <div className="xct-smilies">
      <nav className="xct-smilies__subtabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'favourites'}
          className={`xct-smilies__subtab ${subTab === 'favourites' ? 'is-active' : ''}`}
          onClick={() => setSubTab('favourites')}
        >
          Oblíbení ({favs.nums.length}/{FAVOURITE_SMILEYS_MAX})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={subTab === 'all'}
          className={`xct-smilies__subtab ${subTab === 'all' ? 'is-active' : ''}`}
          onClick={() => setSubTab('all')}
        >
          Všichni smajlíci
        </button>
      </nav>

      <div className="xct-smilies__body">
        {subTab === 'favourites' ? (
          <FavouritesPanel favs={favs} onInsert={insertSmile} xhash={ctx.xhash} />
        ) : (
          <AllSmiliesPanel ctx={ctx} onInsert={insertSmile} favs={favs} />
        )}
      </div>
    </div>
  );
};

export default SmiliesTab;

// ─── „Oblíbení" ──────────────────────────────────────────────────────────────

interface FavouritesPanelProps {
  favs: FavouriteSmileys;
  onInsert: (num: number) => void;
  xhash: string;
}

const FavouritesPanel = ({ favs, onInsert, xhash }: FavouritesPanelProps) => {
  if (favs.nums.length === 0) {
    return (
      <div className="xct-smilies__empty">
        <p>Zatím žádní oblíbení smajlíci.</p>
        <p>
          Přidat je můžeš v záložce „Všichni smajlíci" výše, nebo v{' '}
          <a
            href={`${XChatUrls.hashPrefix(xhash)}/settings/smiles.php`}
            target="_blank"
            rel="noreferrer noopener"
          >
            Nastavení smajlíků
          </a>
          .
        </p>
      </div>
    );
  }
  return (
    <div className="xct-smilies__grid">
      {favs.nums.map((num) => (
        <button
          key={num}
          type="button"
          className="xct-smilies__item is-fav"
          title={`*${num}* (klik = vložit; Ctrl+klik = odebrat z oblíbených)`}
          onClick={(e) => {
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              void removeFavouriteSmiley(num);
              return;
            }
            onInsert(num);
          }}
        >
          <img src={XChatEmoji.url(num)} alt={`*${num}*`} />
        </button>
      ))}
    </div>
  );
};

// ─── „Všichni smajlíci" ──────────────────────────────────────────────────────

interface AllSmiliesPanelProps {
  ctx: RoomContext;
  onInsert: (num: number) => void;
  favs: FavouriteSmileys;
}

const AllSmiliesPanel = ({ ctx, onInsert, favs }: AllSmiliesPanelProps) => {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [data, setData] = useState<SmilesCatalogPage | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const url = XChatUrls.smilesPage(ctx.xhash, {
      page,
      searchTxt: search || undefined,
    });
    XChatHttp.fetchDocument(url)
      .then((doc) => {
        if (cancelled) return;
        setData(XChatSmilesCatalog.parseSmilesPage(doc));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : 'Nepodařilo se načíst smajlíky.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ctx.xhash, page, search]);

  const favSet = useMemo(() => new Set(favs.nums), [favs]);

  const applySearch = (): void => {
    setPage(1);
    setSearch(searchInput.trim());
  };

  const clearSearch = (): void => {
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  return (
    <div className="xct-smilies__all">
      <form
        className="xct-smilies__search"
        onSubmit={(e) => {
          e.preventDefault();
          applySearch();
        }}
      >
        <input
          type="text"
          placeholder="Najít podle popisku…"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <button type="submit">Hledat</button>
        {search ? (
          <button type="button" onClick={clearSearch} title="Zrušit vyhledávání">
            ×
          </button>
        ) : null}
      </form>

      {loading ? <div className="xct-smilies__status">Načítám…</div> : null}
      {error ? <div className="xct-smilies__error">{error}</div> : null}

      {data && !loading ? (
        <>
          <SmilesGrid items={data.items} favSet={favSet} onInsert={onInsert} />
          <Pagination page={data.page} maxPage={data.maxPage} onPage={setPage} />
        </>
      ) : null}
    </div>
  );
};

interface SmilesGridProps {
  items: SmileCatalogEntry[];
  favSet: Set<number>;
  onInsert: (num: number) => void;
}

const SmilesGrid = ({ items, favSet, onInsert }: SmilesGridProps) => {
  if (items.length === 0) {
    return <div className="xct-smilies__empty">Žádné smajlíky k zobrazení.</div>;
  }
  return (
    <div className="xct-smilies__grid">
      {items.map((e) => {
        const isFav = favSet.has(e.num);
        return (
          <button
            key={e.num}
            type="button"
            className={`xct-smilies__item ${isFav ? 'is-fav' : ''}`}
            title={`${e.desc} – *${e.num}* (klik = vložit)`}
            onClick={() => onInsert(e.num)}
          >
            <img src={e.imgUrl || XChatEmoji.url(e.num)} alt={`*${e.num}*`} />
          </button>
        );
      })}
    </div>
  );
};

interface PaginationProps {
  page: number;
  maxPage: number;
  onPage: (p: number) => void;
}

const Pagination = ({ page, maxPage, onPage }: PaginationProps) => {
  if (maxPage <= 1) return null;
  const prev = Math.max(1, page - 1);
  const next = Math.min(maxPage, page + 1);
  return (
    <div className="xct-smilies__pager">
      <button type="button" disabled={page <= 1} onClick={() => onPage(1)} title="První">
        «
      </button>
      <button type="button" disabled={page <= 1} onClick={() => onPage(prev)} title="Předchozí">
        ‹
      </button>
      <span className="xct-smilies__pager-info">
        {page} / {maxPage}
      </span>
      <button type="button" disabled={page >= maxPage} onClick={() => onPage(next)} title="Další">
        ›
      </button>
      <button
        type="button"
        disabled={page >= maxPage}
        onClick={() => onPage(maxPage)}
        title="Poslední"
      >
        »
      </button>
    </div>
  );
};
