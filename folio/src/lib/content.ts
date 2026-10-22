import type { Account, AgentConfig, Playbook, Space } from "./types";

export const ACCOUNTS: Account[] = [
  { id: "ibkr", name: "IBKR Personal", broker: "Interactive Brokers", kind: "live", balance0: 25000 },
  {
    id: "ftmo",
    name: "FTMO 100K",
    broker: "FTMO",
    kind: "prop",
    balance0: 100000,
    firm: "FTMO",
    rules: {
      profitTarget: 10000,
      dailyLoss: 5000,
      maxLoss: 10000,
      trailing: false,
      minDays: 4,
      consistency: 0.5,
      note: "Challenge desk: 10% target, 5% daily loss, 10% max loss. Consistency watched at 50% so one day cannot carry the account.",
    },
  },
  {
    id: "apex",
    name: "Apex 50K",
    broker: "Apex",
    kind: "prop",
    balance0: 50000,
    firm: "Apex",
    rules: {
      profitTarget: 3000,
      dailyLoss: 1000,
      maxLoss: 2500,
      trailing: true,
      minDays: 1,
      consistency: 0.3,
      note: "Trailing threshold of $2,500 from the equity peak. Best day should stay under 30% of total profit.",
    },
  },
  {
    id: "topstep",
    name: "Topstep 50K",
    broker: "Topstep",
    kind: "prop",
    balance0: 50000,
    firm: "Topstep",
    rules: {
      profitTarget: 3000,
      dailyLoss: 1000,
      maxLoss: 2000,
      trailing: true,
      minDays: 2,
      consistency: 0.5,
      note: "Daily loss limit $1,000. Trailing max loss $2,000. Best day under half of total profit.",
    },
  },
];

export const PLAYBOOKS: Playbook[] = [
  {
    id: "opening-drive",
    name: "Opening Drive",
    market: "Index futures",
    color: "#7c6bf6",
    createdAt: "2026-05-12T12:00:00Z",
    description: "Trade the first directional push after the cash open only when overnight inventory and the opening print agree.",
    rules: [
      { id: "od1", text: "Wait for the first 5-minute close outside the opening range." },
      { id: "od2", text: "Overnight high or low must not already be taken." },
      { id: "od3", text: "Risk is fixed before the click. No adding." },
      { id: "od4", text: "If the drive fails back inside the range, scratch." },
      { id: "od5", text: "Done by 11:00 ET. No second drive." },
    ],
  },
  {
    id: "vwap-reclaim",
    name: "VWAP Reclaim",
    market: "Futures & stocks",
    color: "#3b82f6",
    createdAt: "2026-05-18T12:00:00Z",
    description: "A failed push away from VWAP that reclaims the average with acceptance, not a wick.",
    rules: [
      { id: "vw1", text: "Price must have traded at least 0.4 ATR away from VWAP." },
      { id: "vw2", text: "Entry is the reclaim close, not the touch." },
      { id: "vw3", text: "Stop goes beyond the failed extreme." },
      { id: "vw4", text: "Target is the session high or low, then a runner to 2R." },
      { id: "vw5", text: "Skip if three news candles are still printing." },
    ],
  },
  {
    id: "ict-fvg",
    name: "ICT Fair Value Gap",
    market: "Futures & forex",
    color: "#f5b942",
    createdAt: "2026-04-02T12:00:00Z",
    description: "Displacement leaves a gap. Enter the retrace into the gap only in the direction of the higher-timeframe bias.",
    rules: [
      { id: "f1", text: "Higher-timeframe bias is marked before the open." },
      { id: "f2", text: "Gap must be created by a displacement candle, not drift." },
      { id: "f3", text: "Entry inside the gap. Stop beyond the candle that made it." },
      { id: "f4", text: "No trade against the session draw on liquidity." },
      { id: "f5", text: "One attempt per gap." },
    ],
  },
  {
    id: "orb",
    name: "Opening Range Breakout",
    market: "Futures",
    color: "#3dd68c",
    createdAt: "2026-03-20T12:00:00Z",
    description: "Classic 15-minute opening range. Break and hold, or do nothing.",
    rules: [
      { id: "orb1", text: "Range is the first 15 minutes. No earlier entries." },
      { id: "orb2", text: "Break must close outside, not just wick." },
      { id: "orb3", text: "Stop is the other side of the range, size adjusted." },
      { id: "orb4", text: "If range is wider than 1.2x the 20-day average, skip." },
    ],
  },
  {
    id: "mean-rev",
    name: "Mean Reversion",
    market: "Stocks & forex",
    color: "#fb7185",
    createdAt: "2026-02-11T12:00:00Z",
    description: "Fade a stretched move back to the session mean when the tape stops making new extremes.",
    rules: [
      { id: "mr1", text: "Only fade after two failed extensions." },
      { id: "mr2", text: "Never fade a news candle." },
      { id: "mr3", text: "Target is VWAP or the 20-bar mean, not a home run." },
      { id: "mr4", text: "Half size versus trend setups." },
    ],
  },
  {
    id: "news-fade",
    name: "News Fade",
    market: "All",
    color: "#94a3b8",
    createdAt: "2026-01-09T12:00:00Z",
    description: "A setup you are trying to retire. Fade the first spike after a high-impact print. Tracked so the data can kill it.",
    rules: [
      { id: "nf1", text: "Only after the first 60-second spike stalls." },
      { id: "nf2", text: "Hard stop. No averaging." },
      { id: "nf3", text: "Maximum one attempt per event." },
      { id: "nf4", text: "If the week is already red, this setup is off." },
    ],
  },
];

