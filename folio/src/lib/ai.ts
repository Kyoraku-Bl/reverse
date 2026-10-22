import { PLAYBOOKS } from "./content";
import { money, pct } from "./format";
import { propSnapshots, type Stats } from "./stats";
import type { Account, Trade } from "./types";

export interface AiReply {
  title: string;
  body: string;
  chips: string[];
}

const CHIPS = ["Where do I leak?", "Best playbook", "Worst hour", "Am I on tilt?", "FTMO status", "Exit efficiency"];

function pbName(id: string) {
  return PLAYBOOKS.find((p) => p.id === id)?.name ?? id;
}

export function answerQuestion(question: string, stats: Stats, trades: Trade[], accounts?: Account[]): AiReply {
  const q = question.toLowerCase();
  const chips = CHIPS.filter((c) => c.toLowerCase() !== q.trim());

  if (!stats.count) {
    return { title: "Nothing in this filter", body: "The current account, date, and tag filters hide every trade. Widen them and ask again.", chips };
  }

  if (/ftmo|apex|topstep|prop|evaluation|funded|pass/.test(q)) {
    const snaps = propSnapshots(trades, accounts);
    const focus = snaps.find((s) => q.includes(s.firm.toLowerCase()) || q.includes(s.accountId)) ?? snaps[0];
    const lines = snaps
      .map((s) => {
        const pctTarget = Math.max(0, s.progress) * 100;
        return `${s.name}: ${money(s.net)} toward ${money(s.target)} (${pctTarget.toFixed(0)}%). Pass forecast ${(s.pass * 100).toFixed(0)}%. ${s.warnings[0]}`;
      })
      .join("\n\n");
    return {
      title: focus ? `${focus.name} is the one to watch` : "Prop desk",
      body: lines + "\n\nThese rules are the demo sheet. Confirm the live program rules with the firm before you size off them.",
      chips,
    };
  }

  if (/tilt|fomo|revenge|emotion|mindset|angry|frustrated/.test(q)) {
    return {
      title: "The tilt cluster is not a rumor",
      body: `Trades tagged tilt or FOMO: ${stats.tilt.count}, net ${money(stats.tilt.pnl)}, win rate ${pct(stats.tilt.winRate)}. Revenge clicks: ${stats.revenge.count}, net ${money(stats.revenge.pnl)}.\n\nAfter a loser, the next trade wins ${pct(stats.afterLoss.winRate)} and nets ${money(stats.afterLoss.pnl)}. After a winner it wins ${pct(stats.afterWin.winRate)}.\n\nThe pattern is specific. The first loss is usually a valid stop. The next click inside fifteen minutes is the leak. A standing rule — flat for fifteen minutes after a stop — would have removed most of that P&L damage without touching the playbooks that actually pay.`,
      chips,
    };
  }

  if (/hour|time|when|afternoon|morning|session/.test(q)) {
    const best = stats.bestHour;
    const worst = stats.worstHour;
    const hours = [...stats.byHour].sort((a, b) => a.expectancy - b.expectancy).slice(0, 3);
    return {
      title: worst ? `${worst.label} is donating` : "Time of day",
      body: `${best ? `Best hour by expectancy is ${best.label} (${money(best.net)}, ${pct(best.winRate)}, ${best.count} trades).` : ""}\n${worst ? `Worst is ${worst.label}: ${money(worst.net)} across ${worst.count} trades.` : ""}\n\nThe three weakest hours:\n${hours.map((h) => `· ${h.label} — ${money(h.net)}, ${h.avgR.toFixed(2)}R, ${h.count} trades`).join("\n")}\n\nYou do not need a new indicator. You need a close time. If an hour is negative over a real sample, it comes off the menu for the next twenty sessions.`,
      chips,
    };
  }

  if (/playbook|setup|strateg/.test(q)) {
    const rows = [...stats.byPlaybook].sort((a, b) => b.avgR - a.avgR);
    return {
      title: stats.bestPlaybook ? `${pbName(stats.bestPlaybook.key)} is the business` : "Playbooks",
      body: rows
        .map((r) => `${pbName(r.key)}: ${r.count} trades, ${pct(r.winRate)} wins, ${r.avgR.toFixed(2)}R expectancy, ${money(r.net)}, profit factor ${r.profitFactor.toFixed(2)}.`)
        .join("\n") + `\n\nBench anything negative over 20 trades. A setup you "still believe in" after the expectancy is red is a hobby, not a strategy. News Fade is in the book specifically so it cannot hide inside a good tag.`,
      chips,
    };
  }

  if (/symbol|instrument|nq|es|eur|btc|what do i trade/.test(q)) {
    const rows = [...stats.bySymbol].sort((a, b) => b.net - a.net);
    return {
      title: rows[0] ? `${rows[0].key} carries the book` : "Symbols",
      body: rows.map((r) => `${r.key}: ${money(r.net)}, ${pct(r.winRate)}, ${r.count} trades, ${r.avgR.toFixed(2)}R.`).join("\n") + "\n\nIf a symbol is negative and you cannot explain the playbook that belongs on it, stop trading it. Concentration is not the same as edge, but a symbol with no playbook is just activity.",
      chips,
    };
  }

  if (/drawdown|dd|risk|size/.test(q)) {
    return {
      title: `Max drawdown is ${money(stats.maxDrawdown)}`,
      body: `Closed-equity drawdown is ${money(stats.maxDrawdown)} (${pct(stats.maxDrawdownPct)} of the filtered starting balances). Recovery factor ${stats.recoveryFactor.toFixed(2)}. Average planned risk is about ${money(stats.avgRisk)}.\n\nProfit factor ${stats.profitFactor.toFixed(2)}. A drawdown this size is survivable only if the next losing streak is sized off the same R you used to build the curve. If you raise size to "get it back," the drawdown you just measured is no longer the worst case.`,
      chips,
    };
  }

  if (/mae|mfe|exit|left on|early/.test(q)) {
    return {
      title: `You keep ${pct(stats.exitEfficiency)} of the move`,
      body: `Average favorable excursion ${money(stats.avgMfe)}. Average adverse excursion ${money(stats.avgMae)}. Exit efficiency ${pct(stats.exitEfficiency)}. Left on the table, roughly ${money(stats.leftOnTable)}.\n\nIf efficiency is under 45%, the entries are more generous than the exits. Do not rewrite the playbook. Pre-commit a partial at 1R and a rule for the runner. If losers show MAE well past 1R, you are moving stops — tag those, they are not "market noise."`,
      chips,
    };
  }

  if (/score|folio score|how am i|overall/.test(q)) {
    return {
      title: `Folio Score ${stats.folioScore.toFixed(1)}`,
      body: stats.scoreParts.map((p) => `${p.label}: ${p.value.toFixed(0)} / 100`).join("\n") + `\n\nThe score is a blend of win rate, profit factor, payoff ratio, drawdown, green-day consistency, and recovery. It is a health check, not a promise. A high score with a broken prop rule is still a failed evaluation.`,
      chips,
    };
  }

  if (/week|digest|monday|recent|today/.test(q)) {
    const recent = stats.daily.slice(-5);
    const net = recent.reduce((s, d) => s + d.pnl, 0);
    return {
      title: "This is the week the book would brief you",
      body: `Last ${recent.length} sessions: ${money(net)}.\n${recent.map((d) => `${d.date}: ${money(d.pnl)} · ${d.trades} trades`).join("\n")}\n\nProcess note from the same window: rule adherence ${pct(stats.adherence)}, reviewed ${pct(stats.reviewedRate)}. If the P&L is green and adherence is slipping, do not let the P&L talk you out of the rule. That is how a good month hides the habit that ends the evaluation.`,
      chips,
    };
  }

  if (/long|short|side/.test(q)) {
    return {
      title: "Long versus short",
      body: `Longs: ${money(stats.longNet)}, win rate ${pct(stats.longWin)}.\nShorts: ${money(stats.shortNet)}, win rate ${pct(stats.shortWin)}.\n\nIf one side is carrying the entire net, the other side is a habit. Trade the side that matches the playbook, not the side that feels active.`,
      chips,
    };
  }

  if (/leak|fix|improve|wrong|cost|mistake|should i/.test(q)) {
    const leaks = [
      stats.worstHour ? `${stats.worstHour.label} ET is the expensive hour (${money(stats.worstHour.net)}).` : "",
      stats.worstPlaybook ? `${pbName(stats.worstPlaybook.key)} expectancy is ${stats.worstPlaybook.avgR.toFixed(2)}R.` : "",
      `Tilt and FOMO trades net ${money(stats.tilt.pnl)}.`,
      `Exit efficiency is ${pct(stats.exitEfficiency)} — the move is larger than the fill you keep.`,
      `Rule adherence is ${pct(stats.adherence)}.`,
    ].filter(Boolean);
    return {
      title: "Three leaks, in order",
      body: leaks.map((l, i) => `${i + 1}. ${l}`).join("\n\n") + "\n\nFix one. The usual order is: remove the hour, bench the negative playbook, then work on exits. Adding a new setup while these are open is how journals become scrapbooks.",
      chips,
    };
  }

  return {
    title: "Read of the current filter",
    body: `${stats.count} trades, net ${money(stats.net)}, win rate ${pct(stats.winRate)}, profit factor ${stats.profitFactor.toFixed(2)}, expectancy ${money(stats.expectancy)} (${stats.avgR.toFixed(2)}R).\n\nFolio Score ${stats.folioScore.toFixed(1)}. Max drawdown ${money(stats.maxDrawdown)}. Best playbook: ${stats.bestPlaybook ? pbName(stats.bestPlaybook.key) : "—"}. Worst hour: ${stats.worstHour?.label ?? "—"}.\n\nAsk about a playbook, an hour, tilt, exits, or a prop account. I only answer from this book — nothing outside the filter.`,
    chips,
  };
}

