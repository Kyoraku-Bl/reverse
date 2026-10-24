#!/usr/bin/env node
/* KyorakuReplay — market snapshot builder
 *
 * Pulls real OHLCV from the venue's own public endpoint and writes one JSON per
 * instrument, plus _index / _quotes for the site.
 *
 *   node scripts/fetch-data.mjs --out _site/data [--only NQ,ES] [--deadline 600]
 *
 * Sources
 *   futures / indices / FX / metals / energy : Yahoo Finance chart API
 *   crypto                                   : Binance public REST
 *   CME futures (optional, better)           : Databento, when DATABENTO_API_KEY
 *                                              is present in the environment
 *
 * Nothing here invents a candle. A symbol that cannot be fetched is reported in
 * data-status.json and simply keeps the previous file (CI restores it from cache).
 */

import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
function arg(name, def) {
  const i = args.indexOf("--" + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const OUT = path.resolve(arg("out", "_site/data"));
const ONLY = (arg("only", "") || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
const DEADLINE = Number(arg("deadline", "600")) * 1000;
const CONCURRENCY = Number(arg("concurrency", "6"));
const MAX_AGE = Number(arg("max-age", "20")) * 60000;
const YAHOO_BASE = process.env.YAHOO_BASE || "https://query1.finance.yahoo.com";
const YAHOO_BASE_2 = process.env.YAHOO_BASE_2 || "https://query2.finance.yahoo.com";
const BINANCE_BASE = process.env.BINANCE_BASE || "https://data-api.binance.vision";
const DB_KEY = process.env.DATABENTO_API_KEY || "";

const TFS = ["1m", "5m", "15m", "1H", "4H", "1D"];
const YAHOO = {
  "1m": ["1m", "5d"], "5m": ["5m", "1mo"], "15m": ["15m", "3mo"],
  "1H": ["60m", "6mo"], "4H": ["60m", "2y"], "1D": ["1d", "10y"],
};
const BINANCE = { "1m": "1m", "5m": "5m", "15m": "15m", "1H": "1h", "4H": "4h", "1D": "1d" };
/* Databento: rolling 1-minute / daily continuous contracts, converted to the
   same six timeframes. Only the front month is requested, which is what a
   retail backtest of ES/NQ means. */
const DATABENTO = {
  NQ: { dataset: "GLBX.MDP3", symbol: "NQ.c.0" },
  ES: { dataset: "GLBX.MDP3", symbol: "ES.c.0" },
  MNQ: { dataset: "GLBX.MDP3", symbol: "MNQ.c.0" },
  MES: { dataset: "GLBX.MDP3", symbol: "MES.c.0" },
  CL: { dataset: "GLBX.MDP3", symbol: "CL.c.0" },
  GC: { dataset: "GLBX.MDP3", symbol: "GC.c.0" },
  ZN: { dataset: "GLBX.MDP3", symbol: "ZN.c.0" },
  ZB: { dataset: "GLBX.MDP3", symbol: "ZB.c.0" },
  "6E": { dataset: "GLBX.MDP3", symbol: "6E.c.0" },
};

const INSTRUMENTS = [
  ["NQ", "NQ=F", "yahoo"], ["ES", "ES=F", "yahoo"], ["MNQ", "MNQ=F", "yahoo"],
  ["MES", "MES=F", "yahoo"], ["YM", "YM=F", "yahoo"], ["RTY", "RTY=F", "yahoo"],
  ["CL", "CL=F", "yahoo"], ["GC", "GC=F", "yahoo"], ["SI", "SI=F", "yahoo"],
  ["6E", "6E=F", "yahoo"], ["ZB", "ZB=F", "yahoo"], ["ZN", "ZN=F", "yahoo"],
  ["NAS100", "^NDX", "yahoo"], ["SPX500", "^GSPC", "yahoo"], ["US30", "^DJI", "yahoo"],
  ["GER40", "^GDAXI", "yahoo"], ["UK100", "^FTSE", "yahoo"], ["JP225", "^N225", "yahoo"],
  ["EURUSD", "EURUSD=X", "yahoo"], ["GBPUSD", "GBPUSD=X", "yahoo"], ["USDJPY", "JPY=X", "yahoo"],
  ["USDCHF", "CHF=X", "yahoo"], ["AUDUSD", "AUDUSD=X", "yahoo"], ["USDCAD", "CAD=X", "yahoo"],
  ["NZDUSD", "NZDUSD=X", "yahoo"], ["EURJPY", "EURJPY=X", "yahoo"], ["GBPJPY", "GBPJPY=X", "yahoo"],
  ["XAUUSD", "XAUUSD=X", "yahoo"], ["XAGUSD", "XAGUSD=X", "yahoo"],
  ["USOIL", "CL=F", "yahoo"], ["UKOIL", "BZ=F", "yahoo"], ["NGAS", "NG=F", "yahoo"],
  ["BTCUSD", "BTCUSDT", "binance"], ["ETHUSD", "ETHUSDT", "binance"], ["SOLUSD", "SOLUSDT", "binance"],
];
/* The three symbols people ask for first are fetched first, so a throttled run
   still leaves NQ, ES and NAS100 complete. */
const PRIORITY = ["NQ", "ES", "NAS100"];

const started = Date.now();
const report = { ok: 0, requested: 0, skipped: 0, failed: [], partial: {}, at: new Date().toISOString() };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function target(id, symbol, provider) {
  return { id, symbol, provider, providerName: provider === "binance" ? "binance" : "yahoo" };
}

async function fetchJson(url, timeout = 15000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; KyorakuReplay-snapshot/1.0)", Accept: "application/json" },
    });
    if (res.status === 429) throw Object.assign(new Error("HTTP 429"), { retry: true });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function bucket(bars, seconds) {
  const out = [];
  let cur = null;
  for (const b of bars) {
    const k = Math.floor(b[0] / seconds) * seconds;
    if (!cur || cur[0] !== k) {
      if (cur) out.push(cur);
      cur = [k, b[1], b[2], b[3], b[4], b[5]];
    } else {
      cur[2] = Math.max(cur[2], b[2]);
      cur[3] = Math.min(cur[3], b[3]);
      cur[4] = b[4];
      cur[5] += b[5];
    }
  }
  if (cur) out.push(cur);
  return out;
}

async function fromYahoo(t, tf) {
  const [interval, range] = YAHOO[tf];
  const base = Math.random() < 0.5 ? YAHOO_BASE : YAHOO_BASE_2;
  const url = `${base}/v8/finance/chart/${encodeURIComponent(t.symbol)}?interval=${interval}&range=${range}&includePrePost=false`;
  const doc = await fetchJson(url);
  const res = doc?.chart?.result?.[0];
  if (!res || !res.timestamp) throw new Error("empty payload");
  const q = res.indicators.quote[0];
  const bars = [];
  for (let i = 0; i < res.timestamp.length; i++) {
    const [o, h, l, c] = [q.open[i], q.high[i], q.low[i], q.close[i]];
    if (o == null || h == null || l == null || c == null) continue;
    bars.push([res.timestamp[i], +o, +h, +l, +c, q.volume[i] || 0]);
  }
  if (!bars.length) throw new Error("no bars");
  return { bars: tf === "4H" ? bucket(bars, 14400) : bars, symbol: t.symbol, provider: "yahoo" };
}

async function fromBinance(t, tf) {
  const url = `${BINANCE_BASE}/api/v3/klines?symbol=${encodeURIComponent(t.symbol)}&interval=${BINANCE[tf]}&limit=1000`;
  const rows = await fetchJson(url);
  if (!Array.isArray(rows) || !rows.length) throw new Error("no bars");
  const bars = rows.map((r) => [Math.floor(r[0] / 1000), +r[1], +r[2], +r[3], +r[4], +r[5]]);
  /* Binance already serves native 4H candles; only bucket when we asked for 1H */
  const needsBucket = tf === "4H" && BINANCE[tf] !== "4h";
  return { bars: needsBucket ? bucket(bars, 14400) : bars, symbol: t.symbol, provider: "binance" };
}

/* Databento continuous-contract CSV (encoding=csv keeps the SDK out of CI). */
async function fromDatabento(t, tf) {
  const conf = DATABENTO[t.id];
  if (!conf) throw new Error("no databento mapping");
  const days = tf === "1D" ? 3000 : tf === "1m" ? 3 : 240;
  const start = new Date(Date.now() - days * 86400000).toISOString();
  const query = new URLSearchParams({
    dataset: conf.dataset, symbols: conf.symbol, schema: "ohlcv-1m",
    start, stype_in: "continuous", encoding: "csv", limit: "500000",
  });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  let text;
  try {
    const res = await fetch("https://hist.databento.com/v0/timeseries.get_range?" + query, {
      signal: ctrl.signal,
      headers: { Authorization: "Basic " + Buffer.from(DB_KEY + ":").toString("base64") },
    });
    if (!res.ok) throw new Error("databento HTTP " + res.status);
    text = await res.text();
  } finally {
    clearTimeout(timer);
  }
  const lines = text.trim().split("\n");
  const head = lines.shift().split(",");
  const col = (n) => head.indexOf(n);
  const [cT, cO, cH, cL, cC, cV] = [col("ts_event"), col("open"), col("high"), col("low"), col("close"), col("volume")];
  let bars = [];
  for (const line of lines) {
    const p = line.split(",");
    const ts = Math.floor(new Date(p[cT]).getTime() / 1000);
    const scale = 1e-9; /* Databento fixed-point prices */
    bars.push([ts, +p[cO] * scale, +p[cH] * scale, +p[cL] * scale, +p[cC] * scale, +p[cV] || 0]);
  }
  if (!bars.length) throw new Error("no bars");
  if (tf === "5m" || tf === "15m" || tf === "1H" || tf === "4H") bars = bucket(bars, { "5m": 300, "15m": 900, "1H": 3600, "4H": 14400 }[tf]);
  if (tf === "1D") bars = bucket(bars, 86400);
  return { bars, symbol: conf.symbol, provider: "databento" };
}

async function fetchTf(t, tf) {
  const attempts = [];
  if (DB_KEY && DATABENTO[t.id]) attempts.push(() => fromDatabento(t, tf));
  if (t.provider === "binance") attempts.push(() => fromBinance(t, tf));
  else attempts.push(() => fromYahoo(t, tf));
  let lastErr;
  for (const run of attempts) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await run();
      } catch (e) {
        lastErr = e;
        if (!e.retry) break;
        await sleep(1200 * (attempt + 1) + Math.random() * 800);
      }
    }
  }
  throw lastErr || new Error("no source");
}

