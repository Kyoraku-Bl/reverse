import { ACCOUNTS, PLAYBOOKS } from "./content";
import { etDate, etHour, holdLabel } from "./format";
import type { Account, AccountId, Trade } from "./types";

export interface GroupStat {
  key: string;
  label: string;
  count: number;
  wins: number;
  net: number;
  winRate: number;
  avgR: number;
  profitFactor: number;
  expectancy: number;
}

export interface DayStat {
  date: string;
  pnl: number;
  trades: number;
  wins: number;
  r: number;
  fees: number;
}

export interface Stats {
  trades: Trade[];
  count: number;
  wins: number;
  losses: number;
  breakeven: number;
  net: number;
  grossProfit: number;
  grossLoss: number;
  fees: number;
  winRate: number;
  avgWin: number;
  avgLoss: number;
  avgWinLoss: number;
  profitFactor: number;
  expectancy: number;
  expectancyR: number;
  avgR: number;
  largestWin: number;
  largestLoss: number;
  maxDrawdown: number;
  maxDrawdownPct: number;
  recoveryFactor: number;
  avgHoldMin: number;
  tradingDays: number;
  greenDays: number;
  redDays: number;
  greenDayRate: number;
  avgTradesPerDay: number;
  dayStreak: { type: "win" | "loss" | "flat"; count: number };
  tradeStreak: { type: "win" | "loss" | "flat"; count: number };
  bestDayStreak: number;
  worstDayStreak: number;
  avgMae: number;
  avgMfe: number;
  exitEfficiency: number;
  leftOnTable: number;
  folioScore: number;
  scoreParts: { label: string; value: number }[];
  sharpe: number;
  bySymbol: GroupStat[];
  byPlaybook: GroupStat[];
  byHour: GroupStat[];
  byWeekday: GroupStat[];
  byEmotion: GroupStat[];
  byMistake: GroupStat[];
  bySession: GroupStat[];
  bySide: GroupStat[];
  byAccount: GroupStat[];
  byDuration: GroupStat[];
  byTag: GroupStat[];
  daily: DayStat[];
  equity: { date: string; equity: number; pnl: number }[];
  drawdownSeries: { date: string; dd: number }[];
  rDistribution: { bucket: string; count: number; net: number }[];
  monthly: { month: string; pnl: number; trades: number; winRate: number }[];
  tilt: { count: number; pnl: number; winRate: number };
  revenge: { count: number; pnl: number; winRate: number };
  afterWin: { count: number; winRate: number; pnl: number };
  afterLoss: { count: number; winRate: number; pnl: number };
  reviewedRate: number;
  avgRating: number;
  adherence: number;
  longNet: number;
  shortNet: number;
  longWin: number;
  shortWin: number;
  bestHour?: GroupStat;
  worstHour?: GroupStat;
  bestPlaybook?: GroupStat;
  worstPlaybook?: GroupStat;
  base: number;
  avgRisk: number;
}

function holdMin(t: Trade) {
  return Math.max(1, (Date.parse(t.closedAt) - Date.parse(t.openedAt)) / 60000);
}

function group(trades: Trade[], keyFn: (t: Trade) => string, labelFn?: (k: string) => string): GroupStat[] {
  const map = new Map<string, Trade[]>();
  for (const t of trades) {
    const k = keyFn(t);
    const arr = map.get(k) ?? [];
    arr.push(t);
    map.set(k, arr);
  }
  const rows: GroupStat[] = [];
  for (const [key, list] of map) {
    const wins = list.filter((t) => t.pnl > 0);
    const losses = list.filter((t) => t.pnl < 0);
    const gp = wins.reduce((s, t) => s + t.pnl, 0);
    const gl = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
    const net = list.reduce((s, t) => s + t.pnl, 0);
    const avgR = list.reduce((s, t) => s + t.rMultiple, 0) / list.length;
    rows.push({
      key,
      label: labelFn ? labelFn(key) : key,
      count: list.length,
      wins: wins.length,
      net,
      winRate: list.length ? wins.length / list.length : 0,
      avgR,
      profitFactor: gl === 0 ? (gp > 0 ? 99 : 0) : gp / gl,
      expectancy: list.length ? net / list.length : 0,
    });
  }
  return rows.sort((a, b) => b.net - a.net);
}

