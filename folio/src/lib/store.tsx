import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ACCOUNTS } from "./content";
import { rangeBounds, uid } from "./format";
import { SPECS, tradePnl } from "./market";
import { freshState } from "./seed";
import { accountBase, computeStats } from "./stats";
import type { Account, AgentConfig, AppState, BacktestSession, DayPlan, Filters, Note, Permission, Playbook, Side, Trade, User } from "./types";

const KEY = "folio-state-v1";
const BAK = "folio-state-v1-backup";
const VAULT = "folio-vault-v1";

const SEED_NOTES = new Set(["n1", "n2", "n3", "n4", "n5", "n6"]);
const SEED_MESSAGES = new Set(["m1", "m2", "m3", "m4", "m5", "m6"]);
const SEED_CONNECTED = ["Interactive Brokers", "FTMO", "Apex Trader Funding"];

/** Drop the preloaded simulated book, including a copy already saved in this browser. */
function withoutDemoBook(state: AppState): AppState {
  const connected =
    state.connected.length === SEED_CONNECTED.length && state.connected.every((name, i) => name === SEED_CONNECTED[i])
      ? []
      : state.connected;
  const checklists = { ...state.checklists };
  const seededDay = checklists["2026-10-22"];
  if (seededDay && seededDay.intention === "A+ only. Flat by 15:00 ET." && !seededDay.journal) delete checklists["2026-10-22"];
  return {
    ...state,
    trades: state.trades.filter((t) => t.source !== "sync"),
    notes: state.notes.filter((n) => !SEED_NOTES.has(n.id)),
    messages: state.messages.filter((m) => !SEED_MESSAGES.has(m.id)),
    backtests: state.backtests.filter((b) => b.id !== "bt1"),
    connected,
    checklists,
    lastImport: state.lastImport === "2026-10-22T09:14:00Z" ? "" : state.lastImport,
  };
}

function parseState(raw: string | null): AppState | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AppState;
    if (parsed.version !== 1 || !Array.isArray(parsed.trades)) return null;
    const fresh = freshState();
    return withoutDemoBook({
      ...fresh,
      ...parsed,
      playbooks: parsed.playbooks?.length ? parsed.playbooks : fresh.playbooks,
      accounts: parsed.accounts?.length ? parsed.accounts : fresh.accounts,
      permissions: parsed.permissions?.length ? parsed.permissions : fresh.permissions,
    });
  } catch {
    return null;
  }
}

function load(): AppState {
  return parseState(localStorage.getItem(KEY)) ?? parseState(localStorage.getItem(BAK)) ?? freshState();
}

