import { useEffect, useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Activity, Bell, BookOpen, Bot, Building2, CalendarDays, Check, DollarSign, FlaskConical, GraduationCap,
  LayoutDashboard, LineChart, List, Menu, Moon, Play, Plus, Search, Settings, Sparkles,
  Sun, Target, Users, Wallet, X,
} from "lucide-react";
import { SAMPLE_CSV } from "../lib/content";
import { clock, signedMoney, uid } from "../lib/format";
import { SPECS, SYMBOLS, tradePnl, riskDollars } from "../lib/market";
import { useStore } from "../lib/store";
import type { Side, Trade } from "../lib/types";
import { AddAccountModal } from "./AddAccount";
import { Logo, Modal, Field } from "./Ui";

const NAV = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, end: true, group: "Journal" },
  { to: "/app/day", label: "Day view", icon: CalendarDays, group: "Journal" },
  { to: "/app/trades", label: "Trades", icon: List, group: "Journal" },
  { to: "/app/notebook", label: "Notebook", icon: BookOpen, group: "Journal" },
  { to: "/app/reports", label: "Reports", icon: LineChart, group: "Analyze" },
  { to: "/app/strategies", label: "Strategies", icon: Target, group: "Analyze" },
  { to: "/app/progress", label: "Progress", icon: Activity, group: "Analyze" },
  { to: "/app/replay", label: "Trade replay", icon: Play, group: "Practice", badge: "New" },
  { to: "/app/backtest", label: "Backtesting", icon: FlaskConical, group: "Practice" },
  { to: "/app/ai", label: "Folio AI", icon: Sparkles, group: "Coach" },
  { to: "/app/agents", label: "Agents", icon: Bot, group: "Coach" },
  { to: "/app/university", label: "University", icon: GraduationCap, group: "Coach" },
  { to: "/app/prop", label: "Prop firm sync", icon: Building2, group: "Desk" },
  { to: "/app/spaces", label: "Spaces", icon: Users, group: "Desk" },
  { to: "/app/accounts", label: "Accounts", icon: Wallet, group: "Desk" },
];

