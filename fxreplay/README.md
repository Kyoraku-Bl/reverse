# KyorakuReplay — website study

A self-contained, dependency-free trading-platform site branded **KyorakuReplay**, built as a design study of the [fxreplay.com](https://fxreplay.com) marketing site *and* its product demo. Vanilla HTML/CSS/JS — no build step, no framework, no API keys.

```bash
# from this folder
python3 -m http.server 8000
# open http://localhost:8000
```

## Pages

| File | What it is |
| --- | --- |
| `index.html` | English landing page with the live replay terminal |
| `ar.html` | Full Arabic (RTL) edition of the landing page |
| `signup.html` | Account creation page (`?plan=free\|intermediate\|pro` preselects a plan) |
| `login.html` | Log-in page with workspace restore state |
| `dashboard.html` | Signed-in workspace: overview, replay sessions, journal, prop challenges, Mentor AI, indicators and settings |

## What's inside

**Landing page**
- Sticky glass header with mega-menu, mobile drawer, scroll progress and section anchors
- **Light / dark theme toggle** (persisted in `localStorage`, no flash on reload, chart recolours too)
- **Language switch** EN ⇄ عربي, with a hand-built RTL layer and Arabic typography (Noto Kufi Arabic + IBM Plex Sans Arabic)
- Hero with animated gradient orbs, grid plane and dual CTAs
- **Live replay terminal** (see below) embedded in the hero
- Infinite market ticker, animated stat counters
- Five-tab platform tour (Backtesting · Journal · Prop simulator · Mentor AI · FXR Script), each with its own UI mock
- Feature grid (replay mode, multipar, economic calendar, Monte Carlo, seconds timeframes, tick execution) with cursor-tracking glow
- **310-asset market explorer** with market filters, live search and show-all
- Indicator library (FXR Custom + Standard)
- Pricing with annual/monthly toggle, most-popular plan and comparison table
- Testimonials, accordion FAQ, final CTA, full footer with newsletter validation
- Reveal-on-scroll, reduced-motion support, mobile / tablet / desktop layouts

**The interactive terminal** (`assets/js/app.js`)
- 9 instruments × 7 timeframes, procedurally generated OHLCV data (seeded, so it's stable between reloads)
- Canvas candlestick chart drawn from scratch: grid, price/time axes, EMA 21/50, rolling VWAP, last-price tag, crosshair, hover OHLC readout, wheel zoom (Shift + wheel)
- Bar-by-bar replay: play/pause, step, scrub, 1×–25× speed, jump-to-date dialog, auto-starts when scrolled into view
- Paper trading: buy/sell, live R-multiple and P&L, stop/target auto-fill on replay, close button
- Session journal: win rate, net R, profit factor and a per-trade log
- Keyboard shortcuts: `space` play/pause, `→` next candle, `B` / `S` buy / sell

**Auth pages** (`assets/js/auth.js`)
- Split layout: dark marketing panel + form, fully responsive
- Email validation, password strength meter, show/hide password, inline errors
- Plan preselection from the pricing cards, social provider buttons (disabled demo state)
- "Forgot password" flow, success screens, and a signed-in state that carries back to the landing page (your first name replaces "Log in" and a welcome toast appears)

**Dashboard** (`assets/css/dashboard.css`, `assets/js/dashboard.js`)
- App shell with sidebar, sticky topbar, command-search (`⌘K` / `Ctrl K`) and mobile drawer
- Guarded entry: no `fxr-user` in `localStorage` → login dialog (log in, sign up, or one-click demo account)
- **Overview**: continue-replay card, week strip, four KPI tiles, hand-drawn canvas equity curve with hover tooltip and 30D/90D/All range, prop challenge card, recent trades, Mentor AI finding
- **Journal**: 44 seeded trades, live filters (wins/losses/breakeven, market, search, R sort), add/delete trades, CSV export, recalculated stats everywhere
- **Sessions, prop challenges, Mentor AI and indicators**: create/delete sessions, rule-set cards, generated findings with helpful/dismiss votes, review plan checklist, ask-Mentor prompt with data-aware answers
- **Settings**: profile (updates the stored user and header), replay defaults, notification switches, theme picker, demo-data reset, log out
- Light + dark, logical-property layout for RTL, 390 px → desktop responsive, no backend

All prices, trades and statistics are **simulated for demonstration** — they are generated locally in the browser, and no account or request ever leaves the page. The KyorakuReplay brand is fictional: this is a design study, not affiliated with FX Replay Inc.

## Files

```
index.html            English landing page (markup + inline SVG icon sprite)
ar.html               Arabic RTL landing page (same structure, translated)
signup.html           Create-account page
login.html            Log-in page
dashboard.html        Signed-in workspace (app shell + seven sections)
assets/css/main.css   design system, components, light theme, responsive rules
assets/css/rtl.css    Arabic/RTL layer and Arabic typography overrides
assets/css/auth.css   auth-page styles (dark + light)
assets/css/dashboard.css  app-shell, cards, charts, tables, settings
assets/js/app.js      market engine, chart renderer, replay, trading, theme, i18n, UI behaviour
assets/js/auth.js     form validation, password strength, theme, demo session handling
assets/js/dashboard.js  demo data, KPIs, equity canvas, journal, mentor, routing, dialogs
```