async function buildOne(t) {
  const file = path.join(OUT, t.id + ".json");
  let prev = null;
  try { prev = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) {}
  const doc = { id: t.id, symbol: t.symbol, provider: t.providerName, fetchedAt: Date.now(), tf: {} };
  const missing = [];
  for (const tf of TFS) {
    if (Date.now() - started > DEADLINE) { missing.push(tf); continue; }
    const old = prev?.tf?.[tf];
    if (MAX_AGE > 0 && old?.bars?.length && Date.now() - (old.fetchedAt || 0) < MAX_AGE) {
      doc.tf[tf] = old;
      continue;
    }
    try {
      const got = await fetchTf(t, tf);
      doc.tf[tf] = {
        interval: tf, provider: got.provider, symbol: got.symbol,
        fetchedAt: Date.now(), currency: "USD", bars: got.bars,
      };
      if (got.provider === "databento") doc.provider = "databento";
    } catch (e) {
      missing.push(tf + ": " + (e.message || e));
      if (old?.bars?.length) doc.tf[tf] = old; /* keep the last real copy */
    }
  }
  if (!Object.keys(doc.tf).length) throw new Error(missing.join("; ") || "nothing fetched");
  fs.writeFileSync(file, JSON.stringify(doc));
  if (missing.length) report.partial[t.id] = missing.join(", ");
  return doc;
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  let list = INSTRUMENTS.map(([id, sym, prov]) => target(id, sym, prov));
  if (ONLY.length) list = list.filter((t) => ONLY.includes(t.id));
  list.sort((a, b) => {
    const ai = PRIORITY.indexOf(a.id), bi = PRIORITY.indexOf(b.id);
    return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi);
  });
  report.requested = list.length;

  const queue = list.slice();
  async function worker() {
    while (queue.length) {
      if (Date.now() - started > DEADLINE) { report.skipped += queue.length; queue.length = 0; break; }
      const t = queue.shift();
      try {
        const doc = await buildOne(t);
        report.ok++;
        const tfs = Object.keys(doc.tf).length;
        console.log(`ok   ${t.id.padEnd(7)} ${t.symbol.padEnd(9)} ${tfs}/6 timeframes`);
      } catch (e) {
        report.failed.push(t.id + ": " + (e.message || e));
        console.log(`fail ${t.id.padEnd(7)} ${e.message || e}`);
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));

  /* index + quotes for the landing page and the terminal rail */
  const ids = list.map((t) => t.id);
  const index = { generatedAt: Date.now(), count: 0, instruments: [] };
  const quotes = {};
  for (const id of ids) {
    try {
      const doc = JSON.parse(fs.readFileSync(path.join(OUT, id + ".json"), "utf8"));
      const daily = doc.tf["1D"] || doc.tf["1H"] || doc.tf["15m"];
      if (!daily?.bars?.length) continue;
      const bars = daily.bars;
      const last = bars[bars.length - 1];
      const prev = bars[bars.length - 2] || last;
      index.instruments.push({ id, tfs: Object.keys(doc.tf) });
      quotes[id] = { symbol: doc.symbol, last: last[4], prev: prev[4], t: last[0], provider: doc.provider, tf: daily.interval };
    } catch (e) {}
  }
  index.count = index.instruments.length;
  fs.writeFileSync(path.join(OUT, "_index.json"), JSON.stringify(index));
  fs.writeFileSync(path.join(OUT, "_quotes.json"), JSON.stringify({ generatedAt: Date.now(), quotes }));
  fs.writeFileSync(path.join(OUT, "..", "data-status.json"), JSON.stringify(report, null, 1));
  console.log(`\n${report.ok}/${report.requested} instruments, ${report.skipped} skipped, ${report.failed.length} failed`);
  if (report.failed.length) console.log("failed: " + report.failed.join(" | "));
  if (Object.keys(report.partial).length) console.log("partial: " + JSON.stringify(report.partial));
}

main().catch((e) => { console.error(e); process.exit(1); });