type VaultEntry = { salt: string; hash: string; state: AppState };

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function loadVault(): Record<string, VaultEntry> {
  try {
    const parsed = JSON.parse(localStorage.getItem(VAULT) || "{}") as Record<string, VaultEntry>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveVault(vault: Record<string, VaultEntry>) {
  localStorage.setItem(VAULT, JSON.stringify(vault));
}

function rememberBook(next: AppState) {
  const email = next.user?.email ? normalizeEmail(next.user.email) : "";
  if (!email) return;
  const vault = loadVault();
  const prev = vault[email];
  vault[email] = prev ? { ...prev, state: next } : { salt: "", hash: "", state: next };
  saveVault(vault);
}

async function hashPassword(email: string, password: string, salt: string) {
  const data = new TextEncoder().encode(`${salt}:${normalizeEmail(email)}:${password}`);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function userFrom(email: string): User {
  return { name: "Trader", email, plan: "pro", city: "Salé", timezone: "Africa/Casablanca" };
}

export function writeState(next: AppState) {
  const raw = JSON.stringify(next);
  localStorage.setItem(KEY, raw);
  localStorage.setItem(BAK, raw);
  localStorage.setItem("folio-saved-at", new Date().toISOString());
  try {
    rememberBook(next);
  } catch {
    /* A full disk quota should not block the primary save. */
  }
}

interface Store extends AppState {
  filtered: Trade[];
  stats: ReturnType<typeof computeStats>;
  base: number;
  savedAt: string;
  login: (user: User) => void;
  signup: (user: User, password: string) => Promise<string>;
  loginAccount: (email: string, password: string) => Promise<string>;
  setPassword: (password: string) => Promise<string>;
  hasPassword: boolean;
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
  addAccount: (account: Account) => void;
  removeAccount: (id: string) => void;
  addPermission: (permission: Permission) => void;
  removePermission: (id: string) => void;
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
    const base = accountBase([state.filters.account], state.accounts);
    const bindBook = async (user: User, password: string, claim: boolean) => {
      const email = normalizeEmail(user.email);
      if (!email.includes("@") || !email.split("@")[1]?.includes(".")) return "Enter a real email.";
      if (password.trim().length < 4) return "Password needs at least 4 characters.";
      const vault = loadVault();
      const current = state.user?.email ? normalizeEmail(state.user.email) : "";
      if (!claim && vault[email]?.hash && email !== current) return "This email already has a desk on this browser. Log in with it.";
      const salt = randomSalt();
      const hash = await hashPassword(email, password, salt);
      const next: AppState = {
        ...state,
        user: { ...user, email, name: user.name.trim() || state.user?.name || "Trader" },
      };
      if (current && current !== email) delete vault[current];
      vault[email] = { salt, hash, state: next };
      saveVault(vault);
      writeState(next);
      setState(next);
      setSavedAt(new Date().toISOString());
      return "";
    };
    return {
      ...state,
      filtered,
      stats: computeStats(filtered, base, state.accounts),
      base,
      toasts,
      savedAt,
      toast,
      login: (user) => commit((s) => ({ ...s, user: { ...user, email: normalizeEmail(user.email) } })),
      signup: (user, password) => bindBook(user, password, false),
      loginAccount: async (email, password) => {
        const key = normalizeEmail(email);
        const entry = loadVault()[key];
        if (!entry) return "No saved desk for this email on this browser. Create one, and the journal will stay under it.";
        if (password.trim().length < 4) return "Password needs at least 4 characters.";
        if (!entry.hash) {
          const salt = randomSalt();
          const hash = await hashPassword(key, password, salt);
          const restored = parseState(JSON.stringify(entry.state)) ?? entry.state;
          const next = { ...restored, user: { ...(restored.user ?? userFrom(key)), email: key } };
          const vault = loadVault();
          vault[key] = { salt, hash, state: next };
          saveVault(vault);
          writeState(next);
          setState(next);
          setSavedAt(new Date().toISOString());
          return "";
        }
        const hash = await hashPassword(key, password, entry.salt);
        if (hash !== entry.hash) return "Wrong password for this email.";
        const next = parseState(JSON.stringify(entry.state)) ?? entry.state;
        writeState(next);
        setState(next);
        setSavedAt(new Date().toISOString());
        return "";
      },
      setPassword: (password) => {
        if (!state.user?.email) return Promise.resolve("Log in first.");
        return bindBook(state.user, password, true);
      },
      hasPassword: Boolean(state.user?.email && loadVault()[normalizeEmail(state.user.email)]?.hash),
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
        const added = parseCsv(text, state.accounts);
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
        const next = freshState();
        next.user = state.user;
        next.theme = state.theme;
        next.accounts = state.accounts;
        next.permissions = state.permissions;
        writeState(next);
        setState(next);
        setSavedAt(new Date().toISOString());
        toast("Journal cleared");
      },
      addAccount: (account) => {
        commit((s) => ({ ...s, accounts: [...s.accounts, account] }));
        toast(`${account.name} added`);
      },
      removeAccount: (id) => {
        commit((s) => ({
          ...s,
          accounts: s.accounts.filter((a) => a.id !== id),
          filters: s.filters.account === id ? { ...s.filters, account: "all" } : s.filters,
        }));
        toast("Account removed");
      },
      addPermission: (permission) => commit((s) => ({ ...s, permissions: [...s.permissions, permission] })),
      removePermission: (id) => commit((s) => ({ ...s, permissions: s.permissions.filter((p) => p.id !== id) })),
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

function parseCsv(text: string, accounts: Account[]): Trade[] {
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
      accountId: accounts.find((a) => a.id === get("account") || a.name.toLowerCase() === get("account").toLowerCase())?.id ?? accounts[0]?.id ?? "ibkr",
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
