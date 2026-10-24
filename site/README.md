# KyorakuReplay

A replay terminal for real market data. Rebuild of the earlier `fxreplay/` folder
from scratch: same goal (a free FX Replay / TradingView-style practice desk),
new code, fewer moving parts.

```
site/
  index.html        landing page (EN)
  ar.html           landing page (AR, RTL)
  terminal.html     the replay terminal — chart, replay, drawings, ticket, journal
  dashboard.html    per-email workspace: KPIs, journal, watchlist
  login.html        log in
  signup.html       create account
  404.html          fallback page
  assets/css/       base.css (design system), terminal.css, rtl.css
  assets/js/        store.js, feed.js, chart.js, terminal.js, landing.js, auth.js, dash.js
  scripts/          fetch-data.mjs — the snapshot builder the CI job runs
  tests/            data-check.mjs — refuses a snapshot with a lying candle
  data/             published snapshot (gitignored; produced by CI)
```

## Data

| Market | Symbols | Source | Venue |
| --- | --- | --- | --- |
| Futures | NQ, ES, MNQ, MES, YM, RTY, CL, GC, SI, 6E, ZB, ZN | Yahoo Finance chart API (`NQ=F`, …) | CME Globex, CBOT, NYMEX, COMEX |
| Indices | NAS100, SPX500, US30, GER40, UK100, JP225 | `^NDX`, `^GSPC`, `^DJI`, `^GDAXI`, `^FTSE`, `^N225` | Nasdaq, Cboe, Xetra, LSE, TSE |
| FX | 9 majors and crosses | `EURUSD=X`, … | interbank |
| Metals / energy | XAUUSD, XAGUSD, USOIL, UKOIL, NGAS | `XAUUSD=X`, `CL=F`, `BZ=F`, `NG=F` | LBMA, NYMEX, ICE |
| Crypto | BTCUSD, ETHUSD, SOLUSD | Binance public REST | Binance spot |

Three rules the code enforces:

1. **No invented candles.** If the snapshot and the live feed both fail, the chart
   draws an empty state that says so. There is no synthetic series anywhere.
2. **Say where it came from.** The badge reads `LIVE · <provider>` or
   `SNAPSHOT · <provider>` with the age, and the status bar names the exact ticker.
3. **Free stays free.** Every instrument, timeframe, drawing tool and the CSV
   export is available without an account.

### Timeframes

`1m · 5m · 15m · 1H · 4H · 1D`. 4H is aggregated from the provider's own 60-minute
candles (never resampled from a different source, never interpolated).

### Refreshing the snapshot

```bash
node site/scripts/fetch-data.mjs --out site/data --concurrency 6 --deadline 600
node site/tests/data-check.mjs site/data
```

The CI workflow (`.github/workflows/kyorakureplay-pages.yml`) runs the same two
commands every 30 minutes, caches the previous snapshot so a throttled run cannot
blank the site, then deploys `site/` to GitHub Pages.

If a paid CME feed is configured, futures come from it instead of Yahoo: set the
repository secret `DATABENTO_API_KEY` and `fetch-data.mjs` switches NQ, ES, MNQ,
MES, CL, GC, ZN, ZB and 6E to Databento continuous contracts (`*.c.0`,
`ohlcv-1m`, re-bucketed to the six timeframes). No key, no problem — the public
Yahoo futures series is still real exchange data, just delayed.

## Accounts

Accounts are local to the browser: an email + a hashed password in `localStorage`,
and every user gets a separate workspace key (`ky.u.<hash>`) holding their
watchlist, symbol, timeframe, drawings, open positions and closed-trade journal.
Two emails on the same machine never see each other's numbers. Nothing is uploaded.

## Terminal

- **Chart** — canvas candles, volume pane, EMA 20/50, price/time axes, last-price
  tag, crosshair with price + time labels, drag to scroll, wheel to zoom,
  double-click to re-centre. TradingView colour convention (`#089981` / `#f23645`
  light, `#26a69a` / `#ef5350` dark), dashed day separators when zoomed in.
- **Replay** — enter at 55 % of the series (or `?at=<epoch ms>`), play 0.5×–5×,
  step one candle, jump to a date. The future is veiled, not deleted.
- **Drawings** — trend line, horizontal, rectangle, Fibonacci, long-position tool,
  undo (`Ctrl+Z`), clear. Saved per symbol and per email.
- **Ticket** — buy/sell at the replay cursor, optional stop in ticks, P&L computed
  with the contract's real tick size and tick value (NQ $5, ES $12.5, MNQ $0.5 …).
- **CSV** — `time,open,high,low,close,volume` for exactly the candles on screen.
- **Keys** — `/` search, `Space` play/pause, `←` `→` step, `R` replay, `Esc` close.

## Run it locally

```bash
cd site && python3 -m http.server 8010
# http://127.0.0.1:8010/
```

A static server is enough; there is no build step and no dependency at runtime.

## Status

Rebuilt 2026-10-24. See the commit log for what changed.