export const SPACES: Space[] = [
  { id: "desk", name: "Salé desk", kind: "private", members: 4, blurb: "You, your mentor, and two friends. Invite-only.", mentor: "Yasmine K." },
  { id: "ny", name: "NY open futures", kind: "group", members: 186, blurb: "Cash-open index futures. No signals, only process." },
  { id: "prop", name: "Evaluation lab", kind: "group", members: 94, blurb: "Passing challenges without breaking the daily loss." },
];

export const AGENTS: AgentConfig[] = [
  {
    id: "habit",
    name: "Habit agent",
    role: "Discipline",
    description: "Watches pre-market prep, post-trade notes, and end-of-day review. Nudges you when a ritual slips.",
    active: true,
  },
  {
    id: "risk",
    name: "Risk agent",
    role: "Guardrails",
    description: "Tracks daily drawdown, size, R, and consecutive losses. Warns before the rule breaks, not after.",
    active: true,
  },
  {
    id: "sentiment",
    name: "Sentiment agent",
    role: "Mindset",
    description: "Reads emotion tags, trade frequency, and note tone to catch tilt, FOMO, and overconfidence.",
    active: true,
  },
  {
    id: "custom",
    name: "No-news agent",
    role: "Your rules",
    description: "You wrote this one: flag any fill inside 10 minutes of a high-impact USD print.",
    active: true,
    custom: true,
    watch: "news",
  },
];

export const CHECKLIST = [
  { id: "levels", label: "Key levels marked before the open" },
  { id: "calendar", label: "Economic calendar checked" },
  { id: "maxloss", label: "Max daily loss written down" },
  { id: "aplus", label: "Only A+ setups are allowed today" },
  { id: "size", label: "Size is set from the stop, not the feeling" },
  { id: "news", label: "No orders 10 minutes around red news" },
];

export const EMOTIONS = ["focused", "calm", "confident", "hesitant", "fomo", "tilt"];
export const MISTAKES = ["early exit", "late entry", "oversized", "no plan", "chased", "revenge", "moved stop", "traded news"];