export function insightCards(stats: Stats) {
  return [
    {
      kicker: "Time",
      title: stats.worstHour ? `${stats.worstHour.label} is the leak` : "Time of day",
      body: stats.worstHour ? `${money(stats.worstHour.net)} across ${stats.worstHour.count} trades. The open is not the problem.` : "Not enough trades.",
    },
    {
      kicker: "Behavior",
      title: "Tilt has a P&L",
      body: `${stats.tilt.count} tilt or FOMO fills, net ${money(stats.tilt.pnl)}. After a loss, win rate falls to ${pct(stats.afterLoss.winRate)}.`,
    },
    {
      kicker: "Execution",
      title: `Exit efficiency ${pct(stats.exitEfficiency)}`,
      body: `Average MFE ${money(stats.avgMfe)} versus what you actually keep. About ${money(stats.leftOnTable)} was on the table.`,
    },
    {
      kicker: "Strategy",
      title: stats.bestPlaybook ? `${pbName(stats.bestPlaybook.key)} pays` : "Playbooks",
      body: stats.bestPlaybook ? `${stats.bestPlaybook.avgR.toFixed(2)}R expectancy over ${stats.bestPlaybook.count} trades. Compare it with the bench before you add a new idea.` : "Tag more trades.",
    },
  ];
}
