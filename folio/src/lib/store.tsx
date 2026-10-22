import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ACCOUNTS } from "./content";
import { rangeBounds, uid } from "./format";
import { SPECS, tradePnl } from "./market";
import { freshState } from "./seed";
import { accountBase, computeStats } from "./stats";
import type { AgentConfig, AppState, BacktestSession, DayPlan, Filters, Note, Playbook, Side, Trade, User } from "./types";

const KEY = "folio-state-v1";
const BAK = "folio-state-v1-backup";

function parseState(raw: string | null): AppState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.version !== 1 || !Array.isArray(parsed.trades)) return null;
    return { ...freshState(), ...parsed, playbooks: parsed.playbooks?.length ? parsed.playbooks : freshState().playbooks };
  } catch {
    return null;
  }
}

function load(): AppState {
  return parseState(localStorage.getItem(KEY)) ?? parseState(localStorage.getItem(BAK)) ?? freshState();
}

export function writeState(next: AppState) {
  const raw = JSON.stringify(next);
  localStorage.setItem(KEY, raw);
  localStorage.setItem(BAK, raw);
  localStorage.setItem("folio-saved-at", new Date().toISOString());
}

interface Store extends AppState {
  filtered: Trade[];
  stats: ReturnType<typeof computeStats>;
  base: number;
  savedAt: string;
  login: (user: User) => void;
  logout: () => void;
  setTheme: (theme: "dark" | "light") => void;
  setFilters: (patch: Partial<Filters>) => void;
  setWidgets: (patch: Record<string, boolean>) => void;
  addTrade: (t: Trade) => void;
  updateTrade: (id: string, patch: Partial<Trade>) => void;
  deleteTrade: (id: string) => void;
  importCsv: (text: string) => number;
  addNote: (n: Note) => void;
  updateNote: (id: string, patch: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  addPlaybook: (p: Playbook) => void;
  updatePlaybook: (id: string, patch: Partial<Playbook>) => void;
  postMessage: (spaceId: string, text: string, extra?: { symbol?: string; pnl?: number }) => void;
  reactMessage: (id: string) => void;
  toggleAgent: (id: string) => void;
  addAgent: (a: AgentConfig) => void;
  saveDay: (plan: DayPlan) => void;
  saveBacktest: (b: BacktestSession) => void;
  connectBroker: (name: string) => void;
  spendCredit: () => void;
  completeLesson: (id: string) => void;
  setPlan: (plan: User["plan"]) => void;
  resetDemo: () => void;
  replaceState: (s: AppState) => void;
  toast: (text: string) => void;
  toasts: { id: string; text: string }[];
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>(() => load());
  const [savedAt, setSavedAt] = useState(() => localStorage.getItem("folio-saved-at") ?? "");
  const [toasts, setToasts] = useState<{ id: string; text: string }[]>([]);

  const commit = (recipe: (current: AppState) => AppState) => {
    setState((current) => {
      const next = recipe(current);
      writeState(next);
      return next;
    });
    setSavedAt(new Date().toISOString());
  };

  useEffect(() => {
    writeState(state);
    setSavedAt(localStorage.getItem("folio-saved-at") ?? new Date().toISOString());
  }, [state]);

  const api = useMemo<Store>(() => {
    const toast = (text: string) => {
      const id = uid("toast");
      setToasts((t) => [...t, { id, text }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
    };
    const filtered = applyFilters(state.trades, state.filters);
    const base = accountBase([state.filters.account]);
    return {
      ...state,
      filtered,
      stats: computeStats(filtered, base),
      base,
      toasts,
      savedAt,
      toast,
      login: (user) => commit((s) => ({ ...s, user })),
      logout: () => commit((s) => ({ ...s, user: null })),
      setTheme: (theme) => commit((s) => ({ ...s, theme })),
      setFilters: (patch) => commit((s) => ({ ...s, filters: { ...s.filters, ...patch } })),
      setWidgets: (patch) => commit((s) => ({ ...s, widgets: { ...s.widgets, ...patch } })),
      addTrade: (t) => {
        commit((s) => ({ ...s, trades: [t, ...s.trades] }));
        toast("Trade added to the journal");
      },
      updateTrade: (id, patch) => commit((s) => ({ ...s, trades: s.trades.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      deleteTrade: (id) => {
        commit((s) => ({ ...s, trades: s.trades.filter((t) => t.id !== id) }));
        toast("Trade deleted");
      },
      importCsv: (text) => {
        const added = parseCsv(text);
        if (!added.length) {
          toast("No rows imported. Check the header.");
          return 0;
        }
        commit((s) => ({ ...s, trades: [...added, ...s.trades], lastImport: new Date().toISOString() }));
        toast(`Imported ${added.length} trades`);
        return added.length;
      },
      addNote: (n) => commit((s) => ({ ...s, notes: [n, ...s.notes] })),
      updateNote: (id, patch) => commit((s) => ({ ...s, notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch, updatedAt: new Date().toISOString() } : n)) })),
      deleteNote: (id) => commit((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) })),
      addPlaybook: (p) => commit((s) => ({ ...s, playbooks: [p, ...s.playbooks] })),
      updatePlaybook: (id, patch) => commit((s) => ({ ...s, playbooks: s.playbooks.map((p) => (p.id === id ? { ...p, ...patch } : p)) })),
      postMessage: (spaceId, text, extra) =>
        commit((s) => ({
          ...s,
          messages: [
            { id: uid("m"), spaceId, author: s.user?.name ?? "You", role: "you", text, time: new Date().toISOString(), reactions: 0, ...extra },
            ...s.messages,
          ],
        })),
      reactMessage: (id) => commit((s) => ({ ...s, messages: s.messages.map((m) => (m.id === id ? { ...m, reactions: m.reactions + 1 } : m)) })),
      toggleAgent: (id) => commit((s) => ({ ...s, agents: s.agents.map((a) => (a.id === id ? { ...a, active: !a.active } : a)) })),
      addAgent: (a) => commit((s) => ({ ...s, agents: [a, ...s.agents] })),
      saveDay: (plan) => commit((s) => ({ ...s, checklists: { ...s.checklists, [plan.date]: plan } })),
      saveBacktest: (b) => commit((s) => ({ ...s, backtests: [b, ...s.backtests] })),
      connectBroker: (name) =>
        commit((s) => ({
          ...s,
          connected: s.connected.includes(name) ? s.connected.filter((n) => n !== name) : [...s.connected, name],
          lastImport: new Date().toISOString(),
        })),
      spendCredit: () => commit((s) => ({ ...s, aiCredits: Math.max(0, s.aiCredits - 1) })),
      completeLesson: (id) => commit((s) => ({ ...s, lessonsDone: s.lessonsDone.includes(id) ? s.lessonsDone : [...s.lessonsDone, id] })),
      setPlan: (plan) => commit((s) => ({ ...s, user: s.user ? { ...s.user, plan } : s.user })),
      resetDemo: () => {
        const user = state.user;
        const theme = state.theme;
        const next = freshState();
        next.user = user;
        next.theme = theme;
        writeState(next);
        setState(next);
        setSavedAt(new Date().toISOString());
        toast("Demo book restored");
      },
      replaceState: (s) => {
        writeState(s);
        setState(s);
        setSavedAt(new Date().toISOString());
      },
    };
  }, [state, toasts, savedAt]);

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("store");
  return ctx;
}

export function applyFilters(trades: Trade[], f: Filters) {
  const bounds = rangeBounds(f.range, f.from, f.to);
  return trades.filter((t) => {
    if (f.account !== "all" && t.accountId !== f.account) return false;
    if (f.playbook !== "all" && t.playbookId !== f.playbook) return false;
    if (f.symbol !== "all" && t.symbol !== f.symbol) return false;
    if (f.side !== "all" && t.side !== f.side) return false;
    if (f.tag !== "all" && !t.tags.includes(f.tag) && t.emotion !== f.tag && !t.mistakes.includes(f.tag)) return false;
    const date = t.openedAt.slice(0, 10);
    const et = new Date(t.openedAt);
    const etDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(et);
    if (bounds.from && etDate < bounds.from) return false;
    if (bounds.to && etDate > bounds.to) return false;
    void date;
    return true;
  });
}

function parseCsv(text: string): Trade[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const out: Trade[] = [];
  for (const line of lines.slice(1)) {
    const cols = line.split(",").map((c) => c.trim());
    const get = (name: string) => cols[idx(name)] ?? "";
    const symbol = (get("symbol") || "NQ").toUpperCase();
    const spec = SPECS[symbol] ?? SPECS.NQ;
    const side = (get("side") || "long").toLowerCase() === "short" ? "short" : "long";
    const qty = Number(get("qty") || 1);
    const entry = Number(get("entry"));
    const exit = Number(get("exit"));
    if (!entry || !exit) continue;
    const stop = Number(get("stop") || entry);
    const fees = 3;
    const pnl = Number(get("pnl") || tradePnl(symbol, side as Side, qty, entry, exit, fees));
    const risk = Math.abs(entry - stop) * qty * (spec.pv || 1);
    const date = get("date") || "2026-10-20";
    const openedAt = date.includes("T") ? date : `${date}T14:30:00Z`;
    out.push({
      id: uid("csv"),
      accountId: (["ibkr", "ftmo", "apex", "topstep"].includes(get("account")) ? get("account") : "ibkr") as Trade["accountId"],
      symbol,
      market: spec.market,
      side,
      qty,
      entry,
      exit,
      stop: stop || entry,
      target: Number(get("target") || exit),
      openedAt,
      closedAt: openedAt,
      pnl: Math.round(pnl * 100) / 100,
      fees,
      rMultiple: risk ? Math.round((pnl / risk) * 100) / 100 : 0,
      mae: Math.abs(pnl) * 0.4,
      mfe: Math.max(pnl, 0) * 1.2,
      playbookId: get("playbook") || "orb",
      emotion: get("emotion") || "calm",
      mistakes: [],
      tags: ["import", get("playbook") || "import"].filter(Boolean),
      notes: get("notes") || "Imported from CSV",
      rating: 3,
      reviewed: false,
      session: "New York",
      executions: [
        { time: openedAt, price: entry, qty, action: side === "long" ? "buy" : "sell", kind: "entry" },
        { time: openedAt, price: exit, qty, action: side === "long" ? "sell" : "buy", kind: "exit" },
      ],
      rulesHit: 3,
      rulesTotal: 4,
      source: "csv",
    });
  }
  return out;
}

export { ACCOUNTS };