export const BROKERS = [
  { name: "Interactive Brokers", group: "Stocks & futures" },
  { name: "TradeStation", group: "Stocks & futures" },
  { name: "NinjaTrader", group: "Futures" },
  { name: "Tradovate", group: "Futures" },
  { name: "Thinkorswim", group: "Stocks & futures" },
  { name: "Charles Schwab", group: "Stocks" },
  { name: "Tastytrade", group: "Stocks & options" },
  { name: "Webull", group: "Stocks" },
  { name: "Robinhood", group: "Stocks" },
  { name: "E*TRADE", group: "Stocks" },
  { name: "Fidelity", group: "Stocks" },
  { name: "Questrade", group: "Stocks" },
  { name: "MetaTrader 4", group: "Forex" },
  { name: "MetaTrader 5", group: "Forex" },
  { name: "cTrader", group: "Forex" },
  { name: "OANDA", group: "Forex" },
  { name: "FOREX.com", group: "Forex" },
  { name: "Pepperstone", group: "Forex" },
  { name: "IC Markets", group: "Forex" },
  { name: "Bybit", group: "Crypto" },
  { name: "Binance", group: "Crypto" },
  { name: "Coinbase", group: "Crypto" },
  { name: "Kraken", group: "Crypto" },
  { name: "FTMO", group: "Prop" },
  { name: "Topstep", group: "Prop" },
  { name: "Apex Trader Funding", group: "Prop" },
  { name: "MyFundedFutures", group: "Prop" },
  { name: "The Trading Pit", group: "Prop" },
  { name: "FundedNext", group: "Prop" },
  { name: "Earn2Trade", group: "Prop" },
  { name: "Take Profit Trader", group: "Prop" },
  { name: "Lux Trading Firm", group: "Prop" },
];

