import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { PLAYBOOKS, SPACES } from "../lib/content";
import { etDate, formatEt, holdLabel, money, pct, priceFmt, signedMoney, uid } from "../lib/format";
import { candlesForTrade, riskDollars } from "../lib/market";
import { dayAdherence } from "../lib/stats";
import { useStore } from "../lib/store";
import type { Trade } from "../lib/types";
import { CandleChart } from "../components/Charts";
import { MonthCalendar } from "../components/Calendar";
import { Field, Modal } from "../components/Ui";

export function DayView() {
  const { date: param } = useParams();
  const store = useStore();
  const date = param || "2026-10-21";
  const [month, setMonth] = useState(date.slice(0, 7));
  const trades = store.filtered.filter((t) => etDate(t.openedAt) === date);
  const pnl = trades.reduce((s, t) => s + t.pnl, 0);
  const plan = store.checklists[date] ?? { date, items: [], maxLoss: 500, levels: "", journal: "", intention: "" };
  const [journal, setJournal] = useState(plan.journal);
  useEffect(() => { setJournal(plan.journal); }, [date, plan.journal]);
  const adherence = dayAdherence(store.trades, date);
  const monthNet = store.stats.daily.filter((d) => d.date.startsWith(month)).reduce((s, d) => s + d.pnl, 0);

  return (
    <div className="stack day-view">
      <MonthCalendar month={month} setMonth={setMonth} daily={store.stats.daily} monthNet={monthNet} />
      <div className="between">
        <div>
          <h2>{date}</h2>
          <div className={pnl >= 0 ? "green" : "red"} style={{ fontSize: 28, fontWeight: 700 }}>{signedMoney(pnl)}</div>
          <div className="muted">{trades.length} trades · day score {pct(adherence.score)}</div>
        </div>
        <button className="btn btn-primary" onClick={() => {
          store.saveDay({ ...plan, journal });
          store.addNote({ id: uid("n"), folder: "Reviews", title: `Session ${date}`, body: journal || `${date} closed ${signedMoney(pnl)} on ${trades.length} trades.`, updatedAt: new Date().toISOString(), template: "daily" });
          store.toast("End-of-day note filed");
        }}>File the day</button>
      </div>
      <div className="card">
        <h3>Session note</h3>
        <textarea className="note-editor" style={{ minHeight: 120 }} value={journal} onChange={(e) => setJournal(e.target.value)} placeholder="What was the decision, not the feeling?" />
        <div className="faint">Intention: {plan.intention || "—"} · Max loss {money(plan.maxLoss)} · Levels {plan.levels || "—"}</div>
        <div className="chips" style={{ marginTop: 8 }}>
          {store.permissions.map((c) => <span key={c.id} className={`chip ${plan.items.includes(c.id) ? "on" : ""}`}>{c.label}</span>)}
        </div>
      </div>
      <div className="card">
        <h3>Rules that day</h3>
        {adherence.rules.map((r) => (
          <div key={r.id} className="between" style={{ padding: "6px 0", borderBottom: "1px solid var(--line)" }}>
            <span>{r.label}</span>
            <span className={r.pass ? "green" : "red"}>{r.pass ? "Pass" : "Miss"}</span>
          </div>
        ))}
      </div>
      {trades.map((t) => (
        <Link key={t.id} to={`/app/trades/${t.id}`} className="card">
          <div className="between">
            <b>{t.symbol} <span className={t.side === "long" ? "green" : "red"}>{t.side}</span></b>
            <span className={t.pnl >= 0 ? "green" : "red"}>{signedMoney(t.pnl)} · {t.rMultiple.toFixed(2)}R</span>
          </div>
          <div className="muted">{formatEt(t.openedAt)} · {PLAYBOOKS.find((p) => p.id === t.playbookId)?.name} · {t.emotion}</div>
          <div>{t.notes}</div>
        </Link>
      ))}
      {!trades.length && <div className="card muted">No fills this session. Flat is a position.</div>}
    </div>
  );
}

