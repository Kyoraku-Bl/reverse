# KyorakuReplay — website study

A self-contained, dependency-free trading-platform site branded **KyorakuReplay**, built as a design study of the [fxreplay.com](https://fxreplay.com) marketing site *and* its product. Vanilla HTML/CSS/JS — no build step, no framework, no API keys, no backend.

```bash
# from this folder
python3 -m http.server 8000
# open http://localhost:8000
```

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

## Honesty note

Market data is **procedurally generated** (seeded, deterministic per instrument + timeframe) so the site runs with zero API keys — it is practice data, never a live feed. Trades are paper trades. Accounts live in `localStorage` only; nothing is sent anywhere. The KyorakuReplay brand is fictional and this is an independent design study of **fxreplay.com**, not affiliated with FX Replay Inc.

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
assets/js/market-data.js  instrument catalogue (103 symbols), series generator, sizing
assets/js/replay.js       chart renderer, drawings + undo/redo, playback, paper trading
assets/js/app.js          landing-page engine: demo chart, theme, i18n, UI behaviour
assets/js/auth.js         form validation, password strength, theme, session handling
assets/js/dashboard.js    KPIs, equity canvas, journal, mentor, routing, dialogs
```