function clamp(n: number, a = 0, b = 100) {
  return Math.max(a, Math.min(b, n));
}

export function computeStats(tradesIn: Trade[], base = 100000, accounts: Account[] = ACCOUNTS): Stats {
  const trades = [...tradesIn].sort((a, b) => a.openedAt.localeCompare(b.openedAt));
  const wins = trades.filter((t) => t.pnl > 1);
  const losses = trades.filter((t) => t.pnl < -1);
  const breakeven = trades.length - wins.length - losses.length;
  const net = trades.reduce((s, t) => s + t.pnl, 0);
  const grossProfit = wins.reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pnl, 0));
  const fees = trades.reduce((s, t) => s + t.fees, 0);
  const avgWin = wins.length ? grossProfit / wins.length : 0;
  const avgLoss = losses.length ? grossLoss / losses.length : 0;
  const avgR = trades.length ? trades.reduce((s, t) => s + t.rMultiple, 0) / trades.length : 0;

  const dayMap = new Map<string, DayStat>();
  for (const t of trades) {
    const date = etDate(t.openedAt);
    const d = dayMap.get(date) ?? { date, pnl: 0, trades: 0, wins: 0, r: 0, fees: 0 };
    d.pnl += t.pnl;
    d.trades += 1;
    d.wins += t.pnl > 0 ? 1 : 0;
    d.r += t.rMultiple;
    d.fees += t.fees;
    dayMap.set(date, d);
  }
  const daily = [...dayMap.values()].sort((a, b) => a.date.localeCompare(b.date));
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  const equitySeries: Stats["equity"] = [];
  const drawdownSeries: Stats["drawdownSeries"] = [];
  for (const d of daily) {
    equity += d.pnl;
    peak = Math.max(peak, equity);
    const dd = peak - equity;
    maxDd = Math.max(maxDd, dd);
    equitySeries.push({ date: d.date, equity, pnl: d.pnl });
    drawdownSeries.push({ date: d.date, dd: -dd });
  }

  const greenDays = daily.filter((d) => d.pnl > 1).length;
  const redDays = daily.filter((d) => d.pnl < -1).length;

  function streakFrom(values: number[]): { type: "win" | "loss" | "flat"; count: number } {
    if (!values.length) return { type: "flat", count: 0 };
    const last = values[values.length - 1];
    const type: "win" | "loss" | "flat" = last > 1 ? "win" : last < -1 ? "loss" : "flat";
    let count = 0;
    for (let i = values.length - 1; i >= 0; i--) {
      const v = values[i];
      const t = v > 1 ? "win" : v < -1 ? "loss" : "flat";
      if (t !== type || type === "flat") break;
      count++;
    }
    return { type, count };
  }

  function extremeStreak(values: number[], want: "win" | "loss") {
    let best = 0;
    let cur = 0;
    for (const v of values) {
      const ok = want === "win" ? v > 1 : v < -1;
      cur = ok ? cur + 1 : 0;
      best = Math.max(best, cur);
    }
    return best;
  }

  const dayStreak = streakFrom(daily.map((d) => d.pnl));
  const tradeStreak = streakFrom(trades.map((t) => t.pnl));

  const avgMae = trades.length ? trades.reduce((s, t) => s + t.mae, 0) / trades.length : 0;
  const avgMfe = trades.length ? trades.reduce((s, t) => s + t.mfe, 0) / trades.length : 0;
  const favorable = trades.filter((t) => t.mfe > 1);
  const exitEfficiency = favorable.length ? favorable.reduce((s, t) => s + Math.max(0, t.pnl) / t.mfe, 0) / favorable.length : 0;
  const leftOnTable = trades.reduce((s, t) => s + Math.max(0, t.mfe - Math.max(0, t.pnl)), 0);

  const winRate = trades.length ? wins.length / trades.length : 0;
  const profitFactor = grossLoss === 0 ? (grossProfit > 0 ? 99 : 0) : grossProfit / grossLoss;
  const avgWinLoss = avgLoss === 0 ? (avgWin > 0 ? 99 : 0) : avgWin / avgLoss;
  const greenDayRate = daily.length ? greenDays / daily.length : 0;
  const recoveryFactor = maxDd > 0 ? net / maxDd : net > 0 ? 5 : 0;

  const scoreParts = [
    { label: "Win %", value: clamp(((winRate - 0.35) / 0.3) * 100) },
    { label: "Profit factor", value: clamp(((Math.min(profitFactor, 3) - 0.8) / 1.8) * 100) },
    { label: "Avg win/loss", value: clamp(((Math.min(avgWinLoss, 3) - 0.7) / 1.8) * 100) },
    { label: "Max drawdown", value: clamp(100 - (maxDd / Math.max(base * 0.08, 1)) * 100) },
    { label: "Consistency", value: clamp(((greenDayRate - 0.3) / 0.45) * 100) },
    { label: "Recovery factor", value: clamp((Math.min(recoveryFactor, 4) / 4) * 100) },
  ];
  const folioScore = scoreParts.reduce((s, p) => s + p.value, 0) / scoreParts.length;

  const dailyReturns = daily.map((d) => d.pnl);
  const mean = dailyReturns.length ? dailyReturns.reduce((s, v) => s + v, 0) / dailyReturns.length : 0;
  const variance = dailyReturns.length ? dailyReturns.reduce((s, v) => s + (v - mean) ** 2, 0) / dailyReturns.length : 0;
  const sharpe = variance > 0 ? (mean / Math.sqrt(variance)) * Math.sqrt(252) : 0;

  const hours = group(trades, (t) => String(etHour(t.openedAt)).padStart(2, "0"), (k) => `${Number(k)}:00`);
  const playbooks = group(trades, (t) => t.playbookId, (k) => PLAYBOOKS.find((p) => p.id === k)?.name ?? k);
  const hourSorted = [...hours].sort((a, b) => b.expectancy - a.expectancy);
  const pbSorted = [...playbooks].filter((p) => p.count >= 3).sort((a, b) => b.expectancy - a.expectancy);

  const revengeTrades = trades.filter((t) => t.mistakes.includes("revenge") || t.emotion === "tilt");
  const tiltTrades = trades.filter((t) => t.emotion === "tilt" || t.emotion === "fomo");

  let afterWinN = 0, afterWinW = 0, afterWinP = 0, afterLossN = 0, afterLossW = 0, afterLossP = 0;
  for (let i = 1; i < trades.length; i++) {
    const prev = trades[i - 1];
    const cur = trades[i];
    if (etDate(prev.openedAt) !== etDate(cur.openedAt)) continue;
    if (prev.pnl > 0) {
      afterWinN++;
      afterWinP += cur.pnl;
      if (cur.pnl > 0) afterWinW++;
    } else if (prev.pnl < 0) {
      afterLossN++;
      afterLossP += cur.pnl;
      if (cur.pnl > 0) afterLossW++;
    }
  }

  const buckets = [
    { bucket: "< -1R", min: -99, max: -1, count: 0, net: 0 },
    { bucket: "-1R to 0", min: -1, max: 0, count: 0, net: 0 },
    { bucket: "0 to 1R", min: 0, max: 1, count: 0, net: 0 },
    { bucket: "1R to 2R", min: 1, max: 2, count: 0, net: 0 },
    { bucket: "2R+", min: 2, max: 99, count: 0, net: 0 },
  ];
  for (const t of trades) {
    const b = buckets.find((x) => t.rMultiple >= x.min && t.rMultiple < x.max) ?? buckets[buckets.length - 1];
    b.count++;
    b.net += t.pnl;
  }

  const monthMap = new Map<string, Trade[]>();
  for (const t of trades) {
    const m = etDate(t.openedAt).slice(0, 7);
    const arr = monthMap.get(m) ?? [];
    arr.push(t);
    monthMap.set(m, arr);
  }
  const monthly = [...monthMap.entries()].sort().map(([month, list]) => ({
    month,
    pnl: list.reduce((s, t) => s + t.pnl, 0),
    trades: list.length,
    winRate: list.filter((t) => t.pnl > 0).length / list.length,
  }));

  const duration = group(
    trades,
    (t) => {
      const m = holdMin(t);
      if (m < 10) return "Under 10m";
      if (m < 30) return "10–30m";
      if (m < 60) return "30–60m";
      if (m < 180) return "1–3h";
      return "3h+";
    },
  );

  const avgRisk = trades.length ? trades.reduce((s, t) => s + (Math.abs(t.pnl) > 0 && Math.abs(t.rMultiple) > 0.05 ? Math.abs(t.pnl / t.rMultiple) : 200), 0) / trades.length : 250;

  return {
    trades,
    count: trades.length,
    wins: wins.length,
    losses: losses.length,
    breakeven,
    net,
    grossProfit,
    grossLoss,
    fees,
    winRate,
    avgWin,
    avgLoss,
    avgWinLoss,
    profitFactor,
    expectancy: trades.length ? net / trades.length : 0,
    expectancyR: avgR,
    avgR,
    largestWin: wins.reduce((m, t) => Math.max(m, t.pnl), 0),
    largestLoss: losses.reduce((m, t) => Math.min(m, t.pnl), 0),
    maxDrawdown: maxDd,
    maxDrawdownPct: base ? maxDd / base : 0,
    recoveryFactor,
    avgHoldMin: trades.length ? trades.reduce((s, t) => s + holdMin(t), 0) / trades.length : 0,
    tradingDays: daily.length,
    greenDays,
    redDays,
    greenDayRate,
    avgTradesPerDay: daily.length ? trades.length / daily.length : 0,
    dayStreak,
    tradeStreak,
    bestDayStreak: extremeStreak(daily.map((d) => d.pnl), "win"),
    worstDayStreak: extremeStreak(daily.map((d) => d.pnl), "loss"),
    avgMae,
    avgMfe,
    exitEfficiency,
    leftOnTable,
    folioScore,
    scoreParts,
    sharpe,
    bySymbol: group(trades, (t) => t.symbol),
    byPlaybook: playbooks,
    byHour: hours.sort((a, b) => a.key.localeCompare(b.key)),
    byWeekday: group(trades, (t) => etDate(t.openedAt), () => "").length
      ? group(
          trades,
          (t) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][new Date(etDate(t.openedAt) + "T12:00:00Z").getUTCDay()],
        )
      : [],
    byEmotion: group(trades, (t) => t.emotion),
    byMistake: group(
      trades.flatMap((t) => (t.mistakes.length ? t.mistakes.map((m) => ({ ...t, mistakes: [m], pnl: t.pnl })) : [])),
      (t) => t.mistakes[0] || "none",
    ),
    bySession: group(trades, (t) => t.session),
    bySide: group(trades, (t) => t.side),
    byAccount: group(trades, (t) => t.accountId, (k) => accounts.find((a) => a.id === k)?.name ?? k),
    byDuration: duration,
    byTag: group(
      trades.flatMap((t) => t.tags.map((tag) => ({ ...t, id: t.id + tag, tags: [tag] }))),
      (t) => t.tags[0],
    ).slice(0, 12),
    daily,
    equity: equitySeries,
    drawdownSeries,
    rDistribution: buckets,
    monthly,
    tilt: {
      count: tiltTrades.length,
      pnl: tiltTrades.reduce((s, t) => s + t.pnl, 0),
      winRate: tiltTrades.length ? tiltTrades.filter((t) => t.pnl > 0).length / tiltTrades.length : 0,
    },
    revenge: {
      count: revengeTrades.length,
      pnl: revengeTrades.reduce((s, t) => s + t.pnl, 0),
      winRate: revengeTrades.length ? revengeTrades.filter((t) => t.pnl > 0).length / revengeTrades.length : 0,
    },
    afterWin: { count: afterWinN, winRate: afterWinN ? afterWinW / afterWinN : 0, pnl: afterWinP },
    afterLoss: { count: afterLossN, winRate: afterLossN ? afterLossW / afterLossN : 0, pnl: afterLossP },
    reviewedRate: trades.length ? trades.filter((t) => t.reviewed).length / trades.length : 0,
    avgRating: trades.length ? trades.reduce((s, t) => s + t.rating, 0) / trades.length : 0,
    adherence: trades.length ? trades.reduce((s, t) => s + t.rulesHit / t.rulesTotal, 0) / trades.length : 0,
    longNet: trades.filter((t) => t.side === "long").reduce((s, t) => s + t.pnl, 0),
    shortNet: trades.filter((t) => t.side === "short").reduce((s, t) => s + t.pnl, 0),
    longWin: (() => {
      const l = trades.filter((t) => t.side === "long");
      return l.length ? l.filter((t) => t.pnl > 0).length / l.length : 0;
    })(),
    shortWin: (() => {
      const l = trades.filter((t) => t.side === "short");
      return l.length ? l.filter((t) => t.pnl > 0).length / l.length : 0;
    })(),
    bestHour: hourSorted[0],
    worstHour: hourSorted[hourSorted.length - 1],
    bestPlaybook: pbSorted[0],
    worstPlaybook: pbSorted[pbSorted.length - 1],
    base,
    avgRisk,
  };
}

