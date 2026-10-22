#!/usr/bin/env node
/* =========================================================
   KyorakuReplay — market data snapshot job

   Fetches real candles for every catalogue instrument straight from
   the public providers and writes them next to the site:

     data/<ID>.json  ->  { id, symbol, provider, fetchedAt, tf: { "1m": {...}, ... } }

   GitHub Pages then serves those files same-origin, so the terminal has
   100% real prices even when every CORS relay is blocked.

     node scripts/fetch-market-data.mjs --out data [--only NAS100,NQ]

   No dependencies, no API keys.
   ========================================================= */
import fs from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/* ---------- options ---------- */
const argv = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = argv.indexOf("--" + name);
  return i === -1 ? fallback : argv[i + 1];
};
const OUT = path.resolve(ROOT, opt("out", "data"));
const ONLY = (opt("only", "") || "").split(",").map((s) => s.trim()).filter(Boolean);
const CONCURRENCY = Number(opt("concurrency", "4"));
/* Seconds after which no new instrument is started. Instruments already
   fetched stay written, so a slow provider still yields a usable snapshot
   instead of the job being killed mid-write. 0 disables the limit. */
const DEADLINE = Number(opt("deadline", "0"));
/* A single instrument may not stall the queue: once it has spent this long,
   it keeps whatever timeframes it already has. */
const PER_INSTRUMENT = Number(opt("per-instrument", "90"));
const STARTED = Date.now();

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/* ---------- load the shared symbol map + catalogue ---------- */
function loadScripts(files) {
  const ctx = { console, Date, Math, JSON, Map, Set, Object, Array, String, Number, isFinite, parseInt, parseFloat };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of files) vm.runInContext(readFileSync(path.join(ROOT, f), "utf8"), ctx, { filename: f });
  return ctx;
}

const { KRSymbols, KRMarket } = loadScripts(["assets/js/symbol-map.js", "assets/js/market-data.js"]);
const LIVE = KRSymbols.LIVE;

/* ---------- what we ask each provider for ---------- */
const YAHOO_TF = {
  "1m": { interval: "1m", range: "5d" },
  "5m": { interval: "5m", range: "1mo" },
  "15m": { interval: "15m", range: "3mo" },
  "1H": { interval: "60m", range: "2y" },
  "4H": { interval: "60m", range: "2y", aggregate: 4 },
  "1D": { interval: "1d", range: "10y" },
};
const BINANCE_TF = { "1m": "1m", "5m": "5m", "15m": "15m", "1H": "1h", "4H": "4h", "1D": "1d" };
const BAR_LIMIT = { "1m": 600, "5m": 700, "15m": 700, "1H": 1000, "4H": 700, "1D": 1400 };

/* Mirrors rotate on rate limits. The env overrides exist so the job can be
   exercised against a local mock (see tests/data-check.mjs). */
const hosts = (env, fallback) =>
  (process.env[env] || "").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean).concat(fallback);

const YAHOO_HOSTS = hosts("YAHOO_BASE", ["https://query1.finance.yahoo.com", "https://query2.finance.yahoo.com"]);
const BINANCE_HOSTS = hosts("BINANCE_BASE", ["https://data-api.binance.vision", "https://api.binance.com"]);

/* Public CORS/JSON relays, used only when the runners cannot reach Yahoo
   directly (the free endpoint throttles datacentre IPs). Same list, same
   order as the browser's data provider. */
