import type { Side, Trade } from "./types";

export interface Spec {
  price: number;
  tick: number;
  pv: number;
  market: Trade["market"];
  name: string;
}

export const SPECS: Record<string, Spec> = {
  NQ: { price: 20140, tick: 0.25, pv: 20, market: "futures", name: "Nasdaq 100 fut." },
  ES: { price: 5742, tick: 0.25, pv: 50, market: "futures", name: "S&P 500 fut." },
  MNQ: { price: 20140, tick: 0.25, pv: 2, market: "futures", name: "Micro Nasdaq" },
  CL: { price: 78.4, tick: 0.01, pv: 1000, market: "futures", name: "Crude oil" },
  EURUSD: { price: 1.0862, tick: 0.00001, pv: 100000, market: "forex", name: "Euro / USD" },
  GBPUSD: { price: 1.2944, tick: 0.00001, pv: 100000, market: "forex", name: "Sterling / USD" },
  BTCUSD: { price: 67420, tick: 1, pv: 1, market: "crypto", name: "Bitcoin" },
  NVDA: { price: 138.4, tick: 0.01, pv: 1, market: "stocks", name: "NVIDIA" },
  AAPL: { price: 228.1, tick: 0.01, pv: 1, market: "stocks", name: "Apple" },
  TSLA: { price: 248.6, tick: 0.01, pv: 1, market: "stocks", name: "Tesla" },
};

export const SYMBOLS = Object.keys(SPECS);

export function tradePnl(symbol: string, side: Side, qty: number, entry: number, exit: number, fees = 0) {
  const dir = side === "long" ? 1 : -1;
  const pv = SPECS[symbol]?.pv ?? 1;
  return (exit - entry) * dir * qty * pv - fees;
}

export function riskDollars(symbol: string, qty: number, entry: number, stop: number) {
  const pv = SPECS[symbol]?.pv ?? 1;
  return Math.abs(entry - stop) * qty * pv;
}

export interface Candle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(text: string) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function roundTick(price: number, tick: number) {
  return Math.round(price / tick) * tick;
}

export function makeCandles(opts: {
  seed: number;
  count: number;
  start: number;
  tick: number;
  drift?: number;
  vol?: number;
  startMs?: number;
  stepMs?: number;
}): Candle[] {
  const rand = mulberry32(opts.seed);
  const tick = opts.tick;
  const step = opts.stepMs ?? 60_000;
  let price = opts.start;
  const vol = opts.vol ?? opts.start * 0.0008;
  const drift = opts.drift ?? 0;
  const out: Candle[] = [];
  const t0 = opts.startMs ?? Date.parse("2026-06-02T13:30:00Z");
  for (let i = 0; i < opts.count; i++) {
    const shock = (rand() - 0.48) * vol * 2 + drift;
    const o = price;
    const c = Math.max(tick, o + shock);
    const wick = vol * (0.3 + rand());
    const h = Math.max(o, c) + wick * rand();
    const l = Math.min(o, c) - wick * rand();
    out.push({
      t: t0 + i * step,
      o: roundTick(o, tick),
      h: roundTick(h, tick),
      l: roundTick(Math.max(tick, l), tick),
      c: roundTick(c, tick),
      v: Math.round(80 + rand() * 1400),
    });
    price = c;
  }
  return out;
}

/** Build a tape that actually prints the trade's entry, adverse, favorable, and exit. */
export function candlesForTrade(trade: Trade, count = 72): Candle[] {
  const spec = SPECS[trade.symbol] ?? SPECS.NQ;
  const rand = mulberry32(hashSeed(trade.id + trade.symbol));
  const dir = trade.side === "long" ? 1 : -1;
  const entry = trade.entry;
  const exit = trade.exit;
  const adverse = entry - dir * (trade.mae / (trade.qty * spec.pv || 1));
  const favorable = entry + dir * (trade.mfe / (trade.qty * spec.pv || 1));
  const entryAt = 18;
  const maeAt = 28;
  const mfeAt = 46;
  const exitAt = 60;
  const anchors = [
    { i: 0, p: entry - dir * Math.abs(entry - exit) * 0.35 },
    { i: entryAt, p: entry },
    { i: maeAt, p: adverse },
    { i: mfeAt, p: favorable },
    { i: exitAt, p: exit },
    { i: count - 1, p: exit + dir * Math.abs(exit - entry) * 0.15 * (rand() - 0.3) },
  ];
  const closes: number[] = [];
  for (let i = 0; i < count; i++) {
    let a = anchors[0];
    let b = anchors[anchors.length - 1];
    for (let k = 0; k < anchors.length - 1; k++) {
      if (i >= anchors[k].i && i <= anchors[k + 1].i) {
        a = anchors[k];
        b = anchors[k + 1];
        break;
      }
    }
    const span = Math.max(1, b.i - a.i);
    const u = (i - a.i) / span;
    const noise = (rand() - 0.5) * spec.tick * (8 + rand() * 10);
    closes.push(a.p + (b.p - a.p) * u + noise);
  }
  closes[entryAt] = entry;
  closes[exitAt] = exit;
  const startMs = Date.parse(trade.openedAt) - entryAt * 60_000;
  return closes.map((c, i) => {
    const prev = i === 0 ? c : closes[i - 1];
    const o = roundTick(prev, spec.tick);
    const cc = roundTick(c, spec.tick);
    const extra = spec.tick * (1 + rand() * 4);
    return {
      t: startMs + i * 60_000,
      o,
      c: cc,
      h: roundTick(Math.max(o, cc) + extra, spec.tick),
      l: roundTick(Math.min(o, cc) - extra * rand(), spec.tick),
      v: Math.round(40 + rand() * 900),
    };
  });
}

