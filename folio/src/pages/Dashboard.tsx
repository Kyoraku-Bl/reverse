import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PLAYBOOKS } from "../lib/content";
import { compactMoney, money, pct, signedMoney, viewValue } from "../lib/format";
import { propSnapshots } from "../lib/stats";
import { useStore } from "../lib/store";
import { Bars, EquityChart, Gauge, HSplit, Radar, Ring } from "../components/Charts";
import { MonthCalendar } from "../components/Calendar";

export function Dashboard() {
  const store = useStore();
  const nav = useNavigate();
  const s = store.stats;
  const [month, setMonth] = useState("2026-10");
  const monthNet = s.daily.filter((d) => d.date.startsWith(month)).reduce((sum, d) => sum + d.pnl, 0);
  const view = store.filters.view;
  const recent = s.trades.slice(-6).reverse();
  const props = useMemo(() => propSnapshots(store.filtered), [store.filtered]);
  const w = store.widgets;

  return (
    <div>
      <div className="between" style={{ marginBottom: 10 }}>
        <div className="muted" style={{ fontSize: 13 }}>
          {store.trades.length === 0
            ? "No trades yet. Add a fill or import a CSV."
            : `${store.lastImport ? `Last import ${new Date(store.lastImport).toLocaleString()} · ` : ""}${store.connected.length} connections`}
        </div>
        <details>
          <summary className="faint" style={{ cursor: "pointer" }}>Widgets</summary>
          <div className="chips" style={{ marginTop: 6 }}>
            {Object.keys(w).map((k) => (
              <button key={k} className={`chip ${w[k] ? "on" : ""}`} onClick={() => store.setWidgets({ [k]: !w[k] })}>{k}</button>
            ))}
          </div>
        </details>
      </div>
      {w.kpis && (
        <div className="kpis">
          <div className="card kpi">
            <div className="between"><span className="muted">Net P&L</span><span className="faint">{s.count} trades</span></div>
            <div className={`val num ${s.net >= 0 ? "green" : "red"}`}>{viewValue(s.net, view, store.base, s.avgRisk)}</div>
            <div className="sub">Fees {money(s.fees)} · gross {signedMoney(s.grossProfit)}</div>
          </div>
          <div className="card kpi">
            <div className="between"><span className="muted">Trade win %</span><Gauge value={s.winRate * 100} /></div>
            <div className="val num">{pct(s.winRate)}</div>
            <div className="row" style={{ marginTop: 6 }}>
              <span className="badge good">{s.wins}</span>
              <span className="badge">{s.breakeven}</span>
              <span className="badge bad">{s.losses}</span>
            </div>
          </div>
          <div className="card kpi">
            <div className="muted">Avg win / loss</div>
            <div className="val num">{s.avgWinLoss.toFixed(2)}</div>
            <HSplit win={s.avgWin} loss={s.avgLoss} />
            <div className="sub"><span className="green">{money(s.avgWin)}</span> · <span className="red">-{money(s.avgLoss)}</span></div>
          </div>
          <div className="card kpi">
            <div className="between"><span className="muted">Profit factor</span><Ring value={Math.min(1, s.profitFactor / 3)} label={s.profitFactor.toFixed(2)} /></div>
            <div className="val num">{s.profitFactor.toFixed(2)}</div>
            <div className="sub">Expectancy {money(s.expectancy)}</div>
          </div>
          <div className="card kpi">
            <div className="muted">Current streak</div>
            <div className="row" style={{ marginTop: 8, justifyContent: "space-between" }}>
              <div>
                <Ring value={Math.min(1, s.dayStreak.count / 5)} label={String(s.dayStreak.count)} />
                <div className="faint">Days · best {s.bestDayStreak}</div>
              </div>
              <div>
                <Ring value={Math.min(1, s.tradeStreak.count / 6)} label={String(s.tradeStreak.count)} />
                <div className="faint">Trades · {s.tradeStreak.type}</div>
              </div>
            </div>
          </div>
        </div>
      )}
      <div className="dash">
        <div className="stack">
          {w.equity && (
            <div className="card">
              <div className="between"><h3>Daily net cumulative P&L</h3><span className="faint">{s.tradingDays} sessions</span></div>
              <EquityChart data={s.equity} />
            </div>
          )}
          {w.score && (
            <div className="card">
              <div className="between"><h3>Folio Score</h3><b className="num">{s.folioScore.toFixed(1)}</b></div>
              <Radar parts={s.scoreParts} />
              <div className="progress"><span style={{ width: `${s.folioScore}%`, background: "linear-gradient(90deg,#ff6b7d,#f0b429,#3dd68c)" }} /></div>
            </div>
          )}
          {w.daily && (
            <div className="card">
              <h3>Net daily P&L</h3>
              <div className="bars" style={{ marginTop: 8 }}>
                {s.daily.slice(-28).map((d) => (
                  <i key={d.date} title={`${d.date} ${money(d.pnl)}`} style={{ height: `${Math.max(4, (Math.abs(d.pnl) / (Math.max(...s.daily.map((x) => Math.abs(x.pnl))) || 1)) * 100)}%`, background: d.pnl >= 0 ? "#3dd68c" : "#ff6b7d" }} />
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="stack">
          {w.calendar && <MonthCalendar month={month} setMonth={setMonth} daily={s.daily} monthNet={monthNet} />}
          <div className="dash" style={{ gridTemplateColumns: "1.2fr 0.8fr", marginTop: 0 }}>
            <div className="card">
              <div className="between"><h3>Recent trades</h3><Link to="/app/trades" className="faint">All</Link></div>
              <table>
                <tbody>
                  {recent.length === 0 && (
                    <tr><td className="muted">No trades yet.</td></tr>
                  )}
                  {recent.map((t) => (
                    <tr key={t.id} className="click" onClick={() => nav(`/app/trades/${t.id}`)}>
                      <td>{t.symbol}<div className="faint">{PLAYBOOKS.find((p) => p.id === t.playbookId)?.name}</div></td>
                      <td className={t.side === "long" ? "green" : "red"}>{t.side}</td>
                      <td className={`num ${t.pnl >= 0 ? "green" : "red"}`}>{signedMoney(t.pnl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {w.open && (
              <div className="card">
                <h3>Open positions</h3>
                <p className="muted" style={{ marginTop: 8 }}>No open positions. This journal tracks closed fills you add or import.</p>
              </div>
            )}
          </div>
          {w.prop && (
            <div className="card">
              <div className="between"><h3>Prop firm sync</h3><Link to="/app/prop">Open desk</Link></div>
              <div className="grid-3" style={{ marginTop: 8 }}>
                {props.map((p) => (
                  <div key={p.accountId}>
                    <b>{p.firm}</b>
                    <div className="num">{compactMoney(p.net)} / {compactMoney(p.target)}</div>
                    <div className="progress" style={{ marginTop: 6 }}><span style={{ width: `${Math.max(0, Math.min(100, p.progress * 100))}%`, background: p.breachedDaily || p.breachedMax ? "var(--red)" : "var(--green)" }} /></div>
                    <div className="faint">Pass forecast {pct(p.pass)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="card">
            <h3>Hour expectancy</h3>
            <Bars data={s.byHour.filter((h) => h.count > 2).map((h) => ({ label: h.label, value: h.net }))} />
          </div>
        </div>
      </div>
    </div>
  );
}