export const LESSONS = [
  {
    id: "why-journal",
    track: "Foundations",
    minutes: 8,
    title: "Why the journal is the strategy",
    body: `A setup is not an edge until the fills say so. Memory keeps the winner that felt brilliant and drops the three scratches that paid for it. A journal is the only record that does not flatter you.

Write the plan before the click, not after. The note you type while you are still in the trade is a different document from the story you tell at dinner. Folio keeps both: the executions arrive on their own, and the sentence you owe the trade is the only part that still requires you.

Start with four fields and refuse to add a fifth until those four are boring. Side and size. Planned stop. Emotion in one word. Whether you followed the playbook. Everything else — screenshots, MAE, the hour of day — can be computed. Discipline cannot.

Review once a week, not after every red trade. A single loss is weather. A month of losses at 15:40 ET is climate. The point of the journal is to tell those apart before you "fix" a strategy that was never the problem.`,
  },
  {
    id: "r-multiple",
    track: "Risk",
    minutes: 11,
    title: "R-multiple, the only unit that travels",
    body: `Dollars lie across accounts. A $400 win on a $25k personal book and a $400 win on a $100k evaluation are not the same decision. R is the distance from entry to the planned stop, expressed as 1. Every result becomes a multiple of that distance.

If you risk $200 and make $460, that is +2.3R, whoever the broker is. If you lose $260 because you moved the stop, that is -1.3R, and the journal should show it as a rule break, not as "the market was wild."

Expectancy is just the average R. A 48% win rate with +1.8R winners and -1.0R losers is a business. A 70% win rate with tiny winners and rare -4R losers is a slow leak that feels like skill. Folio's profit factor and expectancy widgets exist to stop you from falling in love with win rate.

Size comes from R, not from confidence. Decide the dollar risk first. The stop distance tells you the quantity. If the stop has to be so wide that size becomes embarrassing, the trade is too late — not a reason to trade it anyway.`,
  },
  {
    id: "mae-mfe",
    track: "Execution",
    minutes: 9,
    title: "MAE, MFE, and the exit you keep avoiding",
    body: `Maximum adverse excursion is how far the trade went against you while it was open. Maximum favorable excursion is how far it went for you. Realized P&L is only where you happened to get out.

If winners regularly travel 2R in your favor and you bank 0.6R, you do not have an entry problem. You have an exit problem, and it is usually fear wearing the costume of "taking profits." If losers travel 1.6R against you before you exit a 1R plan, you are negotiating with the stop.

Best-exit analysis is not a fantasy of perfect hindsight. It is a ratio: realized profit divided by the favorable excursion. A number under 40% on your best playbook means the setup is fine and the hands are early. Fix the hands. Do not rewrite the playbook because a Tuesday felt bad.

Use MAE to audit stops. If price almost never tags the stop and then runs, your stop is wider than the idea. If price constantly exceeds MAE beyond the planned stop, you are hoping. Hoping is not a risk parameter.`,
  },
  {
    id: "playbooks",
    track: "Strategy",
    minutes: 10,
    title: "Playbooks: rules you can fail in public",
    body: `A playbook is a named setup with rules specific enough to violate. "Trade price action" is not a playbook. "Opening drive: first 5-minute close outside the range, stop inside, done by 11:00 ET" is a playbook, because Thursday can be marked as a miss.

Tag every fill with exactly one playbook, even the impulsive ones. Give the impulsive trades a name — News Fade, Revenge, No Plan — and let them have a P&L. The moment an unnamed trade can hide inside a good strategy, the strategy's stats become fiction.

Three playbooks is plenty. The work is comparison. Opening Drive at +0.42R and News Fade at -0.31R is not a vibe. It is an instruction: stop taking the second one, or cut it to a size that cannot move the week.

Scenarios are how you rehearse the cut. Exclude the bad hour, the bad tag, the oversized cluster, and read the P&L that remains. If the business only works after you delete half the trades, you do not have a strategy yet. You have a highlight reel.`,
  },
  {
    id: "prop-rules",
    track: "Prop",
    minutes: 12,
    title: "The rules that fail evaluations quietly",
    body: `Most evaluations do not die on the headline max loss. They die on the daily loss, the trailing threshold, or a consistency rule that makes the best day illegal.

A daily loss limit is a circuit breaker, not a suggestion. When you are halfway to it, the next trade is no longer the same trade. Size down or stop. Folio's prop desk colors that line before you cross it, because the platform you trade with will not give the money back for a good story.

Trailing drawdown follows the peak, not the start balance. A $2,000 green morning can shrink the room you thought you had. If you do not know where the trail sits after a winner, you are trading a number from yesterday.

Consistency rules punish the hero day. If one session is half your total profit, you can be green and still fail. That is not unfair. It is the firm telling you they want a process, not a lottery ticket. Track the best day as a percent of profit every afternoon, not on the day you request the payout.

Minimum trading days exist so you cannot pass on a single print. Do not invent trades to fill the quota. A flat day you did not force is cleaner than a C-setup you took to "be active."`,
  },
  {
    id: "review-ritual",
    track: "Process",
    minutes: 7,
    title: "A 30-minute weekly review that you will actually do",
    body: `Sunday, same chair, timer set. If it takes longer than 30 minutes you are rereading stories instead of reading stats.

Five minutes: calendar. Which days were green for the right reason, and which were green because you got paid to break a rule? Mark both. A rule-breaking winner is not a victory. It is a sample you should not want more of.

Ten minutes: playbooks. Sort by expectancy, not by how much you like the chart. If a setup is negative over 30 trades, it is benched for the next week. Not "traded smaller." Benched.

Five minutes: time of day. Find the hour that donates money. Put it on a sticky note on the monitor. Most traders do not need a new indicator. They need to stop trading the close.

Five minutes: prop and risk. Distance to daily loss, distance to trailing max, best-day share of profit. Write the number you are not allowed to cross tomorrow.

Five minutes: one sentence in the notebook. Not a paragraph. "This week I lose money after 15:00 and when I fade news. Both are off until the review says otherwise." Then close the laptop. The review is finished when the next week has fewer permissions, not more ideas.`,
  },
];

