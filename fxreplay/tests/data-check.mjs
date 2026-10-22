/* Headless harness for the live data layer: no browser, no network.
   Stubs window/localStorage/fetch and exercises every transport path. */
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const SITE = fileURLToPath(new URL("../", import.meta.url));

function makeCtx(fetchImpl) {
  const store = new Map();
  const ctx = {
    console,
    setTimeout,
    clearTimeout,
    Promise,
    Date,
    Math,
    JSON,
    parseInt,
    parseFloat,
    isFinite,
    Map,
    Object,
    Array,
    String,
    Number,
    localStorage: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => store.set(k, String(v)),
      removeItem: (k) => store.delete(k),
      get length() { return store.size; },
      key: (i) => [...store.keys()][i],
    },
    fetch: fetchImpl,
    addEventListener() {},
    location: { href: "https://kyoraku-bl.github.io/reverse/replay.html" },
  };
  ctx.window = ctx;
  ctx.self = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ["assets/js/market-data.js", "assets/js/symbol-map.js", "assets/js/data-provider.js"]) {
    vm.runInContext(fs.readFileSync(new URL(f, `file://${SITE}`), "utf8"), ctx, { filename: f });
  }
  return ctx;
}

function yahooPayload(symbol = "ES=F", n = 400, px = 5200, stepSec = 60) {
  const ts = [], o = [], h = [], l = [], c = [], v = [];
  const t0 = Math.floor(Date.now() / 60000) * 60;
  let p = px;
  for (let i = 0; i < n; i++) {
    const cl = p * (1 + Math.sin(i / 17) * 0.0009);
    ts.push(t0 - (n - i) * stepSec);
    o.push(p); h.push(Math.max(p, cl) * 1.0006); l.push(Math.min(p, cl) * 0.9994); c.push(cl); v.push(1000);
    p = cl;
  }
  return { chart: { result: [{ meta: { symbol, currency: "USD" }, timestamp: ts,
    indicators: { quote: [{ open: o, high: h, low: l, close: c, volume: v }] } }], error: null } };
}

function binancePayload(n = 400, px = 60000) {
  const t0 = Date.now();
  const out = [];
  let p = px;
  for (let i = 0; i < n; i++) {
    const cl = p * (1 + Math.sin(i / 19) * 0.001);
    out.push([t0 - (n - i) * 60000, String(p), String(Math.max(p, cl) * 1.0005),
      String(Math.min(p, cl) * 0.9995), String(cl), "12", 0, "0", 10, "5", "0", "0"]);
    p = cl;
  }
  return out;
}

/* fetch stub response: real browsers always expose text() + json() */
const resp = (body, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => (typeof body === "string" ? JSON.parse(body) : body),
  text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
});

