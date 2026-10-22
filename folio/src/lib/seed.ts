import { ACCOUNTS, AGENTS, CHECKLIST, PLAYBOOKS } from "./content";
import type { AppState } from "./types";

/** Empty desk. Playbooks are templates, not a filled journal. */
export function freshState(): AppState {
  return {
    version: 1,
    user: null,
    theme: "dark",
    trades: [],
    playbooks: PLAYBOOKS,
    notes: [],
    messages: [],
    agents: AGENTS,
    checklists: {},
    backtests: [],
    connected: [],
    filters: { account: "all", range: "all", playbook: "all", symbol: "all", side: "all", tag: "all", view: "dollar" },
    widgets: { kpis: true, equity: true, calendar: true, score: true, recent: true, daily: true, open: true, prop: true },
    lastImport: "",
    aiCredits: 1486,
    lessonsDone: [],
    accounts: ACCOUNTS,
    permissions: CHECKLIST,
  };
}