export const POSTS = [
  {
    slug: "weekly-review",
    title: "The 30-minute weekly review serious traders actually finish",
    date: "Oct 12, 2026",
    kicker: "Process",
    excerpt: "A review that needs a free afternoon will not happen. Here is the short version that still changes the next week.",
    body: `Most trading reviews fail for a boring reason: they are too long. You open the journal with good intentions, reread a winner, adjust an indicator, and stand up an hour later with no rule changed. The week was not reviewed. It was re-experienced.

A useful review has one job. It removes a permission. You are not looking for a new setup. You are looking for the hour, the tag, or the emotion that paid a tax, and you are taking it off the menu.

Start with the calendar, not the best trade. Green days and red days are not the insight. The insight is a green day you are embarrassed by, and a red day you would take again. Those two days tell you whether you are grading P&L or grading decisions. Grade decisions. P&L is the lagging score.

Then sort playbooks by expectancy in R, with the trade count visible. A setup with eight trades and a pretty curve is a rumor. A setup with forty trades and a negative expectancy is a decision. Bench it for a week. Write the bench in the notebook so future-you cannot pretend it was a suggestion.

Time of day is the cheapest edge in the book. Almost every active trader has an hour that donates. It survives because it feels like "being available." Availability is not a strategy. If 15:00 to 16:00 ET is red across two months, you do not trade it. You do not trade it smaller. You close the platform.

End with prop math if you are in an evaluation. Distance to the daily loss. Distance to the trailing max, measured from the peak, not the start. Best day as a percent of total profit. Three numbers. If you cannot say them without opening a calculator, you are not ready for the cash open.

The last sentence of the review is the only one that matters. "This week I do not fade news, and I am flat by 15:00." If you cannot write a sentence that forbids something, you did not review. You browsed.`,
  },
  {
    slug: "mae-mfe",
    title: "MAE and MFE: the two numbers that expose your exits",
    date: "Sep 28, 2026",
    kicker: "Execution",
    excerpt: "Realized P&L is where you got out. MAE and MFE are what the trade actually offered. The gap is your execution.",
    body: `Traders obsess over entries because entries are photogenic. The chart screenshot always centers the click. The money, though, is usually lost between the best price the trade reached and the price you actually took.

Maximum favorable excursion is that best price, measured in dollars or R while the position was still open. Maximum adverse excursion is the worst price. Neither is a moral judgment. They are the envelope of the trade.

Put them next to realized P&L and three patterns fall out, over and over.

First: winners with a fat MFE and a thin realized result. You had the move. You did not keep it. This is almost never an entry problem, and rewriting the setup will not fix the flinch. You need a pre-committed partial and a rule for the runner that does not involve watching the P&L flash.

Second: losers whose MAE is far beyond the planned stop. The plan said 1R. The fill says 1.7R. You moved the stop, or you never had one. No indicator fixes a negotiation. The journal should tag these as moved-stop, not as a loss the market "did to you."

Third: losers that went favorable first. MFE was real, MAE came later, and you rode a winner into a loser. That is a different disease from cutting winners. The trade worked and you refused to pay yourself. A time stop or a break-even rule belongs on that playbook, in writing.

Exit efficiency — realized profit divided by MFE, on trades that went your way — is the cleanest single stat for this. Under 40% means the setup is more generous than your hands. Over 80% can mean you are only banking the trades that never pulled back, which is its own tell.

Do not optimize MAE and MFE into a fantasy of selling the high. Use them to see the habit. Then change one rule for one playbook for two weeks. Measure again. That is the whole craft.`,
  },
  {
    slug: "prop-sync",
    title: "How evaluations actually fail (it is rarely the max loss)",
    date: "Sep 4, 2026",
    kicker: "Prop",
    excerpt: "The daily loss, the trailing threshold, and the consistency rule end more challenges than the number printed in the headline.",
    body: `Prop evaluations are sold on a profit target. They are failed on the footnotes. If you only track "how much until I pass," you will trip a rule you were not looking at.

The daily loss limit is the first footnote. It feels far away at the open and very close after two losers. The correct behavior at 50% of the daily loss is not "be more selective" in the vague sense. It is a pre-written action: half size, or done. Traders who wait until they feel scared are already late. The feeling arrives after the click that broke the rule.

Trailing drawdown is the second footnote, and it is the one people misread. The trail follows your peak equity. A strong morning does not give you more room in the way you think. It can lift the floor underneath you. After a large green day, recompute the distance to the trail before the next session. Yesterday's cushion is not today's cushion.

Consistency is the quiet one. Some programs cap how much of your profit can come from a single day. You can be up on the target and still fail because Tuesday was too good. That rule is not there to annoy you. It is there because a firm cannot pay a trader whose entire edge is one news candle. Watch best-day profit divided by total profit every afternoon. If it is climbing toward the cap, the rest of the week has to be normal size, not heroic size.

Minimum days create a different mistake: trading because the calendar said so. A forced C-setup to "count a day" is how a passing curve becomes a breached daily loss. If the day does not offer the playbook, the day does not offer the playbook. Flat is a position.

None of this requires a prediction. It requires the three numbers on a screen before you are allowed to click: room to the daily loss, room to the trail, best day as a share of profit. Folio's prop desk is that screen. The discipline is looking at it while you still have a choice.`,
  },
];