export function accountBase(ids: Array<"all" | AccountId>, accounts: Account[] = ACCOUNTS) {
  if (ids.includes("all") || ids.length === 0) return accounts.reduce((s, a) => s + a.balance0, 0);
  return accounts.filter((a) => ids.includes(a.id)).reduce((s, a) => s + a.balance0, 0);
}

export interface PropSnapshot {
  accountId: AccountId;
  name: string;
  firm: string;
  net: number;
  equity: number;
  target: number;
  progress: number;
  worstDay: number;
  bestDay: number;
  maxDd: number;
  trailRoom: number;
  dailyRoom: number;
  dailyLimit: number;
  lossLimit: number;
  todayPnl: number;
  tradingDays: number;
  minDays: number;
  consistency: number;
  consistencyOk: boolean;
  breachedDaily: boolean;
  breachedMax: boolean;
  daysToTarget: number;
  pass: number;
  warnings: string[];
  note: string;
}

export function propSnapshots(trades: Trade[], accounts: Account[] = ACCOUNTS): PropSnapshot[] {
  return accounts.filter((a) => a.rules).map((a) => {
    const rules = a.rules!;
    const list = trades.filter((t) => t.accountId === a.id).sort((x, y) => x.openedAt.localeCompare(y.openedAt));
    const days = new Map<string, number>();
    let equity = a.balance0;
    let peak = a.balance0;
    let maxDd = 0;
    let breachedMax = false;
    for (const t of list) {
      const d = etDate(t.openedAt);
      days.set(d, (days.get(d) ?? 0) + t.pnl);
      equity += t.pnl;
      peak = Math.max(peak, equity);
      const dd = rules.trailing ? peak - equity : a.balance0 - Math.min(a.balance0, equity);
      const used = rules.trailing ? peak - equity : a.balance0 - equity;
      maxDd = Math.max(maxDd, Math.max(0, used));
      if (used >= rules.maxLoss - 0.01) breachedMax = true;
    }
    const dayVals = [...days.values()];
    const net = list.reduce((s, t) => s + t.pnl, 0);
    const bestDay = dayVals.reduce((m, v) => Math.max(m, v), 0);
    const worstDay = dayVals.reduce((m, v) => Math.min(m, v), 0);
    const todayPnl = days.get("2026-10-22") ?? 0;
    const breachedDaily = dayVals.some((v) => v <= -rules.dailyLoss + 0.01);
    const consistency = net > 0 ? bestDay / net : 0;
    const consistencyOk = !rules.consistency || net <= 0 || consistency <= rules.consistency + 0.001;
    const remaining = Math.max(0, rules.profitTarget - net);
    const avg = dayVals.length ? net / dayVals.length : 0;
    const daysToTarget = avg > 0 ? remaining / avg : Infinity;
    let pass = 0.42 + Math.max(0, net) / rules.profitTarget * 0.4;
    if (breachedDaily || breachedMax) pass = 0.06;
    if (!consistencyOk) pass -= 0.18;
    if (maxDd > rules.maxLoss * 0.72) pass -= 0.12;
    if (dayVals.length < rules.minDays) pass -= 0.05;
    pass = clamp(pass * 100, 4, 93) / 100;
    const trailRoom = rules.maxLoss - maxDd;
    const dailyRoom = rules.dailyLoss + Math.min(0, todayPnl);
    const warnings: string[] = [];
    if (breachedMax) warnings.push("Max loss is already breached on this book. The evaluation would be over.");
    if (breachedDaily) warnings.push("A session already tagged the daily loss limit.");
    if (!consistencyOk) warnings.push(`Best day is ${(consistency * 100).toFixed(0)}% of total profit. Cap is ${(rules.consistency! * 100).toFixed(0)}%.`);
    if (trailRoom < rules.maxLoss * 0.35) warnings.push(`Only ${trailRoom.toFixed(0)} of room left under the ${rules.trailing ? "trailing" : "max"} loss.`);
    if (dailyRoom < rules.dailyLoss * 0.4) warnings.push("Daily loss room is thin. Next trade is not the same trade.");
    if (net >= rules.profitTarget && consistencyOk && !breachedDaily && !breachedMax) warnings.push("Target reached without a rule break. Confirm minimum days before you request a pass.");
    if (!warnings.length) warnings.push("No rule is close to breaking. Keep size boring.");
    return {
      accountId: a.id,
      name: a.name,
      firm: a.firm ?? a.broker,
      net,
      equity,
      target: rules.profitTarget,
      progress: net / rules.profitTarget,
      worstDay,
      bestDay,
      maxDd,
      trailRoom,
      dailyRoom,
      dailyLimit: rules.dailyLoss,
      lossLimit: rules.maxLoss,
      todayPnl,
      tradingDays: days.size,
      minDays: rules.minDays,
      consistency,
      consistencyOk,
      breachedDaily,
      breachedMax,
      daysToTarget,
      pass,
      warnings,
      note: rules.note,
    };
  });
}

