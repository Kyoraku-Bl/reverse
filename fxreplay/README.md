# KyorakuReplay — website study

A trading-platform site branded **KyorakuReplay**, built as a design study of the [fxreplay.com](https://fxreplay.com) marketing site *and* its product. Vanilla HTML/CSS/JS — no build step, no framework, no API keys.

**The charts show real market data.** Candles on the replay terminal come from public feeds (Yahoo Finance chart API for indices, futures, metals, energy and spot FX; Binance klines for crypto) through a tiny same-origin proxy, so there is no key to configure and no CORS problem.

```bash
# from this folder — static site + /api proxy, no dependencies
python3 server.py            # http://localhost:8000
PORT=9000 python3 server.py  # another port
```

`server.py` serves the pages *and* the two data endpoints (`/api/yahoo`, `/api/binance`). Opening the HTML files directly, or serving them with a plain static server, still works — the terminal then detects that the feed is missing and says so on the chart.

## Pages

| File | What it is |
| --- | --- |
| `index.html` | English landing page with an embedded replay preview |
| `ar.html` | Full Arabic (RTL) edition of the landing page |
| `signup.html` | Account creation page (`?plan=free\|intermediate\|pro` preselects a plan) |
| `login.html` | Log-in page with workspace restore state |
| `dashboard.html` | Signed-in workspace: overview, replay sessions, journal, prop challenges, Mentor AI, indicators and settings |
| `replay.html` | **Full-screen replay terminal** — the main workspace |

## The replay terminal (`replay.html`)

This is the real product surface: a full-viewport chart, not a marketing mock.

**Chart**
- Canvas engine drawn from scratch: candles, price axis, adaptive time axis, watermark, crosshair with price + timestamp tags, last-price tag
- EMA 21, EMA 50 and a rolling 96-bar VWAP, each recoloured for light/dark
- Scroll to zoom around the cursor, drag to pan, double-click to reset; "Jump to replay position" chip when you pan away from the playhead

**Drawing tools (with undo / redo)**
- Cursor/select, trend line, horizontal line, vertical line, zone/rectangle, Fibonacci retracement
- Click to place, drag to size, drag handles to edit, `Del` to delete the selection, `Shift+Del` to clear all
- `Ctrl/⌘+Z` undo, `Ctrl/⌘+Shift+Z` (or `Ctrl+Y`) redo — up to 60 steps, per instrument and timeframe
- Drawings persist in `localStorage`, animating away when you undo instead of just disappearing on reload

**Replay**
- Bar-by-bar playback with play/pause, single-step forward/back, a scrubber across the whole series and 0.5×–8× speeds
- Jump to any date: pick a datetime or use −1M / −3M / −1Y / Start / Latest
- Session clock, keyboard control (`Space`, `←`, `→`), auto-pause when the tab is hidden

**Paper trading**
- Market BUY / SELL at bid/ask with a spread, position sizing that risks exactly $100 at the instrument's stop distance
- Entry / stop / target drawn as bands on the chart; stop and 2R target fill automatically as the replay advances
- Live R-multiple and P&L, close button, session win rate / net R / trade count
- Closed trades are written into the dashboard journal automatically, and exportable as CSV

**Instruments**
- **103 instruments across six markets**: Forex (20 pairs), **Futures (59 contracts: CME, CBOT, NYMEX, ICE, Eurex)**, Indices (10), Crypto (7), Metals (4), Energy (3)
- Futures cover equity index (ES, NQ, YM, RTY, FDAX, FESX, VX…), energy (CL, NG, HO, RB, BZ), metals (GC, SI, HG, PL, PA), rates (ZB, ZN, ZF, ZT, FGBL, FGBM), FX (6E, 6B, 6J, 6A, 6C, 6S, DX) and grains/softs (ZC, ZS, ZW, KC, SB, CC, CT, OJ…)
- Every contract carries its real tick size and point value, so P&L is contract-accurate
- Searchable picker with market tabs; `?sym=NQ&tf=5m` deep-links straight to an instrument

**Keyboard**: `Space` play/pause · `←` `→` step · `V T H L R F` tools · `B` / `S` buy / sell · `Del` delete drawing · `Esc` cancel · `Ctrl+Z` undo · `Ctrl+Shift+Z` redo

### Deploying (Vercel)

1. Import the repository, set **Root Directory** to `fxreplay` (the site lives in this folder).
2. Framework preset: *Other* · build command: none · output directory: `.`
3. Deploy. `api/yahoo.js` and `api/binance.js` are picked up as serverless functions, so the deployed site streams live prices with no key and no extra configuration. Any static host works too (GitHub Pages, Netlify, S3) — the terminal then simply falls back to the labelled simulated series, since `/api` will not exist.

## Everything is free

There is no paid tier, no trial countdown and no plan gate in this build. All three pricing cards read **$0 / month**, and the dashboard shows a "Everything unlocked" card instead of an upgrade funnel. The `?plan=` parameter still works so you can see how the flows were wired, but nothing is restricted.

## No demo data

The workspace starts **empty** on purpose:

- The journal begins at 0 trades, 0.0R, 0% win rate — no seeded sample trades
- Replay sessions begin empty with a "Start a replay session" card
- Mentor AI shows a "log at least five trades" state until you have real ones, then derives every finding from your own journal
- The prop challenge card is computed from your trades (balance, drawdown, consistency, trading days) and reads "Not started" until you log something
- There is no "Use demo account" button anywhere; accounts are the ones you create
- Settings and the footer offer **Clear workspace data**, which empties the journal and sessions

## What else is on the site

**Landing page**
- Sticky glass header with mega-menu, mobile drawer, scroll progress and section anchors
- **Light / dark theme toggle** (persisted in `localStorage`, no flash on reload)
- **Language switch** EN ⇄ عربي, with a hand-built RTL layer and Arabic typography
- Hero with animated gradient orbs, grid plane and dual CTAs
- Infinite market ticker, animated stat counters
- Five-tab platform tour (Backtesting · Journal · Prop simulator · Mentor AI · FXR Script)
- Feature grid with cursor-tracking glow
- Instrument explorer with market filters, live search and show-all
- Pricing (all free), comparison table, testimonials, accordion FAQ, final CTA, footer with newsletter validation
- Reveal-on-scroll, reduced-motion support, mobile / tablet / desktop layouts

**Auth pages** (`assets/js/auth.js`)
- Split layout: dark marketing panel + form, fully responsive
- Email validation, password strength meter, show/hide password, inline errors
- Plan preselection from the pricing cards, "forgot password" flow and success screens
- Signed-in state carries back to the landing page (your first name replaces "Log in")

**Dashboard** (`assets/css/dashboard.css`, `assets/js/dashboard.js`)
- App shell with sidebar, sticky topbar, command-search (`⌘K` / `Ctrl K`) and mobile drawer
- Guarded entry: no `fxr-user` in `localStorage` → login dialog
- **Overview**: continue-replay card, week strip, KPI tiles, canvas equity curve with hover tooltip and 30D/90D/All range, prop challenge card, recent trades, Mentor AI finding
- **Journal**: filters (wins/losses/breakeven, market, search, R sort), add/delete trades, CSV export, recalculated stats everywhere
- **Sessions**: cards fed by real terminal sessions; "New session" opens the terminal
- **Settings**: profile, replay defaults, notification switches, theme picker, clear-data and log out
- Light + dark, logical-property layout for RTL, 390 px → desktop responsive

## Real market data

Every one of the 103 instruments is mapped to a public ticker. The terminal loads it on boot and on every symbol / timeframe change:

| Market | Source | Symbols |
| --- | --- | --- |
| Forex (spot) | Yahoo Finance | `EURUSD=X`, `GBPJPY=X`, `USDZAR=X` … |
| Indices | Yahoo Finance | `^NDX`, `^GSPC`, `^DJI`, `^GDAXI`, `^N225`, `^HSI` … |
| Futures | Yahoo Finance | continuous front month `ES=F`, `NQ=F`, `CL=F`, `GC=F`, `ZC=F`, `6E=F` … |
| Metals / Energy | Yahoo Finance | spot `XAUUSD=X` with `GC=F` as the fallback, `CL=F`, `BZ=F`, `NG=F` |
| Crypto | Binance | `BTCUSDT`, `ETHUSDT`, `SOLUSDT` … (spot) |

- **The candles are the provider's own OHLCV.** Nothing is rescaled, smoothed or resampled except 4H, which is built by bucketing Yahoo's 60-minute candles 4:1 (Binance serves 4H natively).
- **The chart tells you where the data came from.** A chip in the legend reads `LIVE · Yahoo Finance` (green) or `LIVE · Binance`; hovering it shows the exact ticker and fetch time. If the feed is unreachable it reads `CACHED · Cached` (last real prices saved in the browser) or `SIMULATED` (amber).
- **The generator is a labelled fallback only.** It runs when there is no public source for a contract, when the proxy is missing (static hosting) or when the provider is down — and in those cases the chart says so, in the badge and in a note under the chart. It is never presented as market data.
- **You can force it.** The `Auto / Live / Offline` switch in the top bar cycles auto (real when possible) → live (never simulate) → offline (always simulate, for demos and screenshots).
- Caching: in-memory TTL per timeframe (45 s for 1m → 15 min for 1D), plus a `localStorage` tail of the last 1,200 bars per instrument/timeframe kept for 6 h so a refresh or an offline moment still shows the last real prices.
- The proxy is two files: `api/yahoo.js` and `api/binance.js` (Vercel serverless functions, also mirrored by `server.py` for local use). Both allowlist intervals/ranges, time out at 9 s, cache at the CDN edge and never expose a key because none is needed. Requests rotate between mirrors — `query1`/`query2.finance.yahoo.com` and `data-api.binance.vision`/`api.binance.com`, the last one because Binance refuses to serve some regions from `api.binance.com`.

## Honesty note

Prices are real public market data; the *trading* is paper trading. Accounts, drawings, trades and sessions live in `localStorage` only — nothing is sent anywhere except the symbol you are looking at, to the public price API. The synthetic engine still exists so the site never shows a blank chart, but whenever it is used the UI labels it **SIMULATED**. The KyorakuReplay brand is fictional and this is an independent design study of **fxreplay.com**, not affiliated with FX Replay Inc.

## Files

```
index.html            English landing page (markup + inline SVG icon sprite)
ar.html               Arabic RTL landing page (same structure, translated)
replay.html           Full-screen replay terminal
signup.html           Create-account page
login.html            Log-in page
dashboard.html        Signed-in workspace (app shell + seven sections)
assets/css/main.css       design system, components, light theme, responsive rules
assets/css/rtl.css        Arabic/RTL layer and Arabic typography overrides
assets/css/auth.css       auth-page styles (dark + light)
assets/css/replay.css     terminal layout, chart chrome, tool rail, ticket panel
assets/css/dashboard.css  app-shell, cards, charts, tables, settings
assets/js/market-data.js  instrument catalogue (103 symbols), indicators, synthetic fallback engine
assets/js/data-provider.js live data layer: symbol map, Yahoo/Binance fetchers, cache, fallbacks
api/yahoo.js              serverless proxy for the Yahoo Finance chart API
api/binance.js            serverless proxy for Binance spot klines
server.py                 local dev server: static files + the same /api routes
vercel.json               Vercel function settings for the two proxies
assets/js/replay.js       chart renderer, drawings + undo/redo, playback, paper trading
assets/js/app.js          landing-page engine: demo chart, theme, i18n, UI behaviour
assets/js/auth.js         form validation, password strength, theme, session handling
assets/js/dashboard.js    KPIs, equity canvas, journal, mentor, routing, dialogs
```