export const FAQS = [
  {
    q: "Does Folio place trades for me?",
    a: "No. Folio is a journal, a replay desk, and a practice backtester. Orders you place in backtesting are simulated on a generated tape. Nothing here connects to a live exchange.",
  },
  {
    q: "Does Folio start with sample trades?",
    a: "No. The journal is empty until you add a trade or import a CSV. Broker connect is a workflow preview, not a live sync. Your file stays in the browser.",
  },
  {
    q: "Where is my data stored?",
    a: "In this demo, entirely in your browser. Export a JSON backup from Settings if you want a copy. Clearing site data clears the journal.",
  },
  {
    q: "Which markets does it cover?",
    a: "Futures, forex, stocks, and crypto. Add any symbol manually or by CSV.",
  },
  {
    q: "Can I track a prop evaluation?",
    a: "Yes. The prop desk watches profit target, daily loss, trailing or static max loss, minimum days, and a consistency cap across sample FTMO, Apex, and Topstep rules. Confirm the live rule sheet with your firm before you rely on any number.",
  },
  {
    q: "What does Folio AI actually use?",
    a: "Your journal. Ask it about hours, playbooks, tilt, drawdown, or the evaluation and it answers from the trades currently in the filter. It is not a general chatbot and it does not see anyone else's book.",
  },
];

export const PLANS = [
  {
    id: "essential" as const,
    name: "Essential",
    monthly: 29,
    annual: 22,
    blurb: "One account. The full journal.",
    points: ["1 trading account", "Automated stats & 50+ reports", "3 playbooks", "Notebook & day checklist", "Manual backtesting", "CSV import"],
  },
  {
    id: "pro" as const,
    name: "Pro",
    monthly: 49,
    annual: 37,
    blurb: "The desk most active traders live in.",
    points: ["50 accounts", "Trade, day, and scenario replay", "Unlimited playbooks", "Folio AI & 3 agents", "10 automated backtests / month", "Prop firm sync", "Spaces, 5 mentor seats"],
    featured: true,
  },
  {
    id: "ultra" as const,
    name: "Ultra",
    monthly: 79,
    annual: 59,
    blurb: "Mentors, multi-account, higher limits.",
    points: ["Unlimited accounts", "100 automated backtests / month", "Unlimited mentor seats", "Priority replay depth", "Custom agents", "Shared team spaces"],
  },
];

export const SAMPLE_CSV = `date,symbol,side,qty,entry,exit,stop,account,playbook,emotion,notes
2026-10-20,NQ,long,1,20110,20148,20092,ibkr,opening-drive,focused,Clean drive through overnight high
2026-10-20,ES,short,1,5752,5761,5744,ibkr,news-fade,fomo,Faded CPI spike. Should have stood down
`;