export function Trades() {
  const store = useStore();
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"date" | "pnl" | "r">("date");
  const rows = useMemo(() => {
    let list = store.filtered.filter((t) => `${t.symbol} ${t.notes} ${t.emotion} ${t.playbookId}`.toLowerCase().includes(q.toLowerCase()));
    list = [...list].sort((a, b) => sort === "pnl" ? b.pnl - a.pnl : sort === "r" ? b.rMultiple - a.rMultiple : b.openedAt.localeCompare(a.openedAt));
    return list;
  }, [store.filtered, q, sort]);
  const tags = [...new Set(store.trades.flatMap((t) => [...t.tags, t.emotion, ...t.mistakes]))].slice(0, 18);

  return (
    <div className="stack">
      <div className="between">
        <input className="search" style={{ padding: 8 }} placeholder="Filter symbol, note, emotion" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="row">
          <select className="btn btn-ghost btn-sm" value={store.filters.playbook} onChange={(e) => store.setFilters({ playbook: e.target.value })}>
            <option value="all">All playbooks</option>
            {store.playbooks.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="btn btn-ghost btn-sm" value={store.filters.side} onChange={(e) => store.setFilters({ side: e.target.value as never })}>
            <option value="all">Both sides</option>
            <option value="long">Long</option>
            <option value="short">Short</option>
          </select>
          <select className="btn btn-ghost btn-sm" value={sort} onChange={(e) => setSort(e.target.value as never)}>
            <option value="date">Newest</option>
            <option value="pnl">P&L</option>
            <option value="r">R</option>
          </select>
        </div>
      </div>
      <div className="chips">
        <button className={`chip ${store.filters.tag === "all" ? "on" : ""}`} onClick={() => store.setFilters({ tag: "all" })}>All tags</button>
        {tags.map((t) => <button key={t} className={`chip ${store.filters.tag === t ? "on" : ""}`} onClick={() => store.setFilters({ tag: t })}>{t}</button>)}
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Opened</th><th>Symbol</th><th>Side</th><th>Playbook</th><th>Qty</th><th>Entry</th><th>Exit</th><th>P&L</th><th>R</th><th>Hold</th><th>Emotion</th><th>Rating</th></tr>
          </thead>
          <tbody>
            {rows.slice(0, 200).map((t) => (
              <tr key={t.id} className="click" onClick={() => nav(`/app/trades/${t.id}`)}>
                <td>{etDate(t.openedAt)} {formatEt(t.openedAt)}</td>
                <td>{t.symbol}</td>
                <td className={t.side === "long" ? "green" : "red"}>{t.side}</td>
                <td>{PLAYBOOKS.find((p) => p.id === t.playbookId)?.name ?? t.playbookId}</td>
                <td className="num">{t.qty}</td>
                <td className="num">{priceFmt(t.symbol, t.entry)}</td>
                <td className="num">{priceFmt(t.symbol, t.exit)}</td>
                <td className={`num ${t.pnl >= 0 ? "green" : "red"}`}>{signedMoney(t.pnl)}</td>
                <td className="num">{t.rMultiple.toFixed(2)}</td>
                <td>{holdLabel((Date.parse(t.closedAt) - Date.parse(t.openedAt)) / 60000)}</td>
                <td>{t.emotion}</td>
                <td>{"★".repeat(t.rating)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="faint">{rows.length} trades in the filter.</div>
    </div>
  );
}

export function TradeDetail() {
  const { id } = useParams();
  const store = useStore();
  const nav = useNavigate();
  const trade = store.trades.find((t) => t.id === id);
  const [share, setShare] = useState(false);
  const [space, setSpace] = useState(SPACES[0].id);
  const [tag, setTag] = useState("");
  const [editingPnl, setEditingPnl] = useState(false);
  const [pnlDraft, setPnlDraft] = useState("");
  const skipPnlSave = useRef(false);
  if (!trade) return <div className="card">Trade not found.</div>;
  const candles = candlesForTrade(trade);
  const entryAt = 18;
  const exitAt = 60;
  const efficiency = trade.mfe > 0 ? Math.max(0, trade.pnl) / trade.mfe : 0;
  const pb = PLAYBOOKS.find((p) => p.id === trade.playbookId);

  const patch = (p: Partial<Trade>) => store.updateTrade(trade.id, p);
  const savePnl = () => {
    if (skipPnlSave.current) {
      skipPnlSave.current = false;
      setEditingPnl(false);
      return;
    }
    const n = Number(pnlDraft.replace(/[$,+\s]/g, ""));
    if (Number.isFinite(n)) {
      const risk = riskDollars(trade.symbol, trade.qty, trade.entry, trade.stop);
      patch({ pnl: Math.round(n * 100) / 100, rMultiple: risk ? Math.round((n / risk) * 100) / 100 : trade.rMultiple });
    }
    setEditingPnl(false);
  };

  return (
    <div className="stack">
      <div className="between">
        <div>
          <div className="row">
            <h2>{trade.symbol}</h2>
            <span className={`badge ${trade.side}`}>{trade.side}</span>
            <span className="badge">{trade.source}</span>
          </div>
          {editingPnl ? (
            <form className="row" onSubmit={(e) => { e.preventDefault(); savePnl(); }}>
              <input
                className={`pnl-edit ${Number(pnlDraft) < 0 ? "red" : "green"}`}
                autoFocus
                aria-label="Edit P&L"
                value={pnlDraft}
                onChange={(e) => setPnlDraft(e.target.value)}
                onBlur={savePnl}
                onKeyDown={(e) => { if (e.key === "Escape") { skipPnlSave.current = true; setEditingPnl(false); } }}
              />
            </form>
          ) : (
            <button type="button" title="Edit P&L" className={trade.pnl >= 0 ? "green" : "red"} style={{ fontSize: 32, fontWeight: 720, background: "transparent", border: 0, padding: 0, cursor: "text" }} onClick={() => { setPnlDraft(String(trade.pnl)); setEditingPnl(true); }}>
              {signedMoney(trade.pnl)} <span style={{ fontSize: 16 }}>{trade.rMultiple.toFixed(2)}R</span>
            </button>
          )}
          <div className="muted">{formatEt(trade.openedAt, true)} → {formatEt(trade.closedAt)} · {pb?.name}</div>
        </div>
        <div className="row wrap">
          <button className={`btn btn-sm ${trade.reviewed ? "btn-primary" : "btn-ghost"}`} onClick={() => patch({ reviewed: !trade.reviewed })}>{trade.reviewed ? "Reviewed" : "Mark reviewed"}</button>
          <Link className="btn btn-ghost btn-sm" to={`/app/replay/${trade.id}`}>Replay</Link>
          <button className="btn btn-ghost btn-sm" onClick={() => setShare(true)}>Share</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { store.deleteTrade(trade.id); nav("/app/trades"); }}>Delete</button>
        </div>
      </div>
      <div className="card">
        <CandleChart
          candles={candles}
          height={340}
          lines={[
            { price: trade.entry, color: "#7c6bf6", label: "Entry" },
            { price: trade.exit, color: "#3dd68c", label: "Exit" },
            { price: trade.stop, color: "#ff6b7d", label: "Stop" },
            { price: trade.target, color: "#f0b429", label: "Target" },
          ]}
          markers={[{ index: entryAt, label: "In", color: "#7c6bf6" }, { index: exitAt, label: "Out", color: "#3dd68c" }]}
        />
      </div>
      <div className="grid-4">
        {[
          ["Entry", priceFmt(trade.symbol, trade.entry)],
          ["Exit", priceFmt(trade.symbol, trade.exit)],
          ["Stop", priceFmt(trade.symbol, trade.stop)],
          ["Target", priceFmt(trade.symbol, trade.target)],
          ["Qty", String(trade.qty)],
          ["Fees", money(trade.fees)],
          ["MAE", money(trade.mae)],
          ["MFE", money(trade.mfe)],
          ["Exit efficiency", pct(efficiency)],
          ["Planned R", trade.rMultiple.toFixed(2)],
          ["Rules", `${trade.rulesHit}/${trade.rulesTotal}`],
          ["Account", trade.accountId.toUpperCase()],
        ].map(([k, v]) => (
          <div key={k} className="metric"><span className="faint">{k}</span><b className="num">{v}</b></div>
        ))}
      </div>
      <div className="product-grid">
        <div className="card">
          <h3>Note</h3>
          <textarea className="note-editor" style={{ minHeight: 140 }} value={trade.notes} onChange={(e) => patch({ notes: e.target.value })} />
          <div className="row" style={{ marginTop: 8 }}>
            <span className="muted">Rating</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} className="icon-btn" onClick={() => patch({ rating: n })} style={{ color: n <= trade.rating ? "var(--amber)" : "var(--faint)" }}>★</button>
            ))}
          </div>
          <div className="row" style={{ marginTop: 8 }}>
            <input placeholder="Add a tag" value={tag} onChange={(e) => setTag(e.target.value)} onKeyDown={(e) => {
              if (e.key === "Enter" && tag.trim()) { patch({ tags: [...trade.tags, tag.trim()] }); setTag(""); }
            }} />
          </div>
          <div className="chips" style={{ marginTop: 8 }}>
            {trade.tags.map((t) => <button key={t} className="chip" onClick={() => patch({ tags: trade.tags.filter((x) => x !== t) })}>{t} ×</button>)}
          </div>
        </div>
        <div className="card">
          <h3>Executions</h3>
          <table>
            <tbody>
              {trade.executions.map((ex, i) => (
                <tr key={i}><td>{ex.kind}</td><td>{ex.action}</td><td className="num">{priceFmt(trade.symbol, ex.price)}</td><td>{ex.qty}</td></tr>
              ))}
            </tbody>
          </table>
          <h3 style={{ marginTop: 12 }}>Mistakes</h3>
          <div className="chips">
            {["early exit", "late entry", "oversized", "chased", "revenge", "moved stop", "traded news"].map((m) => (
              <button key={m} className={`chip ${trade.mistakes.includes(m) ? "on" : ""}`} onClick={() => patch({ mistakes: trade.mistakes.includes(m) ? trade.mistakes.filter((x) => x !== m) : [...trade.mistakes, m] })}>{m}</button>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 10 }}>Best-exit read: the trade traveled {money(trade.mfe)} in your favor and you kept {money(Math.max(0, trade.pnl))}. Adverse excursion {money(trade.mae)}.</p>
        </div>
      </div>
      {share && (
        <Modal title="Share into a space" onClose={() => setShare(false)}>
          <Field label="Room">
            <select value={space} onChange={(e) => setSpace(e.target.value)}>{SPACES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          </Field>
          <div className="card" style={{ margin: "12px 0" }}>
            <b>{trade.symbol} {trade.side}</b>
            <div className={trade.pnl >= 0 ? "green" : "red"}>{signedMoney(trade.pnl)}</div>
            <div className="muted">{trade.notes}</div>
          </div>
          <button className="btn btn-primary" onClick={() => {
            store.postMessage(space, trade.notes || `${trade.symbol} ${trade.side}`, { symbol: trade.symbol, pnl: trade.pnl });
            store.toast("Shared to the space");
            setShare(false);
          }}>Post</button>
        </Modal>
      )}
    </div>
  );
}

const TEMPLATES = [
  { id: "premarket", title: "Pre-market", folder: "Pre-market", body: "Bias:\nLevels:\nNews:\nMax loss:\nAllowed:\nBenched:\nDone when:\n" },
  { id: "weekly", title: "Weekly recap", folder: "Reviews", body: "Net:\nWhat paid:\nWhat donated:\nRule for next week:\n" },
  { id: "trade", title: "Trade review", folder: "Reviews", body: "Setup:\nDid I follow it:\nMAE / MFE:\nOne change:\n" },
];

export function Notebook() {
  const store = useStore();
  const folders = [...new Set(store.notes.map((n) => n.folder))];
  const [folder, setFolder] = useState<string>("All");
  const [id, setId] = useState(store.notes[0]?.id ?? "");
  const note = store.notes.find((n) => n.id === id) ?? store.notes[0];
  const list = store.notes.filter((n) => folder === "All" || n.folder === folder);
  return (
    <div className="split">
      <div className="card">
        <div className="between">
          <b>Notebook</b>
          <button className="btn btn-sm btn-primary" onClick={() => {
            const n = { id: uid("n"), folder: "Reviews", title: "Untitled", body: "", updatedAt: new Date().toISOString() };
            store.addNote(n);
            setId(n.id);
          }}>New</button>
        </div>
        <div className="chips" style={{ margin: "8px 0" }}>
          <button className={`chip ${folder === "All" ? "on" : ""}`} onClick={() => setFolder("All")}>All</button>
          {folders.map((f) => <button key={f} className={`chip ${folder === f ? "on" : ""}`} onClick={() => setFolder(f)}>{f}</button>)}
        </div>
        {list.map((n) => (
          <button key={n.id} className={`list-btn ${n.id === note?.id ? "on" : ""}`} onClick={() => setId(n.id)}>
            <b>{n.title}</b>
            <div className="faint">{n.folder}</div>
          </button>
        ))}
        <div className="nav-label">Templates</div>
        {TEMPLATES.map((t) => (
          <button key={t.id} className="list-btn" onClick={() => {
            const n = { id: uid("n"), folder: t.folder, title: t.title, body: t.body, updatedAt: new Date().toISOString(), template: t.id };
            store.addNote(n);
            setId(n.id);
          }}>+ {t.title}</button>
        ))}
      </div>
      {note && (
        <div className="card">
          <input style={{ fontSize: 24, fontWeight: 700, background: "transparent", border: 0, width: "100%", outline: "none" }} value={note.title} onChange={(e) => store.updateNote(note.id, { title: e.target.value })} />
          <div className="faint">{note.folder} · {new Date(note.updatedAt).toLocaleString()}</div>
          <textarea className="note-editor" value={note.body} onChange={(e) => store.updateNote(note.id, { body: e.target.value })} />
          <button className="btn btn-ghost btn-sm" onClick={() => store.deleteNote(note.id)}>Delete note</button>
        </div>
      )}
    </div>
  );
}
