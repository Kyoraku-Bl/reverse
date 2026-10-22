import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { PLAYBOOKS } from "../lib/content";
import { money, pct, signedMoney, uid } from "../lib/format";
import { dayAdherence, metricCards, type GroupStat } from "../lib/stats";
import { useStore } from "../lib/store";
import { Bars, EquityChart } from "../components/Charts";
import { Field } from "../components/Ui";

export function Reports() {
  const store = useStore();
  const cards = metricCards(store.stats);
  const groups = ["All", ...new Set(cards.map((c) => c.group))];
  const [group, setGroup] = useState("All");
  const [q, setQ] = useState("");
  const shown = cards.filter((c) => (group === "All" || c.group === group) && c.label.toLowerCase().includes(q.toLowerCase()));
  return (
    <div className="stack">
      <div className="between">
        <div>
          <h2 style={{ fontSize: 20 }}>50+ reports, computed from this filter</h2>
          <p className="muted">Change account, range, or tag in the top bar. Every number below moves with it.</p>
        </div>
        <input placeholder="Search reports" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="chips">{groups.map((g) => <button key={g} className={`chip ${group === g ? "on" : ""}`} onClick={() => setGroup(g)}>{g}</button>)}</div>
      <div className="chips">
        {["overview", "time", "symbols", "playbooks", "behavior", "risk", "duration", "cross"].map((id) => (
          <Link key={id} to={`/app/reports/${id}`} className="btn btn-ghost btn-sm">{id}</Link>
        ))}
      </div>
      <div className="metric-grid">
        {shown.map((c) => (
          <div key={c.id} className="metric">
            <span className="faint">{c.group}</span>
            <b className={c.tone === "good" ? "green" : c.tone === "bad" ? "red" : ""}>{c.value}</b>
            <div>{c.label}</div>
            <div className="faint">{c.hint}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ReportDetail() {
  const { id = "overview" } = useParams();
  const s = useStore().stats;
  const block = (title: string, rows: GroupStat[]) => (
    <div className="card">
      <h3>{title}</h3>
      <Bars data={rows.slice(0, 10).map((r) => ({ label: r.label, value: r.net }))} />
      <table>
        <thead><tr><th>Name</th><th>Trades</th><th>Win %</th><th>Avg R</th><th>PF</th><th>Net</th></tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key}><td>{r.label}</td><td>{r.count}</td><td>{pct(r.winRate)}</td><td>{r.avgR.toFixed(2)}</td><td>{r.profitFactor.toFixed(2)}</td><td className={r.net >= 0 ? "green" : "red"}>{signedMoney(r.net)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  return (
    <div className="stack">
      <Link to="/app/reports" className="faint">← All reports</Link>
      <h2 style={{ textTransform: "capitalize" }}>{id} report</h2>
      {id === "overview" && (
        <>
          <div className="card"><h3>Equity</h3><EquityChart data={s.equity} /></div>
          <div className="card"><h3>Drawdown</h3><Bars data={s.drawdownSeries.slice(-24).map((d) => ({ label: d.date.slice(5), value: d.dd }))} /></div>
          <div className="card"><h3>R distribution</h3><Bars data={s.rDistribution.map((b) => ({ label: b.bucket, value: b.count }))} /></div>
          <div className="card">
            <h3>Months</h3>
            {s.monthly.map((m) => (
              <div key={m.month} className="between"><span>{m.month}</span><span>{m.trades} trades · {pct(m.winRate)}</span><b className={m.pnl >= 0 ? "green" : "red"}>{signedMoney(m.pnl)}</b></div>
            ))}
          </div>
        </>
      )}
      {id === "time" && block("Hour", s.byHour)}
      {id === "time" && block("Weekday", s.byWeekday)}
      {id === "time" && block("Session", s.bySession)}
      {id === "symbols" && block("Symbol", s.bySymbol)}
      {id === "playbooks" && block("Playbook", s.byPlaybook.map((p) => ({ ...p, label: PLAYBOOKS.find((x) => x.id === p.key)?.name ?? p.label })))}
      {id === "behavior" && (
        <>
          {block("Emotion", s.byEmotion)}
          {block("Mistake", s.byMistake)}
          <div className="card">
            <h3>Sequences</h3>
            <p>After a winner: {pct(s.afterWin.winRate)} ({s.afterWin.count}) · {signedMoney(s.afterWin.pnl)}</p>
            <p>After a loser: {pct(s.afterLoss.winRate)} ({s.afterLoss.count}) · {signedMoney(s.afterLoss.pnl)}</p>
            <p>Reviewed {pct(s.reviewedRate)} · average rating {s.avgRating.toFixed(1)} · adherence {pct(s.adherence)}</p>
          </div>
        </>
      )}
      {id === "risk" && (
        <div className="grid-3">
          <div className="metric"><span className="faint">Max DD</span><b className="red">{money(s.maxDrawdown)}</b></div>
          <div className="metric"><span className="faint">Exit efficiency</span><b>{pct(s.exitEfficiency)}</b></div>
          <div className="metric"><span className="faint">Left on table</span><b>{money(s.leftOnTable)}</b></div>
          <div className="metric"><span className="faint">Avg MAE</span><b>{money(s.avgMae)}</b></div>
          <div className="metric"><span className="faint">Avg MFE</span><b>{money(s.avgMfe)}</b></div>
          <div className="metric"><span className="faint">Sharpe</span><b>{s.sharpe.toFixed(2)}</b></div>
        </div>
      )}
      {id === "duration" && block("Hold time", s.byDuration)}
      {id === "cross" && (
        <div className="card">
          <h3>Playbook × session</h3>
          <p className="muted">Each cell is net P&L. This is the cross-cut a spreadsheet makes you build by hand.</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Playbook</th>{[...new Set(s.trades.map((t) => t.session))].map((ses) => <th key={ses}>{ses}</th>)}</tr>
              </thead>
              <tbody>
                {PLAYBOOKS.map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    {[...new Set(s.trades.map((t) => t.session))].map((ses) => {
                      const net = s.trades.filter((t) => t.playbookId === p.id && t.session === ses).reduce((sum, t) => sum + t.pnl, 0);
                      return <td key={ses} className={net >= 0 ? "green" : "red"}>{signedMoney(net)}</td>;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export function Strategies() {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [rule, setRule] = useState("");
  return (
    <div className="stack">
      <div className="between">
        <div>
          <h2 style={{ fontSize: 20 }}>Playbooks</h2>
          <p className="muted">A setup is not real until it can be failed in the tags.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setOpen((v) => !v)}>New playbook</button>
      </div>
      {open && (
        <div className="card">
          <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="First rule"><input value={rule} onChange={(e) => setRule(e.target.value)} /></Field>
          <button className="btn btn-primary" onClick={() => {
            if (!name.trim()) return;
            store.addPlaybook({ id: uid("pb"), name, market: "Custom", color: "#7c6bf6", description: rule || "Custom playbook", createdAt: new Date().toISOString(), rules: [{ id: uid("r"), text: rule || "Write the rule you can violate." }] });
            setName(""); setRule(""); setOpen(false);
            store.toast("Playbook created");
          }}>Save</button>
        </div>
      )}
      <div className="grid-3">
        {store.playbooks.map((p) => {
          const rows = store.stats.byPlaybook.find((r) => r.key === p.id);
          const net = rows?.net ?? 0;
          return (
            <Link key={p.id} to={`/app/strategies/${p.id}`} className="card">
              <div className="row"><i style={{ width: 8, height: 8, borderRadius: 99, background: p.color }} /> <b>{p.name}</b></div>
              <p className="muted">{p.description}</p>
              <div className="between" style={{ marginTop: 8 }}>
                <span className={net >= 0 ? "green" : "red"}>{signedMoney(net)}</span>
                <span className="faint">{rows ? `${rows.count} · ${pct(rows.winRate)} · ${rows.avgR.toFixed(2)}R` : "No fills yet"}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function StrategyDetail() {
  const { id = "" } = useParams();
  const store = useStore();
  const pb = store.playbooks.find((p) => p.id === id);
  const [tab, setTab] = useState("stats");
  const trades = store.filtered.filter((t) => t.playbookId === id);
  const [cutHour, setCutHour] = useState(true);
  const [cutTilt, setCutTilt] = useState(true);
  const [cutNews, setCutNews] = useState(false);
  const scenario = useMemo(() => {
    return trades.filter((t) => {
      const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hourCycle: "h23" }).format(new Date(t.openedAt)));
      if (cutHour && hour >= 15) return false;
      if (cutTilt && (t.emotion === "tilt" || t.emotion === "fomo")) return false;
      if (cutNews && t.playbookId === "news-fade") return false;
      return true;
    });
  }, [trades, cutHour, cutTilt, cutNews]);
  if (!pb) return <div>Missing playbook.</div>;
  const net = trades.reduce((s, t) => s + t.pnl, 0);
  const alt = scenario.reduce((s, t) => s + t.pnl, 0);
  const equity = trades.reduce<{ date: string; equity: number }[]>((acc, t) => {
    const last = acc[acc.length - 1]?.equity ?? 0;
    acc.push({ date: t.openedAt.slice(0, 10), equity: last + t.pnl });
    return acc;
  }, []);
  return (
    <div className="stack">
      <Link to="/app/strategies" className="faint">← Strategies</Link>
      <div className="between">
        <div>
          <h2>{pb.name}</h2>
          <p className="muted">{pb.description}</p>
        </div>
        <b className={net >= 0 ? "green" : "red"} style={{ fontSize: 28 }}>{signedMoney(net)}</b>
      </div>
      <div className="tabs">
        {["stats", "rules", "trades", "scenarios", "notes"].map((t) => (
          <button key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{t}</button>
        ))}
      </div>
      {tab === "stats" && (
        <>
          <div className="card"><EquityChart data={equity.length > 1 ? equity : [{ date: "0", equity: 0 }, { date: "1", equity: net }]} /></div>
          <div className="grid-4">
            <div className="metric"><span className="faint">Trades</span><b>{trades.length}</b></div>
            <div className="metric"><span className="faint">Win rate</span><b>{pct(trades.length ? trades.filter((t) => t.pnl > 0).length / trades.length : 0)}</b></div>
            <div className="metric"><span className="faint">Avg R</span><b>{(trades.reduce((s, t) => s + t.rMultiple, 0) / (trades.length || 1)).toFixed(2)}</b></div>
            <div className="metric"><span className="faint">Avg hold</span><b>{Math.round(trades.reduce((s, t) => s + (Date.parse(t.closedAt) - Date.parse(t.openedAt)) / 60000, 0) / (trades.length || 1))}m</b></div>
          </div>
        </>
      )}
      {tab === "rules" && (
        <div className="card">
          {pb.rules.map((r, i) => <div key={r.id} className="between" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}><span>{i + 1}. {r.text}</span></div>)}
          <Field label="Add a rule">
            <input onKeyDown={(e) => {
              if (e.key === "Enter") {
                const text = (e.target as HTMLInputElement).value.trim();
                if (!text) return;
                store.updatePlaybook(pb.id, { rules: [...pb.rules, { id: uid("r"), text }] });
                (e.target as HTMLInputElement).value = "";
              }
            }} />
          </Field>
        </div>
      )}
      {tab === "trades" && (
        <div className="table-wrap">
          <table>
            <tbody>
              {trades.slice(0, 40).map((t) => (
                <tr key={t.id} className="click" onClick={() => (window.location.assign(`${import.meta.env.BASE_URL}#/app/trades/${t.id}`))}>
                  <td>{t.openedAt.slice(0, 10)}</td><td>{t.symbol}</td><td className={t.pnl >= 0 ? "green" : "red"}>{signedMoney(t.pnl)}</td><td>{t.rMultiple.toFixed(2)}R</td><td>{t.notes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {tab === "scenarios" && (
        <div className="card">
          <h3>If you had refused these</h3>
          <label className="row"><input type="checkbox" checked={cutHour} onChange={(e) => setCutHour(e.target.checked)} /> Skip 15:00 ET and later</label>
          <label className="row"><input type="checkbox" checked={cutTilt} onChange={(e) => setCutTilt(e.target.checked)} /> Skip tilt and FOMO</label>
          <label className="row"><input type="checkbox" checked={cutNews} onChange={(e) => setCutNews(e.target.checked)} /> Skip news fade</label>
          <p style={{ marginTop: 12 }}>Actual {signedMoney(net)} · scenario {signedMoney(alt)} · delta <b className={alt - net >= 0 ? "green" : "red"}>{signedMoney(alt - net)}</b></p>
          <p className="muted">{trades.length - scenario.length} trades removed. This is a cut of history, not a promise the future repeats it.</p>
        </div>
      )}
      {tab === "notes" && <p className="muted">{pb.market}. Created {pb.createdAt.slice(0, 10)}. Keep the rules specific enough to violate.</p>}
    </div>
  );
}

export function Progress() {
  const store = useStore();
  const days = store.stats.daily.slice(-80);
  const cells = days.map((d) => dayAdherence(store.trades, d.date));
  const today = dayAdherence(store.trades, "2026-10-21");
  return (
    <div className="stack">
      <div className="grid-3">
        <div className="card"><div className="faint">Latest session score</div><div className="kpi val">{pct(today.score)}</div><div className="muted">{today.passed} / {today.rules.length} rules</div></div>
        <div className="card"><div className="faint">Book adherence</div><div className="kpi val">{pct(store.stats.adherence)}</div><div className="muted">Average playbook rules hit</div></div>
        <div className="card"><div className="faint">Reviewed</div><div className="kpi val">{pct(store.stats.reviewedRate)}</div><div className="muted">Trades you actually went back to</div></div>
      </div>
      <div className="card">
        <h3>Consistency heatmap</h3>
        <p className="muted">Darker violet means more rules held that day. This is process, not P&L.</p>
        <div className="heat" style={{ marginTop: 10 }}>
          {cells.map((c, i) => (
            <i key={days[i].date} title={`${days[i].date} ${pct(c.score)}`} style={{ background: `rgba(124,107,246,${0.15 + c.score * 0.85})` }} />
          ))}
        </div>
      </div>
      <div className="card">
        {today.rules.map((r) => (
          <div key={r.id} className="between" style={{ padding: "8px 0", borderBottom: "1px solid var(--line)" }}>
            <div><b>{r.label}</b><div className="faint">{r.detail}</div></div>
            <span className={r.pass ? "green" : "red"}>{r.pass ? "Held" : "Slipped"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