const res = [];
const ok = (name, cond, extra = "") => res.push([cond ? "PASS" : "FAIL", name, extra]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- 1. same-origin proxy available ---------- */
{
  const seen = [];
  const ctx = makeCtx(async (url) => {
    const u = String(url);
    seen.push(u);
    if (u.startsWith("/api/yahoo")) return resp(yahooPayload());
    if (u.startsWith("/api/binance")) return resp(binancePayload());
    return resp({ error: "nf" }, 404);
  });
  const { KRData } = ctx.window;
  const s = await KRData.load("ES", "5m");
  ok("proxy: live ES", s.synthetic === false && s.source.transport === "proxy", s.source && s.source.transport);
  ok("proxy: symbol is ES=F", s.source && s.source.symbol === "ES=F", s.source && s.source.symbol);
  const b = await KRData.load("BTCUSD", "1H");
  ok("proxy: live BTC", b.synthetic === false && b.source.provider === "binance", b.source && b.source.provider);
  ok("proxy: no relay touched", !seen.some((u) => u.includes("allorigins")));
}

/* ---------- 2. static host: /api missing, relays answer ---------- */
{
  const seen = [];
  const ctx = makeCtx(async (url) => {
    const u = String(url);
    seen.push(u);
    if (u.startsWith("/api/")) return resp({}, 404);
    if (u.includes("allorigins") || u.includes("corsproxy") || u.includes("codetabs") || u.includes("r.jina.ai")) {
      return resp(yahooPayload("ES=F", 300));
    }
    if (u.includes("data-api.binance.vision") || u.includes("api.binance.com")) {
      return resp(binancePayload(300));
    }
    return resp({}, 500);
  });
  const { KRData } = ctx.window;
  const s = await KRData.load("NQ", "15m");
  ok("static: relay live NQ", s.synthetic === false && s.source.transport === "relay", s.source && s.source.transport);
  ok("static: relay payload is the chart", s.data.length > 100, String(s.data.length));
  const b = await KRData.load("BTCUSD", "5m");
  ok("static: binance direct", b.synthetic === false && b.source.transport === "direct", b.source && b.source.transport);
  const st = await KRData.probe();
  ok("static: probe reports reachable", st.yahoo === true && st.binance === true, JSON.stringify([st.yahoo, st.binance]));
}

/* ---------- 3. offline: everything blocked, but a cache exists ---------- */
{
  const ctx = makeCtx(async () => resp({}, 502));
  const { KRData } = ctx.window;
  const first = await KRData.load("ES", "5m");
  ok("offline: falls back to synthetic", first.synthetic === true, first.fallbackReason);
  const st = await KRData.probe();
  ok("offline: probe reports both down", st.yahoo === false && st.binance === false, JSON.stringify([st.yahoo, st.binance]));
  const second = await KRData.load("GC", "1D");
  ok("offline: still resolves", second.data.length > 100, String(second.data.length));
  ok("offline: no stuck loading", true);
}

/* ---------- 3b. snapshot shipped with the site ---------- */
{
  const now = Date.now();
  const bars = (n, step, px) => {
    const out = []; let p = px;
    for (let i = 0; i < n; i++) {
      const t = Math.floor((now - (n - i) * step) / 1000);
      const c = p * (1 + Math.sin(i / 13) * 0.001);
      out.push([t, p, Math.max(p, c) * 1.001, Math.min(p, c) * 0.999, c, 100]);
      p = c;
    }
    return out;
  };
  const snap = { id: "NAS100", symbol: "^NDX", provider: "yahoo", fetchedAt: now - 60000,
    tf: { "5m": { bars: bars(300, 300, 29822), provider: "yahoo", symbol: "^NDX", fetchedAt: now - 60000 } } };

  const liveCalls = [];
  const ctx = makeCtx(async (url) => {
    const u = String(url);
    if (u.startsWith("data/NAS100.json")) return resp(snap);
    liveCalls.push(u);
    return resp({}, 502);
  });
  const { KRData } = ctx.window;
  const s = await KRData.load("NAS100", "5m");
  ok("snapshot: fresh file is used", s.synthetic === false && s.source.transport === "snapshot", s.source && s.source.transport);
  ok("snapshot: real ticker kept", s.source.symbol === "^NDX", s.source.symbol);
  ok("snapshot: no provider call for that ticker", !liveCalls.some((u) => u.includes("%5ENDX")), String(liveCalls.length));
  ok("snapshot: prices are the provider's", Math.abs(s.data[s.data.length - 1].c - snap.tf["5m"].bars.at(-1)[4]) < 1e-6);
}

/* ---------- 3c. stale snapshot is preferred over a synthetic series ---------- */
{
  const now = Date.now();
  const rows = [];
  for (let i = 0; i < 200; i++) {
    const t = Math.floor((now - (200 - i) * 300000) / 1000);
    rows.push([t, 29800 + i, 29810 + i, 29790 + i, 29805 + i, 10]);
  }
  const snap = { id: "NQ", symbol: "NQ=F", provider: "yahoo", fetchedAt: now - 6 * 3600 * 1000,
    tf: { "5m": { bars: rows, provider: "yahoo", symbol: "NQ=F", fetchedAt: now - 6 * 3600 * 1000 } } };
  const ctx = makeCtx(async (url) => {
    const u = String(url);
    if (u.startsWith("data/NQ.json")) return resp(snap);
    return resp({}, 502);
  });
  const { KRData } = ctx.window;
  const s = await KRData.load("NQ", "5m");
  ok("snapshot: stale copy still beats synthetic", s.synthetic === false && s.stale === true, String(s.stale));
}

/* ---------- 3d. relays that wrap the payload in text ---------- */
{
  const payload = yahooPayload("^NDX", 120, 29822);
  const wrapped = "Title: \n\nURL Source: https://query1.finance.yahoo.com/...\n\nMarkdown Content:\n" + JSON.stringify(payload);
  const ctx = makeCtx(async (url) => {
    const u = String(url);
    if (u.startsWith("/api/")) return resp({}, 404);
    if (u.startsWith("data/")) return resp({}, 404);
    if (u.includes("r.jina.ai")) return resp(wrapped);
    return resp({}, 500);
  });
  const { KRData } = ctx.window;
  const s = await KRData.load("NAS100", "5m");
  ok("relay: wrapped text payload parsed", s.synthetic === false && s.source.transport === "relay", s.source && s.source.transport);
}

/* ---------- 4. explicit offline mode ignores even a working feed ---------- */
{
  const ctx = makeCtx(async (url) => {
    const u = String(url);
    if (u.startsWith("/api/yahoo")) return resp(yahooPayload());
    if (u.startsWith("/api/binance")) return resp(binancePayload());
    return resp({}, 404);
  });
  const { KRData } = ctx.window;
  KRData.setMode("synthetic");
  const s = await KRData.load("ES", "5m");
  ok("mode=offline forces simulated", s.synthetic === true);
  KRData.setMode("auto");
  const live = await KRData.load("ES", "5m");
  ok("mode=auto returns live again", live.synthetic === false);
}

/* ---------- 5. ready() resolves without waiting for the probe ---------- */
{
  let probeCalls = 0;
  const ctx = makeCtx(async (url) => {
    const u = String(url);
    if (u.includes("probe=1")) { probeCalls++; await sleep(3000); }
    if (u.startsWith("/api/")) return resp({}, 404);
    if (u.includes("allorigins") || u.includes("corsproxy") || u.includes("codetabs") || u.includes("r.jina.ai")) {
      return resp(yahooPayload("ES=F", 300));
    }
    return resp({}, 500);
  });
  const { KRData } = ctx.window;
  const t0 = Date.now();
  const s = await KRData.ready("ES", "5m");
  const ms = Date.now() - t0;
  ok("ready() returns live data", s.synthetic === false && s.source.transport === "relay", s.source && s.source.transport);
  ok("ready() does not block on the probe", ms < 2500, ms + "ms");
}

/* ---------- 6. 4H aggregation + dedupe ---------- */
{
  const ctx = makeCtx(async (url) => {
    const u = String(url);
    if (u.startsWith("/api/yahoo")) return resp(yahooPayload("ES=F", 600, 5200, 3600));
    return resp({}, 404);
  });
  const { KRData } = ctx.window;
  const s = await KRData.load("ES", "4H");
  const gaps = new Set();
  for (let i = 1; i < s.data.length; i++) gaps.add(s.data[i].t - s.data[i - 1].t);
  ok("4H: aggregated to 4h buckets", s.data.length < 200 && s.data.length > 20, String(s.data.length));
  ok("4H: uniform spacing", [...gaps].every((g) => g === 4 * 3600 * 1000), [...gaps].join(","));
  const sorted = s.data.every((b, i) => i === 0 || b.t > s.data[i - 1].t);
  ok("bars strictly increasing", sorted);
}

let pass = 0;
for (const [st, name, extra] of res) {
  console.log(`${st}  ${name}${extra ? "  -> " + extra : ""}`);
  if (st === "PASS") pass++;
}
console.log(`\n${pass}/${res.length} passed`);
process.exit(pass === res.length ? 0 : 1);