export function sessionCandles(symbol: string, seed: number, count = 160) {
  const spec = SPECS[symbol] ?? SPECS.NQ;
  return makeCandles({
    seed,
    count,
    start: spec.price * (0.985 + (seed % 17) / 800),
    tick: spec.tick,
    vol: spec.price * 0.0011,
    drift: spec.price * 0.00002 * ((seed % 5) - 2),
    stepMs: 60_000,
    startMs: Date.parse("2024-03-12T13:30:00Z"),
  });
}

export interface Fvg {
  from: number;
  to: number;
  top: number;
  bottom: number;
  dir: "up" | "down";
}

export function detectFvg(candles: Candle[]): Fvg[] {
  const out: Fvg[] = [];
  for (let i = 2; i < candles.length; i++) {
    const a = candles[i - 2];
    const c = candles[i];
    if (c.l > a.h) {
      out.push({ from: i - 2, to: i, top: c.l, bottom: a.h, dir: "up" });
    } else if (c.h < a.l) {
      out.push({ from: i - 2, to: i, top: a.l, bottom: c.h, dir: "down" });
    }
  }
  return out.slice(-8);
}

export function ema(values: number[], len: number) {
  const k = 2 / (len + 1);
  const out: number[] = [];
  let prev = values[0] ?? 0;
  values.forEach((v, i) => {
    prev = i === 0 ? v : v * k + prev * (1 - k);
    out.push(prev);
  });
  return out;
}

export interface AutoTrade {
  side: Side;
  entryIndex: number;
  exitIndex: number;
  entry: number;
  exit: number;
  pnl: number;
  r: number;
  reason: string;
}