export function AppShell() {
  const store = useStore();
  const loc = useLocation();
  const nav = useNavigate();
  const [openNav, setOpenNav] = useState(false);
  const [addAccount, setAddAccount] = useState(false);
  const [add, setAdd] = useState(false);
  const [start, setStart] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [palette, setPalette] = useState(false);
  const [q, setQ] = useState("");
  const [now, setNow] = useState(() => clock(store.user?.timezone || "Africa/Casablanca"));
  const title = NAV.find((n) => (n.end ? loc.pathname === n.to : loc.pathname.startsWith(n.to)))?.label ?? "Folio";

  useEffect(() => {
    const t = setInterval(() => setNow(clock(store.user?.timezone || "Africa/Casablanca")), 15000);
    return () => clearInterval(t);
  }, [store.user?.timezone]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const hits = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return store.trades.slice(0, 6);
    return store.trades.filter((t) => `${t.symbol} ${t.notes} ${t.playbookId} ${t.emotion}`.toLowerCase().includes(query)).slice(0, 8);
  }, [q, store.trades]);

  return (
    <div className="shell" data-theme={store.theme}>
      <aside className="rail">
        <Logo size={32} />
        <button className="icon-btn" onClick={() => setOpenNav((v) => !v)} aria-label="Menu"><Menu size={16} /></button>
        {NAV.filter((_, i) => i % 3 === 0).slice(0, 6).map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? "on" : "")} title={item.label}>
            <item.icon size={16} />
          </NavLink>
        ))}
        <div className="spacer" />
        <button title="Theme" onClick={() => store.setTheme(store.theme === "dark" ? "light" : "dark")}>
          {store.theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        <button title="Notifications" onClick={() => setNotesOpen(true)}><Bell size={16} /></button>
        <NavLink to="/app/settings" title="Settings"><Settings size={16} /></NavLink>
      </aside>
      <aside className={`nav ${openNav ? "open" : ""}`}>
        <button className="btn btn-primary add" onClick={() => setAdd(true)}><Plus size={16} /> Add trade</button>
        {["Journal", "Analyze", "Practice", "Coach", "Desk"].map((group) => (
          <div key={group}>
            <div className="nav-label">{group}</div>
            {NAV.filter((n) => n.group === group).map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => (isActive ? "on" : "")} onClick={() => setOpenNav(false)}>
                <item.icon size={15} /> {item.label}
                {item.badge && <span className="badge new">{item.badge}</span>}
              </NavLink>
            ))}
          </div>
        ))}
      </aside>
      <section className="main">
        <header className="topbar">
          <h1>{title}</h1>
          <span className="faint" style={{ fontSize: 12 }}>{now} Casablanca</span>
          <span className="badge good" title={store.user?.email ? `Autosaved in this browser under ${store.user.email}. Refresh keeps your trades.` : "Autosaved in this browser. Refresh keeps your trades."}>
            <Check size={12} /> {store.savedAt ? `Saved ${new Date(store.savedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Autosave on"}
          </span>
          <div className="grow" />
          <div className="search">
            <Search size={14} />
            <input placeholder="Search trades" value={q} onChange={(e) => { setQ(e.target.value); setPalette(true); }} onFocus={() => setPalette(true)} />
          </div>
          <select className="btn btn-ghost btn-sm" value={store.filters.view} onChange={(e) => store.setFilters({ view: e.target.value as never })}>
            <option value="dollar">$ Dollars</option>
            <option value="percent">% Percent</option>
            <option value="r">R Multiple</option>
            <option value="privacy">Privacy</option>
          </select>
          <select className="btn btn-ghost btn-sm" value={store.filters.range} onChange={(e) => store.setFilters({ range: e.target.value as never })}>
            <option value="all">All time</option>
            <option value="month">This month</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="ytd">Year to date</option>
          </select>
          <div className="row" style={{ gap: 4 }}>
            <select className="btn btn-ghost btn-sm" value={store.filters.account} onChange={(e) => store.setFilters({ account: e.target.value as never })}>
              <option value="all">All accounts</option>
              {store.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            <button className="icon-btn" title="Add account" aria-label="Add account" onClick={() => setAddAccount(true)}><Plus size={14} /></button>
          </div>
          <NavLink to="/app/ai" className="btn btn-primary btn-sm"><Sparkles size={14} /> Ask Folio AI</NavLink>
          <button className="btn btn-blue btn-sm" onClick={() => setStart(true)}>Start my day</button>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </section>
      {add && <AddTrade onClose={() => setAdd(false)} />}
      {addAccount && <AddAccountModal onClose={() => setAddAccount(false)} />}
      {start && <StartDay onClose={() => setStart(false)} />}
      {notesOpen && <Alerts onClose={() => setNotesOpen(false)} />}
      {palette && (
        <div className="palette" onMouseDown={() => setPalette(false)}>
          <div onMouseDown={(e) => e.stopPropagation()}>
            <input autoFocus placeholder="Jump to a trade, symbol, or note" value={q} onChange={(e) => setQ(e.target.value)} />
            {hits.map((t) => (
              <button key={t.id} className="list-btn" onClick={() => { setPalette(false); nav(`/app/trades/${t.id}`); }}>
                <b>{t.symbol}</b> <span className="muted">{t.side}</span> <span className={t.pnl >= 0 ? "green" : "red"}>{t.pnl.toFixed(0)}</span>
                <div className="faint">{t.notes}</div>
              </button>
            ))}
            <div className="faint" style={{ padding: 10 }}>⌘K · demo search stays in this browser</div>
          </div>
        </div>
      )}
    </div>
  );
}

function pointDistance(entry: number, price: number) {
  if (!Number.isFinite(entry) || !Number.isFinite(price)) return 0;
  return Math.round(Math.abs(entry - price) * 1e8) / 1e8;
}

function roundToTick(price: number, tick: number) {
  if (!tick) return Math.round(price * 100) / 100;
  const steps = Math.round(price / tick);
  return Math.round(steps * tick * 1e8) / 1e8;
}

function formatPoints(n: number) {
  return n.toLocaleString("en-US", { maximumFractionDigits: 5 });
}

function formatPnlInput(n: number) {
  const rounded = Math.round(n * 100) / 100;
  return rounded > 0 ? `+${rounded.toFixed(2)}` : rounded.toFixed(2);
}

function readPnl(text: string | null, fallback: number) {
  if (text == null) return fallback;
  const cleaned = text.replace(/[$,+\s]/g, "");
  if (cleaned === "" || cleaned === "-" || cleaned === "." || cleaned === "-.") return fallback;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : fallback;
}

function AddTrade({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [form, setForm] = useState({
    symbol: "NQ", side: "long" as Side, qty: 1, entry: 20240, exit: 20280, stop: 20210, target: 20320,
    accountId: (store.accounts[0]?.id ?? "ibkr") as Trade["accountId"], playbookId: store.playbooks[0]?.id ?? "orb", emotion: "focused", notes: "", date: "2026-10-22", time: "09:45",
  });
  const set = (k: string, v: string | number) => setForm((f) => ({ ...f, [k]: v }));
  const computed = tradePnl(form.symbol, form.side, Number(form.qty), Number(form.entry), Number(form.exit), 3.5);
  const [pnlText, setPnlText] = useState<string | null>(null);
  const pnl = readPnl(pnlText, computed);
  const risk = riskDollars(form.symbol, Number(form.qty), Number(form.entry), Number(form.stop));
  const entryPx = Number(form.entry);
  const slPoints = pointDistance(entryPx, Number(form.stop));
  const tpPoints = pointDistance(entryPx, Number(form.target));
  const tick = SPECS[form.symbol]?.tick ?? 0.01;
  const applyPoints = (kind: "sl" | "tp", raw: string) => {
    const distance = Math.abs(Number(raw));
    if (!Number.isFinite(distance)) return;
    const long = form.side === "long";
    const next = kind === "sl"
      ? (long ? entryPx - distance : entryPx + distance)
      : (long ? entryPx + distance : entryPx - distance);
    set(kind === "sl" ? "stop" : "target", roundToTick(next, tick));
  };
  const pnlEdited = pnlText != null && Math.abs(pnl - computed) > 0.009;
  const save = () => {
    const openedAt = `${form.date}T${form.time}:00Z`;
    const trade: Trade = {
      id: uid("t"),
      accountId: form.accountId,
      symbol: form.symbol,
      market: SPECS[form.symbol]?.market ?? "futures",
      side: form.side,
      qty: Number(form.qty),
      entry: Number(form.entry),
      exit: Number(form.exit),
      stop: Number(form.stop),
      target: Number(form.target),
      openedAt,
      closedAt: openedAt,
      pnl: Math.round(pnl * 100) / 100,
      fees: 3.5,
      rMultiple: risk ? Math.round((pnl / risk) * 100) / 100 : 0,
      mae: Math.abs(pnl) * 0.35,
      mfe: Math.max(40, Math.abs(pnl) * 1.3),
      playbookId: form.playbookId,
      emotion: form.emotion,
      mistakes: [],
      tags: [form.emotion, "manual"],
      notes: form.notes || "Added by hand.",
      rating: 3,
      reviewed: false,
      session: "New York",
      executions: [
        { time: openedAt, price: Number(form.entry), qty: Number(form.qty), action: form.side === "long" ? "buy" : "sell", kind: "entry" },
        { time: openedAt, price: Number(form.exit), qty: Number(form.qty), action: form.side === "long" ? "sell" : "buy", kind: "exit" },
      ],
      rulesHit: 4,
      rulesTotal: 5,
      source: "manual",
    };
    store.addTrade(trade);
    onClose();
  };
  return (
    <Modal title="Add a trade" onClose={onClose}>
      <div className="pnl-pill" title="Type a dollar P&L, or leave the calculated number">
        <span className="icon-btn" aria-hidden><DollarSign size={16} /></span>
        <div>
          <div className="faint">P&L</div>
          <input
            className={`pnl-edit num ${pnl >= 0 ? "green" : "red"}`}
            inputMode="decimal"
            aria-label="P&L in dollars"
            value={pnlText ?? formatPnlInput(computed)}
            onChange={(e) => setPnlText(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
          />
        </div>
        <span className="faint">{risk ? `${(pnl / risk).toFixed(2)}R` : "Add a stop for R"}</span>
        {pnlEdited && <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPnlText(null)}>Calculated</button>}
      </div>
      <div className="grid-3" style={{ gap: 10 }}>
        <Field label="Symbol"><select value={form.symbol} onChange={(e) => set("symbol", e.target.value)}>{SYMBOLS.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Side">
          <select value={form.side} onChange={(e) => {
            const side = e.target.value as Side;
            const entry = Number(form.entry);
            const sl = pointDistance(entry, Number(form.stop));
            const tp = pointDistance(entry, Number(form.target));
            const long = side === "long";
            const step = SPECS[form.symbol]?.tick ?? 0.01;
            setForm((f) => ({
              ...f,
              side,
              stop: roundToTick(long ? entry - sl : entry + sl, step),
              target: roundToTick(long ? entry + tp : entry - tp, step),
            }));
          }}>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
        </Field>
        <Field label="Qty"><input type="number" value={form.qty} onChange={(e) => set("qty", Number(e.target.value))} /></Field>
        <Field label="Entry"><input type="number" value={form.entry} onChange={(e) => set("entry", Number(e.target.value))} /></Field>
        <Field label="Exit"><input type="number" value={form.exit} onChange={(e) => set("exit", Number(e.target.value))} /></Field>
        <Field label="Stop"><input type="number" value={form.stop} onChange={(e) => set("stop", Number(e.target.value))} /></Field>
        <Field label="Target"><input type="number" value={form.target} onChange={(e) => set("target", Number(e.target.value))} /></Field>
      </div>
      <div className="points-row">
        <Field label="SL points">
          <input type="number" min="0" step={tick} value={slPoints} onChange={(e) => applyPoints("sl", e.target.value)} aria-label="Stop-loss points from entry" />
        </Field>
        <Field label="TP points">
          <input type="number" min="0" step={tick} value={tpPoints} onChange={(e) => applyPoints("tp", e.target.value)} aria-label="Take-profit points from entry" />
        </Field>
      </div>
      <p className="faint">{form.side === "long" ? "Long: stop is below entry, target is above." : "Short: stop is above entry, target is below."} {formatPoints(slPoints)} SL pts · {formatPoints(tpPoints)} TP pts.</p>
      <div className="grid-3" style={{ gap: 10 }}>
        <Field label="Account">
          <select value={form.accountId} onChange={(e) => set("accountId", e.target.value)}>{store.accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        </Field>
        <Field label="Playbook">
          <select value={form.playbookId} onChange={(e) => set("playbookId", e.target.value)}>{store.playbooks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
        </Field>
        <Field label="Date"><input type="date" value={form.date} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="Time (UTC)"><input type="time" value={form.time} onChange={(e) => set("time", e.target.value)} /></Field>
        <Field label="Emotion">
          <select value={form.emotion} onChange={(e) => set("emotion", e.target.value)}>
            {["focused", "calm", "confident", "hesitant", "fomo", "tilt"].map((e) => <option key={e}>{e}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Note"><textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} /></Field>
      <div className="between" style={{ marginTop: 12 }}>
        <div className="row"><DollarSign size={14} /> <b className={pnl >= 0 ? "green" : "red"}>{signedMoney(pnl)}</b></div>
        <button className="btn btn-primary" onClick={save}>Save trade</button>
      </div>
      <p className="faint" style={{ marginTop: 8 }}>Or import a file from Accounts. Sample header: {SAMPLE_CSV.split("\n")[0]}</p>
    </Modal>
  );
}

function StartDay({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const date = "2026-10-22";
  const existing = store.checklists[date];
  const [items, setItems] = useState<string[]>(existing?.items ?? []);
  const [maxLoss, setMaxLoss] = useState(existing?.maxLoss ?? 500);
  const [levels, setLevels] = useState(existing?.levels ?? "");
  const [intention, setIntention] = useState(existing?.intention ?? "");
  const [custom, setCustom] = useState("");
  const toggle = (id: string) => setItems((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  const addPermission = () => {
    const label = custom.trim();
    if (!label) return;
    const id = uid("perm");
    store.addPermission({ id, label });
    setItems((xs) => [...xs, id]);
    setCustom("");
  };
  return (
    <Modal title="Start my day" onClose={onClose}>
      <p className="muted">Write the permissions before the open. The prop desk will use the max loss as your personal circuit breaker.</p>
      <div className="stack" style={{ marginTop: 12 }}>
        {store.permissions.map((item) => (
          <label key={item.id} className="row" style={{ gap: 10 }}>
            <input type="checkbox" checked={items.includes(item.id)} onChange={() => toggle(item.id)} />
            <span className="grow">{item.label}</span>
            <button className="icon-btn" aria-label={`Remove ${item.label}`} onClick={(e) => { e.preventDefault(); store.removePermission(item.id); setItems((xs) => xs.filter((x) => x !== item.id)); }}><X size={12} /></button>
          </label>
        ))}
        <div className="row">
          <input className="perm-input" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Add a permission" onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addPermission(); } }} />
          <button className="icon-btn" title="Add permission" aria-label="Add permission" onClick={addPermission}><Plus size={16} /></button>
        </div>
        <Field label="Max loss today ($)"><input type="number" value={maxLoss} onChange={(e) => setMaxLoss(Number(e.target.value))} /></Field>
        <Field label="Levels"><input value={levels} onChange={(e) => setLevels(e.target.value)} /></Field>
        <Field label="Intention"><input value={intention} onChange={(e) => setIntention(e.target.value)} /></Field>
        <button className="btn btn-primary" onClick={() => {
          store.saveDay({ date, items, maxLoss, levels, journal: existing?.journal ?? "", intention });
          store.toast("Day plan saved");
          onClose();
        }}>Save and open the session</button>
      </div>
    </Modal>
  );
}

function Alerts({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const worst = store.stats.worstHour;
  return (
    <Modal title="Notifications" onClose={onClose}>
      <div className="stack">
        {store.stats.count === 0 && <div className="msg"><b>Journal</b><p className="muted">No fills yet. Add a trade or import a CSV before the agents have anything to read.</p></div>}
        {store.stats.count > 0 && <div className="msg"><b>Risk agent</b><p className="muted">Max drawdown is {store.stats.maxDrawdown.toFixed(0)}. Say the daily loss room out loud before the next click.</p></div>}
        {store.stats.count > 0 && <div className="msg"><b>Habit agent</b><p className="muted">Reviewed rate is {(store.stats.reviewedRate * 100).toFixed(0)}%.</p></div>}
        {store.stats.count > 0 && <div className="msg"><b>Sentiment agent</b><p className="muted">FOMO and tilt trades net {store.stats.tilt.pnl.toFixed(0)} across {store.stats.tilt.count} fills.</p></div>}
        {worst && <div className="msg"><b>Time</b><p className="muted">{worst.label} ET is negative ({worst.net.toFixed(0)}).</p></div>}
        <p className="faint">{store.lastImport ? `Last import ${new Date(store.lastImport).toLocaleString()} · ` : ""}{store.connected.length} connections in this browser</p>
      </div>
    </Modal>
  );
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useStore();
  const nav = useNavigate();
  useEffect(() => {
    if (!user) nav("/login");
  }, [user, nav]);
  if (!user) return null;
  return <>{children}</>;
}
