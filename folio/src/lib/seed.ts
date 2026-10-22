import { ACCOUNTS, AGENTS, EMOTIONS, MISTAKES, PLAYBOOKS, SPACES } from "./content";
import type { AppState, ChatMessage, Note, OpenPosition, Side, Trade } from "./types";
import { mulberry32, SPECS, tradePnl } from "./market";

function etIso(date: string, hh: number, mm: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, hh + 4, mm, 0)).toISOString();
}

function roundTick(price: number, tick: number) {
  return Math.round(price / tick) * tick;
}

function addDays(date: string, days: number) {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

function weekday(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const NOTE_WIN = [
  "Took the close, not the wick. Size was planned.",
  "Held to the first target. Runner scratched at break-even.",
  "A+ location. Did not add.",
  "Followed the stop. The second half paid the day.",
];
const NOTE_LOSS = [
  "Stop was correct. No move. Next.",
  "Late. The idea was already gone when I clicked.",
  "Chased the extension. This one does not count as the setup.",
  "Got paid to be impatient. Tag it and leave it.",
];

export function buildTrades(): Trade[] {
  const rand = mulberry32(0x51a7e);
  const trades: Trade[] = [];
  let id = 1;
  let lastLossAt = 0;

  for (let date = "2026-06-02"; date <= "2026-10-21"; date = addDays(date, 1)) {
    const wd = weekday(date);
    if (wd === 0 || wd === 6) continue;
    const quiet = rand();
    if (quiet < 0.22) continue;

    let n = 1 + Math.floor(rand() * (rand() < 0.18 ? 5 : 3));
    if (date === "2026-10-17") n = 5;
    if (date === "2026-09-03") n = 4;
    if (date === "2026-08-12") n = 4;

    let dayLosses = 0;
    for (let k = 0; k < n; k++) {
      const accountRoll = rand();
      const accountId = accountRoll < 0.5 ? "ibkr" : accountRoll < 0.74 ? "ftmo" : accountRoll < 0.88 ? "apex" : "topstep";
      const account = ACCOUNTS.find((a) => a.id === accountId)!;

      let playbookId = ["opening-drive", "vwap-reclaim", "ict-fvg", "orb", "mean-rev", "news-fade"][Math.floor(rand() * 6)];
      if (date === "2026-10-17" && k > 0) playbookId = rand() < 0.5 ? "news-fade" : "mean-rev";
      if (date === "2026-09-03") playbookId = k % 2 ? "opening-drive" : "ict-fvg";

      const symbols = playbookId === "mean-rev" ? ["NVDA", "AAPL", "TSLA", "EURUSD", "GBPUSD"] : playbookId === "news-fade" ? ["NQ", "ES", "EURUSD", "CL"] : ["NQ", "MNQ", "ES", "CL", "EURUSD", "BTCUSD"];
      const symbol = symbols[Math.floor(rand() * symbols.length)];
      const spec = SPECS[symbol];

      let hour = 9 + Math.floor(rand() * 6);
      if (rand() < 0.18) hour = 15;
      if (symbol === "EURUSD" || symbol === "GBPUSD") hour = rand() < 0.35 ? 3 + Math.floor(rand() * 4) : 8 + Math.floor(rand() * 5);
      if (date === "2026-10-17" && k > 1) hour = 15;
      const minute = Math.floor(rand() * 60);
      const openedMs = Date.parse(etIso(date, hour, minute));

      const side: Side = rand() < 0.56 ? "long" : "short";
      let emotion = EMOTIONS[Math.floor(rand() * 4)];
      const afterLoss = lastLossAt && openedMs - lastLossAt < 20 * 60_000;
      if (afterLoss && rand() < 0.55) emotion = "tilt";
      if (date === "2026-10-17" && k > 0) emotion = k % 2 ? "tilt" : "fomo";
      if (hour >= 15 && rand() < 0.45) emotion = rand() < 0.5 ? "fomo" : "hesitant";
      if (date === "2026-09-03") emotion = "focused";

      let edge = -0.02;
      if (playbookId === "opening-drive") edge += 0.28;
      if (playbookId === "vwap-reclaim") edge += 0.14;
      if (playbookId === "ict-fvg") edge += 0.18;
      if (playbookId === "orb") edge += 0.06;
      if (playbookId === "mean-rev") edge -= 0.08;
      if (playbookId === "news-fade") edge -= 0.38;
      if (hour >= 15) edge -= 0.62;
      if (hour >= 9 && hour <= 11) edge += 0.1;
      if (hour < 7) edge += 0.04;
      if (emotion === "tilt" || emotion === "fomo") edge -= 0.5;
      if (emotion === "focused" || emotion === "calm") edge += 0.06;
      if (afterLoss) edge -= 0.28;
      if (accountId === "ftmo") edge += 0.05;
      if (accountId === "apex") edge -= 0.04;

      const winP = Math.min(0.8, Math.max(0.18, 0.5 + edge * 0.55));
      const win = rand() < winP;
      let r = win ? 0.45 + rand() ** 1.15 * 2.8 : -(0.7 + rand() * 0.55);
      if (date === "2026-09-03" && k === 0) r = 3.4;
      if (date === "2026-08-12" && accountId === "topstep" && k === 0) r = 2.8;
      r = Math.round(r * 100) / 100;

      const risk =
        accountId === "ibkr" ? 180 + rand() * 140 : accountId === "ftmo" ? 280 + rand() * 180 : accountId === "apex" ? 140 + rand() * 90 : 110 + rand() * 70;

      let qty = 1;
      if (symbol === "MNQ") qty = 2 + Math.floor(rand() * 3);
      else if (symbol === "NVDA" || symbol === "AAPL" || symbol === "TSLA") qty = 40 + Math.floor(rand() * 80);
      else if (symbol === "BTCUSD") qty = Math.round((0.08 + rand() * 0.2) * 100) / 100;
      else if (symbol === "EURUSD" || symbol === "GBPUSD") qty = rand() < 0.5 ? 0.5 : 1;
      else qty = rand() < 0.75 ? 1 : 2;

      const drift = Math.sin(id / 17) * 0.012;
      const base = spec.price * (1 + drift);
      const entry = roundTick(base * (1 + (rand() - 0.5) * 0.004), spec.tick);
      const riskPoints = risk / (qty * spec.pv);
      const dir = side === "long" ? 1 : -1;
      const stop = roundTick(entry - dir * riskPoints, spec.tick);
      const exit = roundTick(entry + dir * r * riskPoints, spec.tick);
      const target = roundTick(entry + dir * riskPoints * (1.8 + rand()), spec.tick);
      const fees = Math.round((2.2 + rand() * 3.5) * 100) / 100;
      const pnl = Math.round(tradePnl(symbol, side, qty, entry, exit, fees) * 100) / 100;
      const riskActual = Math.abs(entry - stop) * qty * spec.pv || risk;
      const rMultiple = Math.round((pnl / riskActual) * 100) / 100;

      const maeR = win ? 0.12 + rand() * 0.45 : 0.85 + rand() * 0.45;
      const mfeR = win ? Math.abs(rMultiple) + 0.2 + rand() * 1.05 : 0.08 + rand() * 0.55;
      const mae = Math.round(maeR * riskActual * 100) / 100;
      const mfe = Math.round(mfeR * riskActual * 100) / 100;

      const mistakes: string[] = [];
      if (!win && rand() < 0.7) mistakes.push(MISTAKES[Math.floor(rand() * MISTAKES.length)]);
      if (win && mfe > pnl * 1.8 && rand() < 0.55) mistakes.push("early exit");
      if (afterLoss) mistakes.push("revenge");
      if (emotion === "fomo") mistakes.push("chased");
      const uniqueMistakes = [...new Set(mistakes)];

      const hold = 6 + Math.floor(rand() * (symbol === "NVDA" || symbol === "AAPL" ? 180 : 70));
      const closedMs = openedMs + hold * 60_000;
      const session = hour < 8 ? "London" : hour < 12 ? "New York" : hour < 16 ? "NY afternoon" : "After hours";
      const pb = PLAYBOOKS.find((p) => p.id === playbookId)!;
      const rulesHit = uniqueMistakes.length ? Math.max(1, pb.rules.length - 1 - Math.floor(rand() * 2)) : pb.rules.length - (rand() < 0.2 ? 1 : 0);

      const rating = uniqueMistakes.includes("revenge") || emotion === "tilt" ? 1 + Math.floor(rand() * 2) : win ? 4 + (rand() < 0.4 ? 1 : 0) : 3;
      const notes = (win ? NOTE_WIN : NOTE_LOSS)[Math.floor(rand() * 4)];
      const tags = [pb.name, emotion, session, ...uniqueMistakes].slice(0, 4);

      const trade: Trade = {
        id: `t${id++}`,
        accountId,
        symbol,
        market: spec.market,
        side,
        qty,
        entry,
        exit,
        stop,
        target,
        openedAt: new Date(openedMs).toISOString(),
        closedAt: new Date(closedMs).toISOString(),
        pnl,
        fees,
        rMultiple,
        mae,
        mfe,
        playbookId,
        emotion,
        mistakes: uniqueMistakes,
        tags,
        notes,
        rating,
        reviewed: date < "2026-10-15" ? rand() < 0.86 : rand() < 0.4,
        session,
        rulesHit: Math.min(pb.rules.length, rulesHit),
        rulesTotal: pb.rules.length,
        source: "sync",
        executions: [
          { time: new Date(openedMs).toISOString(), price: entry, qty, action: side === "long" ? "buy" : "sell", kind: "entry" },
          { time: new Date(closedMs).toISOString(), price: exit, qty, action: side === "long" ? "sell" : "buy", kind: "exit" },
        ],
      };
      trades.push(trade);
      if (pnl < 0) {
        lastLossAt = closedMs;
        dayLosses++;
      }
      if (dayLosses >= 3 && rand() < 0.4) break;
    }
  }
  return trades;
}

export const OPEN_POSITIONS: OpenPosition[] = [
  {
    id: "o1",
    accountId: "ibkr",
    symbol: "NQ",
    side: "long",
    qty: 1,
    entry: 20242,
    last: 20271,
    stop: 20196,
    target: 20330,
    openedAt: "2026-10-22T13:46:00Z",
    playbookId: "vwap-reclaim",
  },
  {
    id: "o2",
    accountId: "ftmo",
    symbol: "EURUSD",
    side: "short",
    qty: 1,
    entry: 1.08442,
    last: 1.08371,
    stop: 1.0861,
    target: 1.0808,
    openedAt: "2026-10-22T07:12:00Z",
    playbookId: "ict-fvg",
  },
];

const NOTES: Note[] = [
  {
    id: "n1",
    folder: "Pre-market",
    title: "Oct 22 — levels before the open",
    updatedAt: "2026-10-22T11:10:00Z",
    template: "premarket",
    body: `NQ: overnight high 20288, overnight low 20154, cash VWAP likely near 20220.\nES: balance day unless 5758 breaks.\nUSD calendar: jobless claims 08:30 ET. No fades.\nMax loss today: $500 personal, and I am already flat if FTMO daily room drops under $2,000.\nA+ only: Opening Drive or a clean VWAP reclaim. News Fade is benched.`,
  },
  {
    id: "n2",
    folder: "Reviews",
    title: "Week of Oct 13",
    updatedAt: "2026-10-19T18:40:00Z",
    template: "weekly",
    body: `Green week, ugly process on Friday.\nOpening Drive still pays. News Fade donated the afternoon of the 17th — five clicks, tilt after the first loser.\nRule for next week: platform closed at 15:00 ET. No exceptions for "one more try."\nFTMO is the account I am protecting. Personal book can scratch. The evaluation cannot.`,
  },
  {
    id: "n3",
    folder: "Playbooks",
    title: "Opening Drive — what counts",
    updatedAt: "2026-09-02T15:00:00Z",
    body: `Counts: first 5-minute close outside the opening range, in the direction of overnight inventory, stop inside the range, flat by 11:00.\nDoes not count: a second drive, a wick through the level, anything after a red news candle.\nIf I have to squint, it is not the setup.`,
  },
  {
    id: "n4",
    folder: "Psychology",
    title: "After a loss",
    updatedAt: "2026-08-20T16:12:00Z",
    body: `The next click inside 15 minutes is not a new idea. It is the last idea trying to get its money back.\nStand up. Water. If the daily loss is half spent, the day is over even if I feel fine.\nFeeling fine is not data.`,
  },
  {
    id: "n5",
    folder: "Reviews",
    title: "September monthly",
    updatedAt: "2026-10-01T17:02:00Z",
    template: "monthly",
    body: `Best month of the book. Almost all of it came from two playbooks before 11:30.\nAfternoons were a rounding error that wanted to be a habit. They do not get a habit.\nTopstep consistency is the number to watch — one large day is doing too much of the work.`,
  },
  {
    id: "n6",
    folder: "Pre-market",
    title: "Template — pre-market",
    updatedAt: "2026-06-01T12:00:00Z",
    template: "premarket",
    body: `Bias:\nLevels:\nNews:\nMax loss:\nSetups allowed:\nSetups benched:\nDone for the day when:`,
  },
];

const MESSAGES: ChatMessage[] = [
  {
    id: "m1",
    spaceId: "desk",
    author: "Yasmine K.",
    role: "mentor",
    text: "Friday's cluster is the whole lesson. First loss was a fine stop. Trades two through five were you arguing with it. Bench News Fade for ten sessions and show me the tag report.",
    time: "2026-10-19T19:12:00Z",
    reactions: 3,
  },
  {
    id: "m2",
    spaceId: "desk",
    author: "You",
    role: "you",
    text: "Agreed. News Fade is off. I will post the day note before the cash open, not after.",
    time: "2026-10-19T19:18:00Z",
    reactions: 1,
  },
  {
    id: "m3",
    spaceId: "ny",
    author: "Owen P.",
    role: "member",
    text: "Opening drive on NQ paid if you waited for the 5-minute close. The wick traders got run over.",
    symbol: "NQ",
    pnl: 640,
    time: "2026-10-21T14:10:00Z",
    reactions: 12,
  },
  {
    id: "m4",
    spaceId: "ny",
    author: "Lina S.",
    role: "member",
    text: "Sat on my hands into claims. Boring and correct.",
    time: "2026-10-21T14:22:00Z",
    reactions: 7,
  },
  {
    id: "m5",
    spaceId: "prop",
    author: "Hugo M.",
    role: "member",
    text: "Consistency check: my best day is 28% of profit. Leaving size alone for the rest of the week.",
    time: "2026-10-20T20:01:00Z",
    reactions: 9,
  },
  {
    id: "m6",
    spaceId: "prop",
    author: "Yasmine K.",
    role: "mentor",
    text: "If you cannot say your distance to the daily loss out loud, you are not trading. You are hoping the platform forgets.",
    time: "2026-10-18T11:40:00Z",
    reactions: 21,
  },
];

export function freshState(): AppState {
  return {
    version: 1,
    user: null,
    theme: "dark",
    trades: buildTrades(),
    playbooks: PLAYBOOKS,
    notes: NOTES,
    messages: MESSAGES,
    agents: AGENTS,
    checklists: {
      "2026-10-22": {
        date: "2026-10-22",
        items: ["levels", "calendar"],
        maxLoss: 500,
        levels: "NQ 20288 / 20154 · ES 5758",
        journal: "",
        intention: "A+ only. Flat by 15:00 ET.",
      },
    },
    backtests: [
      {
        id: "bt1",
        name: "NQ opening range, March sample",
        mode: "auto",
        symbol: "NQ",
        strategy: "orb",
        seed: 42,
        createdAt: "2026-10-11T15:00:00Z",
        note: "Saved drill. Simulated tape, not a live backtest.",
        net: 1840,
        trades: [
          { side: "long", entry: 17840, exit: 17920, pnl: 1600, r: 2 },
          { side: "short", entry: 18010, exit: 18040, pnl: -600, r: -1 },
          { side: "long", entry: 18102, exit: 18170, pnl: 840, r: 1.4 },
        ],
      },
    ],
    connected: ["Interactive Brokers", "FTMO", "Apex Trader Funding"],
    filters: { account: "all", range: "all", playbook: "all", symbol: "all", side: "all", tag: "all", view: "dollar" },
    widgets: { kpis: true, equity: true, calendar: true, score: true, recent: true, daily: true, open: true, prop: true },
    lastImport: "2026-10-22T09:14:00Z",
    aiCredits: 1486,
    lessonsDone: ["why-journal"],
  };
}

export { SPACES };