export interface MetricCard {
  id: string;
  group: string;
  label: string;
  value: string;
  hint: string;
  tone: "good" | "bad" | "neutral";
}

export function metricCards(s: Stats): MetricCard[] {
  const m = (id: string, group: string, label: string, value: string, hint: string, tone: MetricCard["tone"] = "neutral"): MetricCard => ({ id, group, label, value, hint, tone });
  const good = (n: number) => (n > 0 ? "good" : n < 0 ? "bad" : "neutral");
  return [
    m("net", "Performance", "Net P&L", moneyish(s.net), "Closed-trade profit after fees", good(s.net)),
    m("gross-win", "Performance", "Gross profit", moneyish(s.grossProfit), "Sum of winning trades", "good"),
    m("gross-loss", "Performance", "Gross loss", moneyish(-s.grossLoss), "Sum of losing trades", "bad"),
    m("fees", "Performance", "Fees", moneyish(-s.fees), "Commissions and exchange fees", "bad"),
    m("winrate", "Performance", "Win rate", pct(s.winRate), `${s.wins} wins · ${s.losses} losses · ${s.breakeven} flat`),
    m("pf", "Performance", "Profit factor", s.profitFactor.toFixed(2), "Gross profit divided by gross loss", s.profitFactor >= 1.3 ? "good" : "bad"),
    m("exp", "Performance", "Expectancy", moneyish(s.expectancy), "Average dollars per trade", good(s.expectancy)),
    m("expr", "Performance", "Expectancy (R)", `${s.expectancyR.toFixed(2)}R`, "Average R per trade", good(s.expectancyR)),
    m("avgr", "Performance", "Average R", `${s.avgR.toFixed(2)}R`, "Mean realized R-multiple", good(s.avgR)),
    m("avgwin", "Performance", "Average win", moneyish(s.avgWin), "Mean winning trade", "good"),
    m("avgloss", "Performance", "Average loss", moneyish(-s.avgLoss), "Mean losing trade", "bad"),
    m("wl", "Performance", "Avg win / avg loss", s.avgWinLoss.toFixed(2), "Needs to clear 1.0 if win rate is under 50%", s.avgWinLoss >= 1.2 ? "good" : "neutral"),
    m("largew", "Performance", "Largest win", moneyish(s.largestWin), "Best single fill", "good"),
    m("largel", "Performance", "Largest loss", moneyish(s.largestLoss), "Worst single fill", "bad"),
    m("dd", "Risk", "Max drawdown", moneyish(-s.maxDrawdown), "Peak-to-trough on the closed equity curve", "bad"),
    m("ddp", "Risk", "Max drawdown %", pct(s.maxDrawdownPct), "Drawdown versus starting balances in the filter", "bad"),
    m("recovery", "Risk", "Recovery factor", s.recoveryFactor.toFixed(2), "Net profit divided by max drawdown", s.recoveryFactor > 2 ? "good" : "neutral"),
    m("sharpe", "Risk", "Daily Sharpe (ann.)", s.sharpe.toFixed(2), "Mean daily P&L over its volatility, annualized", s.sharpe > 1 ? "good" : "neutral"),
    m("mae", "Risk", "Average MAE", moneyish(-s.avgMae), "How far trades went against you", "bad"),
    m("mfe", "Risk", "Average MFE", moneyish(s.avgMfe), "How far trades went for you", "good"),
    m("exit", "Risk", "Exit efficiency", pct(s.exitEfficiency), "Realized profit as a share of favorable excursion", s.exitEfficiency > 0.45 ? "good" : "bad"),
    m("left", "Risk", "Left on table", moneyish(s.leftOnTable), "Favorable excursion you did not bank", "neutral"),
    m("score", "Performance", "Folio Score", s.folioScore.toFixed(1), "Win rate, profit factor, payoff, drawdown, consistency, recovery", s.folioScore > 60 ? "good" : "neutral"),
    m("count", "Activity", "Trades", String(s.count), "Closed trades in the filter"),
    m("days", "Activity", "Trading days", String(s.tradingDays), "Sessions with at least one fill"),
    m("tpd", "Activity", "Trades / day", s.avgTradesPerDay.toFixed(2), "Activity level. More is not better."),
    m("hold", "Activity", "Avg hold", holdLabel(s.avgHoldMin), "Average time in the position"),
    m("green", "Activity", "Green days", pct(s.greenDayRate), `${s.greenDays} green · ${s.redDays} red`),
    m("dstreak", "Activity", "Day streak", `${s.dayStreak.count} ${s.dayStreak.type}`, `Best green streak ${s.bestDayStreak}`),
    m("tstreak", "Activity", "Trade streak", `${s.tradeStreak.count} ${s.tradeStreak.type}`, "Current run of wins or losses"),
    m("beststreak", "Activity", "Best day streak", String(s.bestDayStreak), "Longest run of green days"),
    m("worststreak", "Activity", "Worst day streak", String(s.worstDayStreak), "Longest run of red days", "bad"),
    m("reviewed", "Behavior", "Reviewed", pct(s.reviewedRate), "Trades marked reviewed"),
    m("rating", "Behavior", "Avg rating", `${s.avgRating.toFixed(1)} / 5`, "Your own execution grade"),
    m("adhere", "Behavior", "Rule adherence", pct(s.adherence), "Playbook rules hit, averaged across fills", s.adherence > 0.8 ? "good" : "bad"),
    m("tilt", "Behavior", "Tilt & FOMO P&L", moneyish(s.tilt.pnl), `${s.tilt.count} trades · ${pct(s.tilt.winRate)} win rate`, good(s.tilt.pnl)),
    m("revenge", "Behavior", "Revenge P&L", moneyish(s.revenge.pnl), `${s.revenge.count} trades taken on tilt or right after a loss`, good(s.revenge.pnl)),
    m("afterw", "Behavior", "After a winner", pct(s.afterWin.winRate), `${s.afterWin.count} next trades · ${moneyish(s.afterWin.pnl)}`),
    m("afterl", "Behavior", "After a loser", pct(s.afterLoss.winRate), `${s.afterLoss.count} next trades · ${moneyish(s.afterLoss.pnl)}`, good(s.afterLoss.pnl)),
    m("long", "Side", "Long P&L", moneyish(s.longNet), `Win rate ${pct(s.longWin)}`, good(s.longNet)),
    m("short", "Side", "Short P&L", moneyish(s.shortNet), `Win rate ${pct(s.shortWin)}`, good(s.shortNet)),
    m("besth", "Time", "Best hour", s.bestHour ? s.bestHour.label : "—", s.bestHour ? `${moneyish(s.bestHour.net)} · ${pct(s.bestHour.winRate)}` : "", "good"),
    m("worsth", "Time", "Worst hour", s.worstHour ? s.worstHour.label : "—", s.worstHour ? `${moneyish(s.worstHour.net)} · ${s.worstHour.count} trades` : "", "bad"),
    m("bestp", "Strategy", "Best playbook", s.bestPlaybook?.label ?? "—", s.bestPlaybook ? `${s.bestPlaybook.avgR.toFixed(2)}R expectancy` : "", "good"),
    m("worstp", "Strategy", "Worst playbook", s.worstPlaybook?.label ?? "—", s.worstPlaybook ? `${s.worstPlaybook.avgR.toFixed(2)}R expectancy` : "", "bad"),
    m("fees-share", "Risk", "Fees vs gross", pct(s.grossProfit ? s.fees / s.grossProfit : 0), "Commissions as a share of gross profit"),
    m("profit-day", "Performance", "Profit / day", moneyish(s.tradingDays ? s.net / s.tradingDays : 0), "Net divided by active sessions", good(s.net)),
    m("be-rate", "Performance", "Breakeven rate", pct(s.count ? s.breakeven / s.count : 0), "Fills inside a dollar of flat"),
    m("avg-risk", "Risk", "Avg planned risk", moneyish(s.avgRisk), "Approximate 1R in dollars"),
  ];
}

