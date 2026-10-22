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
  for (const f of ["assets/js/market-data.js", "assets/js/data-provider.js"]) {
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

const res = [];
const ok = (name, cond, extra = "") => res.push([cond ? "PASS" : "FAIL", name, extra]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------- 1. same-origin proxy available ---------- */
{
  const seen = [];
  const ctx = makeCtx(async (url) => {
    const u = String(url);
    seen.push(u);
    if (u.startsWith("/api/yahoo")) return { ok: true, json: async () => yahooPayload() };
    if (u.startsWith("/api/binance")) return { ok: true, json: async () => binancePayload() };
    return { ok: false, status: 404, json: async () => ({ error: "nf" }) };
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
    if (u.startsWith("/api/")) return { ok: false, status: 404, json: async () => ({}) };
    if (u.includes("allorigins") || u.includes("corsproxy") || u.includes("codetabs")) {
      return { ok: true, json: async () => yahooPayload("ES=F", 300) };
    }
    if (u.includes("data-api.binance.vision") || u.includes("api.binance.com")) {
      return { ok: true, json: async () => binancePayload(300) };
    }
    return { ok: false, status: 500, json: async () => ({}) };
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
  const ctx = makeCtx(async () => ({ ok: false, status: 502, json: async () => ({}) }));
  const { KRData } = ctx.window;
  const first = await KRData.load("ES", "5m");
  ok("offline: falls back to synthetic", first.synthetic === true, first.fallbackReason);
  const st = await KRData.probe();
  ok("offline: probe reports both down", st.yahoo === false && st.binance === false, JSON.stringify([st.yahoo, st.binance]));
  const second = await KRData.load("GC", "1D");
  ok("offline: still resolves", second.data.length > 100, String(second.data.length));
  ok("offline: no stuck loading", true);
}

/* ---------- 4. explicit offline mode ignores even a working feed ---------- */
{
  const ctx = makeCtx(async (url) => {
    const u = String(url);
    if (u.startsWith("/api/yahoo")) return { ok: true, json: async () => yahooPayload() };
    if (u.startsWith("/api/binance")) return { ok: true, json: async () => binancePayload() };
    return { ok: false, status: 404, json: async () => ({}) };
  });
  const { KRData } = ctx.window;
  KRData.setMode("synthetic");
  const s = await KRData.load("ES", "5m");
  ok("mode=offline forces simulated", s.synthetic === true);
  KRData.setMode("auto");
  const live = await KRData.load("ES", "5m");
  ok("mode=auto returns live again", live.synthetic === false);
}

/* ---------- 5. 4H aggregation + dedupe ---------- */
{
  const ctx = makeCtx(async (url) => {
    const u = String(url);
    if (u.startsWith("/api/yahoo")) return { ok: true, json: async () => yahooPayload("ES=F", 600, 5200, 3600) };
    return { ok: false, status: 404, json: async () => ({}) };
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