export function runStrategy(id: string, candles: Candle[], symbol: string): AutoTrade[] {
  const spec = SPECS[symbol] ?? SPECS.NQ;
  const qty = symbol === "MNQ" ? 2 : symbol === "NVDA" || symbol === "AAPL" || symbol === "TSLA" ? 50 : symbol === "BTCUSD" ? 0.2 : 1;
  const trades: AutoTrade[] = [];
  const push = (side: Side, entryIndex: number, exitIndex: number, entry: number, exit: number, reason: string, risk: number) => {
    const pnl = tradePnl(symbol, side, qty, entry, exit, 3.5);
    const r = risk > 0 ? pnl / risk : 0;
    trades.push({ side, entryIndex, exitIndex, entry, exit, pnl, r, reason });
  };

  if (id === "orb") {
    const n = Math.min(8, candles.length - 1);
    const hi = Math.max(...candles.slice(0, n).map((c) => c.h));
    const lo = Math.min(...candles.slice(0, n).map((c) => c.l));
    for (let i = n; i < candles.length - 1; i++) {
      if (candles[i].c > hi) {
        const entry = candles[i].c;
        const sl = lo;
        const risk = riskDollars(symbol, qty, entry, sl);
        const tp = entry + (entry - sl) * 2;
        let exitI = candles.length - 1;
        let exit = candles[exitI].c;
        for (let j = i + 1; j < candles.length; j++) {
          if (candles[j].l <= sl) {
            exitI = j;
            exit = sl;
            break;
          }
          if (candles[j].h >= tp) {
            exitI = j;
            exit = tp;
            break;
          }
        }
        push("long", i, exitI, entry, exit, "ORB break up", risk);
        break;
      }
      if (candles[i].c < lo) {
        const entry = candles[i].c;
        const sl = hi;
        const risk = riskDollars(symbol, qty, entry, sl);
        const tp = entry - (sl - entry) * 2;
        let exitI = candles.length - 1;
        let exit = candles[exitI].c;
        for (let j = i + 1; j < candles.length; j++) {
          if (candles[j].h >= sl) {
            exitI = j;
            exit = sl;
            break;
          }
          if (candles[j].l <= tp) {
            exitI = j;
            exit = tp;
            break;
          }
        }
        push("short", i, exitI, entry, exit, "ORB break down", risk);
        break;
      }
    }
    return trades;
  }

  if (id === "fvg") {
    const gaps = detectFvg(candles);
    for (const g of gaps.slice(0, 6)) {
      const i = g.to;
      if (i >= candles.length - 2) continue;
      const side: Side = g.dir === "up" ? "long" : "short";
      const entry = candles[i].c;
      const sl = g.dir === "up" ? g.bottom : g.top;
      const riskPts = Math.abs(entry - sl) || spec.tick * 4;
      const tp = side === "long" ? entry + riskPts * 2 : entry - riskPts * 2;
      let exitI = Math.min(candles.length - 1, i + 24);
      let exit = candles[exitI].c;
      for (let j = i + 1; j < Math.min(candles.length, i + 30); j++) {
        if (side === "long" && candles[j].l <= sl) {
          exitI = j;
          exit = sl;
          break;
        }
        if (side === "short" && candles[j].h >= sl) {
          exitI = j;
          exit = sl;
          break;
        }
        if (side === "long" && candles[j].h >= tp) {
          exitI = j;
          exit = tp;
          break;
        }
        if (side === "short" && candles[j].l <= tp) {
          exitI = j;
          exit = tp;
          break;
        }
      }
      push(side, i, exitI, entry, exit, g.dir === "up" ? "Bullish FVG" : "Bearish FVG", riskDollars(symbol, qty, entry, sl));
    }
    return trades;
  }

  if (id === "trend") {
    const closes = candles.map((c) => c.c);
    const fast = ema(closes, 12);
    const slow = ema(closes, 32);
    let open: { side: Side; i: number; entry: number; sl: number } | null = null;
    for (let i = 33; i < candles.length; i++) {
      const crossUp = fast[i - 1] <= slow[i - 1] && fast[i] > slow[i];
      const crossDn = fast[i - 1] >= slow[i - 1] && fast[i] < slow[i];
      if (!open && (crossUp || crossDn)) {
        const side: Side = crossUp ? "long" : "short";
        const entry = candles[i].c;
        const sl = side === "long" ? Math.min(...candles.slice(i - 6, i + 1).map((c) => c.l)) : Math.max(...candles.slice(i - 6, i + 1).map((c) => c.h));
        open = { side, i, entry, sl };
      } else if (open) {
        const hitSl = open.side === "long" ? candles[i].l <= open.sl : candles[i].h >= open.sl;
        const opposite = open.side === "long" ? crossDn : crossUp;
        if (hitSl || opposite || i === candles.length - 1) {
          const exit = hitSl ? open.sl : candles[i].c;
          push(open.side, open.i, i, open.entry, exit, "EMA cross", riskDollars(symbol, qty, open.entry, open.sl));
          open = null;
        }
      }
    }
    return trades;
  }

  // mean reversion
  for (let i = 20; i < candles.length - 1; i++) {
    const window = candles.slice(i - 20, i).map((c) => c.c);
    const mean = window.reduce((s, v) => s + v, 0) / window.length;
    const variance = window.reduce((s, v) => s + (v - mean) ** 2, 0) / window.length;
    const sd = Math.sqrt(variance);
    if (candles[i].c < mean - sd * 1.6) {
      const entry = candles[i].c;
      const sl = entry - sd;
      const tp = mean;
      let exitI = Math.min(candles.length - 1, i + 18);
      let exit = candles[exitI].c;
      for (let j = i + 1; j < Math.min(candles.length, i + 20); j++) {
        if (candles[j].l <= sl) {
          exitI = j;
          exit = sl;
          break;
        }
        if (candles[j].h >= tp) {
          exitI = j;
          exit = tp;
          break;
        }
      }
      push("long", i, exitI, entry, exit, "Fade lower band", riskDollars(symbol, qty, entry, sl));
      i += 8;
    }
  }
  return trades;
}

export const STRATEGY_TEMPLATES = [
  { id: "orb", name: "Opening range breakout", blurb: "First 8 bars define the range. First close outside is the entry, other side is the stop, 2R target." },
  { id: "fvg", name: "ICT fair value gap", blurb: "Three-candle imbalance. Enter on the gap print, stop beyond the gap, 2R or 30-bar time stop." },
  { id: "trend", name: "Trend following", blurb: "12/32 EMA cross. Stop beyond the recent swing. Exit on the opposite cross or the stop." },
  { id: "mean", name: "Mean reversion", blurb: "Fade a 1.6 standard-deviation stretch back to the 20-bar mean." },
];