function moneyish(n: number) {
  const sign = n < 0 ? "-" : "";
  return `${sign}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
function pct(n: number) {
  return `${(n * 100).toFixed(1)}%`;
}

export function dayAdherence(trades: Trade[], date: string) {
  const list = trades.filter((t) => etDate(t.openedAt) === date);
  const rules = [
    { id: "count", label: "Four trades or fewer", pass: list.length > 0 && list.length <= 4, detail: list.length ? `${list.length} trades` : "No trades" },
    { id: "aplus", label: "No benched setup (News Fade)", pass: list.every((t) => t.playbookId !== "news-fade"), detail: list.some((t) => t.playbookId === "news-fade") ? "News Fade was taken" : "Clear" },
    { id: "revenge", label: "No revenge click", pass: list.every((t) => !t.mistakes.includes("revenge") && t.emotion !== "tilt"), detail: "Tilt or a click inside 15 minutes of a loss" },
    { id: "notes", label: "Every trade has a note", pass: list.length > 0 && list.every((t) => t.notes.trim().length > 3), detail: "Notes are the part the broker cannot sync" },
    { id: "emotion", label: "No FOMO tag", pass: list.every((t) => t.emotion !== "fomo"), detail: "FOMO-tagged fills" },
    { id: "loss", label: "Daily loss inside $800", pass: list.reduce((s, t) => s + t.pnl, 0) > -800, detail: "Personal circuit breaker" },
    { id: "stop", label: "Stop was defined", pass: list.every((t) => Math.abs(t.stop - t.entry) > 0), detail: "Every fill has a stop price" },
    { id: "review", label: "Session marked reviewed", pass: list.length > 0 && list.every((t) => t.reviewed), detail: "Review toggle on each trade" },
  ];
  const passed = rules.filter((r) => r.pass).length;
  return { rules, score: rules.length ? passed / rules.length : 0, passed };
}

export { holdMin };
