/**
 * SmiliesTab – paleta smajlíků v Sidebaru.
 *
 * Dvě podzáložky ve stylu pill-přepínače (shodný vzhled jako `xct-search__modes`
 * v TopBaru; každá půlka zaoblená pouze po vnější straně):
 *   1) „Oblíbení (N/100)" – smajlíci uložení v `chrome.storage.sync`
 *      (viz `favouriteSmileys.ts`). Kliknutím vložím `*N*` do MessageFormu,
 *      Ctrl+klik odebere z oblíbených.
 *   2) „Všichni" – stránkovaný katalog z `/~$xhash/settings/smiles.php`
 *      zobrazený jako tabulka (Číslo / Smajlík / Popis), s lokálním
 *      fulltextem podle popisku (přes `search-txt`).
 *
 * Seznam oblíbených i katalog jsou vždy řazené vzestupně podle čísla.
 *
 * Autor: Jan Elznic <jan@elznic.com> – https://janelznic.cz
 */

import { useEffect, useMemo, useState } from 'react';
import type { RoomContext } from '../../../../api/types';
import { SearchIcon } from '../../../icons/IconPalette';
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
      <div className="xct-smilies__subtabs-wrap">
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
            Všichni
          </button>
        </nav>
      </div>

      <div className="xct-smilies__body">
        {subTab === 'favourites' ? (
          <FavouritesPanel favs={favs} onInsert={insertSmile} xhash={ctx.xhash} />
        ) : (
          <AllSmiliesPanel ctx={ctx} onInsert={insertSmile} />
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
          Přidat je můžeš v záložce „Všichni" výše, nebo v{' '}
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
  // Storage layer vrací pole už vzestupně, ale pro jistotu řadíme i tady.
  const sorted = [...favs.nums].sort((a, b) => a - b);
  return (
    <div className="xct-smilies__fav-box">
      <div className="xct-smilies__grid">
        {sorted.map((num) => (
          <button
            key={num}
            type="button"
            className="xct-smilies__item"
            title={`*${num}*`}
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
    </div>
  );
};

// ─── „Všichni" ───────────────────────────────────────────────────────────────

interface AllSmiliesPanelProps {
  ctx: RoomContext;
  onInsert: (num: number) => void;
}

const AllSmiliesPanel = ({ ctx, onInsert }: AllSmiliesPanelProps) => {
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

  const sortedItems = useMemo<SmileCatalogEntry[]>(
    () => (data ? [...data.items].sort((a, b) => a.num - b.num) : []),
    [data],
  );

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
        <button type="submit" className="xct-smilies__search-btn" title="Hledat">
          <SearchIcon width={14} height={14} />
        </button>
        {search ? (
          <button
            type="button"
            className="xct-smilies__search-clear"
            onClick={clearSearch}
            title="Zrušit vyhledávání"
          >
            ×
          </button>
        ) : null}
      </form>

      {loading ? <div className="xct-smilies__status">Načítám…</div> : null}
      {error ? <div className="xct-smilies__error">{error}</div> : null}

      {data && !loading ? (
        <>
          <Pagination page={data.page} maxPage={data.maxPage} onPage={setPage} />
          <SmilesTable items={sortedItems} onInsert={onInsert} />
          <Pagination page={data.page} maxPage={data.maxPage} onPage={setPage} />
        </>
      ) : null}
    </div>
  );
};

// ─── Tabulka smajlíků ───────────────────────────────────────────────────────

interface SmilesTableProps {
  items: SmileCatalogEntry[];
  onInsert: (num: number) => void;
}

const SmilesTable = ({ items, onInsert }: SmilesTableProps) => {
  if (items.length === 0) {
    return <div className="xct-smilies__empty">Žádné smajlíky k zobrazení.</div>;
  }
  return (
    <table className="xct-smilies__table">
      <thead>
        <tr>
          <th className="xct-smilies__th-num">#</th>
          <th className="xct-smilies__th-img" aria-label="Smajlík" />
          <th className="xct-smilies__th-desc">Popis</th>
        </tr>
      </thead>
      <tbody>
        {items.map((e) => (
          <tr
            key={e.num}
            className="xct-smilies__tr"
            title={`*${e.num}*`}
            onClick={() => onInsert(e.num)}
          >
            <td className="xct-smilies__td-num">*{e.num}*</td>
            <td className="xct-smilies__td-img">
              <img src={e.imgUrl || XChatEmoji.url(e.num)} alt={`*${e.num}*`} />
            </td>
            <td className="xct-smilies__td-desc">{e.desc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ─── Stránkování (chipy) ────────────────────────────────────────────────────

interface PaginationProps {
  page: number;
  maxPage: number;
  onPage: (p: number) => void;
}

const Pagination = ({ page, maxPage, onPage }: PaginationProps) => {
  if (maxPage <= 1) return null;
  // Okno 3 čísel kolem aktuální – při maxPage 100+ se tím vejdeme na jeden řádek.
  const windowSize = 3;
  const half = Math.floor(windowSize / 2);
  let start = Math.max(1, page - half);
  const end = Math.min(maxPage, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);

  return (
    <div className="xct-smilies__pager">
      <button
        type="button"
        className="xct-smilies__chip xct-smilies__chip--nav"
        disabled={page <= 1}
        onClick={() => onPage(1)}
        title="První"
      >
        «
      </button>
      <button
        type="button"
        className="xct-smilies__chip xct-smilies__chip--nav"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
        title="Předchozí"
      >
        ‹
      </button>
      {pages.map((p) => (
        <button
          key={p}
          type="button"
          className={`xct-smilies__chip ${p === page ? 'is-active' : ''}`}
          onClick={() => onPage(p)}
        >
          {p}
        </button>
      ))}
      <button
        type="button"
        className="xct-smilies__chip xct-smilies__chip--nav"
        disabled={page >= maxPage}
        onClick={() => onPage(page + 1)}
        title="Další"
      >
        ›
      </button>
      <button
        type="button"
        className="xct-smilies__chip xct-smilies__chip--nav"
        disabled={page >= maxPage}
        onClick={() => onPage(maxPage)}
        title="Poslední"
      >
        »
      </button>
    </div>
  );
};
