# XChat Toolkit

Prohlížečové rozšíření (Chrome / Edge / Brave, Manifest V3), které sdružuje kolekci vylepšení webu [www.xchat.cz](https://www.xchat.cz/). Každé vylepšení, původně samostatný userscript pro Tampermonkey, je zde nasazené jako samostatná **funkce**, kterou lze libovolně zapnout nebo vypnout v **Možnostech nastavení**.

**Autor:** Jan Elznic &lt;[jan@elznic.com](mailto:jan@elznic.com)&gt; — [janelznic.cz](https://janelznic.cz)
**Licence:** source-available (viz [`LICENSE`](./LICENSE))

![Ikonka XChat Toolkitu](./src/icons/icon.svg)

---

## Obsah

- [Seznam funkcí](#seznam-funkcí)
- [Instalace v prohlížeči](#instalace-v-prohlížeči)
  - [Nutná nastavení po instalaci](#nutná-nastavení-po-instalaci)
- [Vývoj](#vývoj)
  - [Požadavky](#požadavky)
  - [Rychlý start](#rychlý-start)
  - [Živý dev server (HMR)](#živý-dev-server-hmr)
  - [Produkční build](#produkční-build)
- [Struktura projektu](#struktura-projektu)
- [Architektura funkcí](#architektura-funkcí)
- [Ikony](#ikony)
- [Licence](#licence)

---

## Seznam funkcí

| ID | Název | Kde se projeví |
| --- | --- | --- |
| `room-messages` | Hlavní sklo – zprávy a ovládání | hlavní sklo místnosti (startframe / infopage / reloadpage …) |
| `room-sidebar-hide` | Skrýt sidebar v místnosti | všechny `modchat` stránky |
| `favourite-emojis` | Oblíbení smajlíci navíc | rámec smajlíků v místnosti |
| `favourite-users` | Oblíbení uživatelé (VIP z Poznámek) | seznam uživatelů (`op=userspage`) |
| `more-smiles` | Více smajlíků v Nastavit | stránky Uživatelé / Nápověda / Ignorování |
| `disable-room-popup` | Historie místností – skrýt popup | `op=roomlist` |
| `forum-favourite` | Fórum – oblíbená | `forum/favourite.php` |
| `message-copy` | Vzkazy – kopírovat detail | `offline/read_msg.php` |
| `message-reply-fix` | Vzkazy – oprava odpovědi | `offline/new_msg.php` |

Každou funkci lze samostatně vypnout přes ikonu rozšíření → *Možnosti nastavení*.

---

## Instalace v prohlížeči

Rozšíření zatím není publikované v Chrome Web Store, instaluje se lokálně ze složky `dist/`:

1. Sestavte rozšíření: `npm install && npm run build` (viz [Vývoj](#vývoj)).
2. V prohlížeči otevřete stránku s rozšířeními:
   - **Chrome:** `chrome://extensions`
   - **Edge:** `edge://extensions`
   - **Brave:** `brave://extensions`
3. Zapněte **Vývojářský režim** (*Developer mode*) v pravém horním rohu.
4. Klikněte na **Načíst rozbalené** (*Load unpacked*) a vyberte složku `dist/`.
5. Ikonu připněte do lišty (ikonka puzzle → špendlík). Kliknutím na ikonu se otevře stránka *Možnosti nastavení*.

### Nutná nastavení po instalaci

- **Cookies pro xchat.cz**: rozšíření používá přihlášení uživatele. Pokud máte agresivní blokátor cookies, povolte cookies pro:
  - `www.xchat.cz`
  - `scripts.xchat.cz`
- **Cross-origin API volání**: rozšíření má v manifestu `host_permissions` pro `scripts.xchat.cz`, takže `fetch` z obsahových skriptů funguje bez nutnosti CORS. Žádné další nastavení není potřeba.
- **Po aktualizaci rozšíření**: obnovte otevřené záložky XChatu (Ctrl+F5 / ⌘+Shift+R), aby se načetl aktualizovaný content script.
- **Po zapnutí/vypnutí funkce**: obnovte otevřenou záložku XChatu, změny nastavení se projeví při nejbližším načtení stránky.
- **Přísné blokátory skriptů (uBlock Origin v „medium" módu, NoScript atd.)**: povolte spouštění skriptů ze zdrojů `xchat.cz`, `scripts.xchat.cz`, `x.ximg.cz`, `ximg.cz`.

---

## Vývoj

### Požadavky

- [Node.js](https://nodejs.org/) **18+** (doporučeno 20 LTS)
- npm 9+ (součást Node.js)
- Linuxové / macOS / Windows prostředí s kompilátorem pro `sharp` (ikony se generují přes nativní knihovnu)

### Rychlý start

```bash
git clone <repo-url>
cd xchat-toolkit
npm install
npm run build
```

Výstup je ve složce `dist/`. Tu načtěte do prohlížeče dle [kapitoly Instalace](#instalace-v-prohlížeči).

### Živý dev server (HMR)

```bash
npm run dev
```

Spustí Vite + [`@crxjs/vite-plugin`](https://crxjs.dev/vite-plugin), který:

- hlídá všechny zdrojové soubory a při změně okamžitě přestaví výstup v `dist/`,
- pro content skripty a stránky rozšíření (*Options*) podporuje **HMR** (Hot Module Replacement),
- k běžícímu dev serveru přistupuje i rozšíření nainstalované v prohlížeči (po úpravě kódu stačí obnovit záložku XChatu).

Doporučený workflow:

1. `npm run dev`
2. V prohlížeči načtěte rozšíření z `dist/` (viz [Instalace](#instalace-v-prohlížeči)).
3. Upravte zdrojový soubor → `dist/` se automaticky přestaví.
4. Obnovte záložku XChatu. U Options stránky se HMR aplikuje bez obnovení.

### Produkční build

```bash
npm run build
```

Vytvoří minifikovaný bundle včetně source-map a PNG ikon (16, 32, 48, 128, 256 px) vygenerovaných ze SVG předlohy.

```bash
npm run icons    # pouze regenerace PNG ikon z src/icons/icon.svg
npm run clean    # vymaže dist/ a public/icons/
```

---

## Struktura projektu

```
xchat-toolkit/
├── package.json
├── vite.config.js
├── scripts/
│   └── build-icons.mjs        # generátor PNG ikon ze SVG
├── src/
│   ├── manifest.config.js     # MV3 manifest (pro @crxjs)
│   ├── icons/
│   │   └── icon.svg           # zdrojové logo „Xt"
│   ├── core/                  # jádro rozšíření – shared třídy
│   │   ├── Feature.js
│   │   ├── FeatureRegistry.js
│   │   ├── Settings.js
│   │   └── pageInject.js
│   ├── features/              # jednotlivé funkce jako ES6 classes
│   │   ├── index.js           # registr
│   │   ├── DisableRoomPopup.js
│   │   ├── RoomSidebarHide.js
│   │   ├── RoomMessages.js
│   │   ├── FavouriteEmojis.js
│   │   ├── FavouriteUsers.js
│   │   ├── MoreSmiles.js
│   │   ├── ForumFavourite.js
│   │   ├── MessageCopy.js
│   │   ├── MessageReplyFix.js
│   │   └── legacy/
│   │       └── favouriteUsersLegacy.js
│   ├── content/
│   │   └── bootstrap.js       # izolovaný content script (entry point)
│   ├── page/
│   │   └── room-messages.js   # MAIN-world skript injektovaný přes <script>
│   ├── background/
│   │   └── service-worker.js
│   └── options/
│       ├── options.html       # stránka „Možnosti nastavení"
│       ├── options.js
│       └── options.css
└── dist/                      # výstup buildu (načítá se do prohlížeče)
```

## Architektura funkcí

- **`Feature` base class** (`src/core/Feature.js`) deklaruje statická metadata (`id`, `name`, `description`, `matches`, `runAt`, `defaultEnabled`) a metodu `run(ctx)`.
- **`FeatureRegistry`** při startu načte nastavení ze `chrome.storage.sync`, vyfiltruje funkce, jejichž `matches` odpovídají aktuální URL, a postupně je spustí podle `runAt` (`'start'` → hned, `'end'` → po `DOMContentLoaded`).
- **Izolovaný content script** (`src/content/bootstrap.js`) je nasazen v každém rámci XChatu (`all_frames: true`). Má přístup k `chrome.storage`, ale **ne** k JS objektům stránky.
- **MAIN-world injekce**: funkce, která potřebuje přímo sáhnout na globály stránky (`window.top.roomframe`, `dataframe.refresh`, `document.domain = 'xchat.cz'`), použije `injectPageScript('src/page/…js')`. Cílový soubor je ve `web_accessible_resources` a spustí se v kontextu stránky.
- **Nastavení** je v `chrome.storage.sync` pod klíčem `xchatToolkitSettings`. Options stránka je jediný editor, content skripty pouze čtou.
- **Feature-specific data** (např. ID oblíbených smajlíků) jsou v `chrome.storage.local`.
- **Žádná duplikace kódu**: sdílené pomocné funkce (Settings, Feature, pageInject) jsou v `src/core/` a importují se napříč funkcemi.

## Ikony

Logo „velké oranžové **X** + malé modré **t**" je jako vektor v `src/icons/icon.svg`. Barvy:

- oranžová `#E08627`
- modrá `#1C337D`

Build script [`scripts/build-icons.mjs`](./scripts/build-icons.mjs) jej pomocí [`sharp`](https://sharp.pixelplumbing.com/) rasterizuje do PNG v rozměrech **16, 32, 48, 128, 256 px**. Stejné ikony jsou zobrazené na stránce *Možnosti nastavení*. Regenerace:

```bash
npm run icons
```

---

## Licence

Projekt je pod **source-available** licencí:

- ✅ **Volné použití bez souhlasu autora** — lze spouštět, studovat, instalovat i pro komerční účely.
- ⚠️ **Úpravy a šíření pouze se souhlasem autora** a s jeho **uvedením (citací)**.

Plné znění je v souboru [`LICENSE`](./LICENSE). Žádosti o souhlas pro úpravy / šíření na [jan@elznic.com](mailto:jan@elznic.com).

Autor: **Jan Elznic** — [janelznic.cz](https://janelznic.cz)