const RELAYS = [
  (u) => "https://r.jina.ai/" + u,
  (u) => "https://api.allorigins.win/raw?url=" + encodeURIComponent(u),
  (u) => "https://api.codetabs.com/v1/proxy/?quest=" + encodeURIComponent(u),
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* Some relays wrap the JSON in a text preamble or an HTML shell. */
function jparse(text) {
  if (typeof text !== "string") return text;
  const from = text.indexOf("{");
  const to = text.lastIndexOf("}");
  if (from === -1 || to <= from) throw new Error("no JSON in response");
  return JSON.parse(text.slice(from, to + 1));
}

async function getOnce(url, ms = 9000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": UA, Accept: "application/json,text/plain,*/*", Referer: "https://finance.yahoo.com/" },
    });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.text();
  } finally {
    clearTimeout(timer);
  }
}

/* Tries every direct host, then the relays, one after the other. Bounded by
   tries × urls × 12 s so a blocked provider can never eat the whole job. */
async function getAny(urls, tries = 1) {
  let last;
  for (let attempt = 0; attempt < tries; attempt++) {
    for (const url of urls) {
      try {
        return await getOnce(url);
      } catch (e) {
        last = e;
      }
    }
    if (attempt < tries - 1) await sleep(800 * (attempt + 1));
  }
  throw last || new Error("unreachable");
}

async function yahoo(symbol, cfg) {
  const q = `?interval=${cfg.interval}&range=${cfg.range}&includePrePost=false&events=div%2Csplit`;
  const path = "/v8/finance/chart/" + encodeURIComponent(symbol) + q;
  const direct = YAHOO_HOSTS.map((h) => h + path);
  const urls = direct.concat(RELAYS.map((wrap) => wrap(direct[0])));
  const body = await getAny(urls, 1);
  const json = jparse(body);
  const res = json?.chart?.result?.[0];
  if (!res || !res.timestamp) throw new Error("no result");
  return { bars: parseYahoo(res), meta: res.meta || {} };
}

function parseYahoo(res) {
  const q = res.indicators?.quote?.[0] || {};
  const out = [];
  for (let i = 0; i < res.timestamp.length; i++) {
    const o = q.open?.[i], h = q.high?.[i], l = q.low?.[i], c = q.close?.[i];
    if (![o, h, l, c].every((v) => typeof v === "number" && Number.isFinite(v))) continue;
    if (h < l) continue;
    out.push([res.timestamp[i], round(o), round(h), round(l), round(c), Math.round(q.volume?.[i] || 0)]);
  }
  return out;
}

async function binance(symbol, interval, limit) {
  let last;
  for (const host of BINANCE_HOSTS) {
    try {
      const rows = JSON.parse(await getOnce(`${host}/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`));
      if (!Array.isArray(rows)) throw new Error("not an array");
      return rows.map((k) => {
        let t = Number(k[0]);
        if (t > 1e12) t = Math.floor(t / 1000);
        return [t, round(+k[1]), round(+k[2]), round(+k[3]), round(+k[4]), Math.round(+k[5])];
      });
    } catch (e) {
      last = e;
    }
  }
  throw last || new Error("binance failed");
}

/* keep six significant digits: enough for every instrument, a third of the bytes */
function round(v) {
  if (!Number.isFinite(v)) return null;
  if (v === 0) return 0;
  const mag = Math.abs(v);
  if (mag >= 1000) return Math.round(v * 100) / 100;
  if (mag >= 10) return Math.round(v * 10000) / 10000;
  return Math.round(v * 1e6) / 1e6;
}

function aggregate(bars, factor) {
  const span = 3600 * factor;
  const out = [];
  let bucket = null;
  for (const b of bars) {
    const key = Math.floor(b[0] / span) * span;
    if (!bucket || bucket[0] !== key) {
      if (bucket) out.push(bucket);
      bucket = [key, b[1], b[2], b[3], b[4], b[5]];
    } else {
      bucket[2] = Math.max(bucket[2], b[2]);
      bucket[3] = Math.min(bucket[3], b[3]);
      bucket[4] = b[4];
      bucket[5] += b[5];
    }
  }
  if (bucket) out.push(bucket);
  return out;
}

function dedupe(bars) {
  bars.sort((a, b) => a[0] - b[0]);
  const out = [];
  for (const b of bars) {
    if (out.length && out[out.length - 1][0] === b[0]) out[out.length - 1] = b;
    else out.push(b);
  }
  return out;
}

/* ---------- one instrument ---------- */
function candidates(id) {
  return String(LIVE[id] || "")
    .split("|")
    .map((part, i, all) => {
      if (i === 0) {
        const cut = part.indexOf(":");
        return { provider: part.slice(0, cut), symbol: part.slice(cut + 1) };
      }
      const prev = all[0];
      const cut = prev.indexOf(":");
      return { provider: prev.slice(0, cut), symbol: part };
    })
    .filter((c) => c.provider && c.symbol);
}

async function buildInstrument(id) {
  const list = candidates(id);
  if (!list.length) return null;

  const doc = {
    id,
    symbol: list[0].symbol,
    provider: list[0].provider,
    fetchedAt: Date.now(),
    tf: {},
  };

  for (const c of list) {
    try {
      if (c.provider === "binance") {
        await fillBinance(doc, c);
      } else {
        await fillYahoo(doc, c);
      }
      /* keep whatever worked; only fall through to the next ticker when this
         one produced nothing at all */
      if (Object.keys(doc.tf).length) {
        doc.symbol = c.symbol;
        doc.provider = c.provider;
        break;
      }
    } catch (e) {
      doc.errors = (doc.errors || []).concat(`${c.symbol}: ${e.message}`);
    }
  }
  return Object.keys(doc.tf).length ? doc : null;
}

async function fillYahoo(doc, c) {
  const t0 = Date.now();
  for (const tf of Object.keys(YAHOO_TF)) {
    if (Date.now() - t0 > PER_INSTRUMENT * 1000) {
      doc.errors = (doc.errors || []).concat(`${c.symbol} ${tf}: skipped (time budget)`);
      continue;
    }
    const cfg = YAHOO_TF[tf];
    let res;
    try {
      res = await yahoo(c.symbol, cfg);
    } catch (e) {
      doc.errors = (doc.errors || []).concat(`${c.symbol} ${tf}: ${e.message}`);
      continue;                             /* keep the timeframes that worked */
    }
    let bars = res.bars;
    if (cfg.aggregate) bars = aggregate(bars, cfg.aggregate);
    bars = dedupe(bars).slice(-(BAR_LIMIT[tf] || 900));
    if (bars.length < 30) continue;
    doc.tf[tf] = {
      interval: tf,
      provider: "yahoo",
      symbol: c.symbol,
      fetchedAt: Date.now(),
      currency: res.meta.currency || null,
      bars,
    };
    await sleep(120);                       /* stay polite with Yahoo */
  }
  if (!Object.keys(doc.tf).length) throw new Error("no timeframes");
}

async function fillBinance(doc, c) {
  const t0 = Date.now();
  for (const tf of Object.keys(BINANCE_TF)) {
    if (Date.now() - t0 > PER_INSTRUMENT * 1000) {
      doc.errors = (doc.errors || []).concat(`${c.symbol} ${tf}: skipped (time budget)`);
      continue;
    }
    let raw;
    try {
      raw = await binance(c.symbol, BINANCE_TF[tf], BAR_LIMIT[tf] || 1000);
    } catch (e) {
      doc.errors = (doc.errors || []).concat(`${c.symbol} ${tf}: ${e.message}`);
      continue;
    }
    const bars = dedupe(raw).slice(-(BAR_LIMIT[tf] || 900));
    if (bars.length < 30) continue;
    doc.tf[tf] = {
      interval: tf,
      provider: "binance",
      symbol: c.symbol,
      fetchedAt: Date.now(),
      currency: null,
      bars,
    };
    await sleep(80);
  }
  if (!Object.keys(doc.tf).length) throw new Error("no timeframes");
}

/* ---------- run ---------- */
/* Headline instruments first: if the runner runs out of time, the two tickers
   the terminal opens by default (NAS100 and NQ futures) are always present. */
const PRIORITY = ["NAS100", "NQ", "SPX500", "US30", "GER40", "XAUUSD", "BTCUSD", "ETHUSD"];

async function main() {
  const ids = ONLY.length ? ONLY : Object.keys(LIVE).sort((a, b) => {
    const pa = PRIORITY.indexOf(a), pb = PRIORITY.indexOf(b);
    return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb);
  });
  await fs.mkdir(OUT, { recursive: true });

  const ok = [];
  const failed = [];
  const PARTIAL = {};
  let cursor = 0;

  async function worker() {
    while (cursor < ids.length) {
      if (DEADLINE && Date.now() - STARTED > DEADLINE * 1000) {
        process.stdout.write(`\n⏱ deadline reached — stopping after ${ok.length} instruments\n`);
        return;
      }
      const id = ids[cursor++];
      try {
        const doc = await buildInstrument(id);
        if (!doc) throw new Error("nothing resolved");
        await fs.writeFile(path.join(OUT, id + ".json"), JSON.stringify(doc));
        ok.push(id);
        if (doc.errors) PARTIAL[id] = doc.errors;
        process.stdout.write(`✓ ${id} ${Object.keys(doc.tf).join("/")} (${doc.symbol})\n`);
      } catch (e) {
        failed.push(id + ": " + e.message);
        process.stdout.write(`✗ ${id} ${e.message}\n`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, CONCURRENCY) }, worker));

  /* A machine-readable report travels with the site, so a failed run can be
     diagnosed from the deployment itself (runner logs are not always
     reachable from the agent that reads them). */
  const report = {
    at: new Date().toISOString(),
    node: process.version,
    deadline: DEADLINE,
    perInstrument: PER_INSTRUMENT,
    requested: ids.length,
    ok: ok.length,
    failed,
    partial: PARTIAL,
  };
  await fs.writeFile(path.join(path.dirname(OUT), "_diag.json"), JSON.stringify(report, null, 1));

  if (!ok.length) {
    console.error("No instrument could be fetched — leaving the previous snapshot untouched.");
    process.exit(1);
  }
  await fs.writeFile(
    path.join(OUT, "_index.json"),
    JSON.stringify({
      generatedAt: Date.now(),
      count: ok.length,
      truncated: DEADLINE > 0 && ids.length > ok.length + failed.length,
      failed,
      instruments: ok,
    }, null, 0)
  );
  console.log(`\n${ok.length} instruments written to ${path.relative(ROOT, OUT)}${failed.length ? `, ${failed.length} failed` : ""}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
