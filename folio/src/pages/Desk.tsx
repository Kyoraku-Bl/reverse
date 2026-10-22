import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BROKERS, LESSONS, SAMPLE_CSV, SPACES } from "../lib/content";
import { answerQuestion, insightCards } from "../lib/ai";
import { money, pct, signedMoney, uid } from "../lib/format";
import { propSnapshots } from "../lib/stats";
import { useStore } from "../lib/store";
import { AddAccountModal, deskLabel } from "../components/AddAccount";
import { Field } from "../components/Ui";

export function AIPage() {
  const store = useStore();
  const [input, setInput] = useState("");
  const [log, setLog] = useState<{ role: "you" | "ai"; title?: string; text: string }[]>([
    { role: "ai", title: "Ready when you are", text: "Ask about a leak, a playbook, an hour, tilt, exits, or an evaluation. I only read the trades in the current filter." },
  ]);
  const cards = insightCards(store.stats);
  const ask = (q: string) => {
    const reply = answerQuestion(q, store.stats, store.filtered, store.accounts);
    store.spendCredit();
    setLog((l) => [...l, { role: "you", text: q }, { role: "ai", title: reply.title, text: reply.body }]);
    setInput("");
  };
  return (
    <div className="split-3">
      <div className="card">
        <h3>Suggested</h3>
        {["Where do I leak?", "Best playbook", "Worst hour", "Am I on tilt?", "FTMO status", "Exit efficiency", "This week", "Long versus short"].map((q) => (
          <button key={q} className="list-btn" onClick={() => ask(q)}>{q}</button>
        ))}
        <div className="faint" style={{ marginTop: 12 }}>{store.aiCredits} AI credits left this month · demo counter</div>
      </div>
      <div className="card" style={{ display: "flex", flexDirection: "column" }}>
        <div className="chat" style={{ flex: 1 }}>
          {log.map((m, i) => (
            <div key={i} className={`bubble ${m.role === "you" ? "you" : ""}`}>
              {m.title && <b>{m.title}</b>}
              <div style={{ whiteSpace: "pre-wrap" }}>{m.text}</div>
            </div>
          ))}
        </div>
        <form className="composer" onSubmit={(e) => { e.preventDefault(); if (input.trim()) ask(input.trim()); }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the book…" />
          <button className="btn btn-primary" type="submit">Ask</button>
        </form>
      </div>
      <div className="stack">
        {cards.map((c) => (
          <div key={c.title} className="card">
            <div className="kicker">{c.kicker}</div>
            <b>{c.title}</b>
            <p className="muted">{c.body}</p>
          </div>
        ))}
        <div className="card">
          <h3>Monday digest</h3>
          <p className="muted">Net {signedMoney(store.stats.net)} on {store.stats.count} trades. Score {store.stats.folioScore.toFixed(0)}. The hour to close is {store.stats.worstHour?.label ?? "—"}. Adherence {pct(store.stats.adherence)}.</p>
        </div>
      </div>
    </div>
  );
}

export function Agents() {
  const store = useStore();
  const [name, setName] = useState("");
  const [watch, setWatch] = useState("");
  const alerts = useMemo(() => {
    const s = store.stats;
    const list = [];
    if (store.agents.find((a) => a.id === "risk")?.active) list.push({ agent: "Risk", text: `Max drawdown ${money(s.maxDrawdown)}. After a loss, next-trade win rate is ${pct(s.afterLoss.winRate)}.` });
    if (store.agents.find((a) => a.id === "habit")?.active) list.push({ agent: "Habit", text: `Reviewed ${pct(s.reviewedRate)}. End-of-day notes are the ritual most likely to slip.` });
    if (store.agents.find((a) => a.id === "sentiment")?.active) list.push({ agent: "Sentiment", text: `Tilt and FOMO net ${money(s.tilt.pnl)} across ${s.tilt.count} trades.` });
    for (const a of store.agents.filter((x) => x.custom && x.active)) {
      const hit = s.byMistake.find((m) => a.watch && m.key.includes(a.watch)) ?? s.byEmotion.find((m) => a.watch && m.key.includes(a.watch ?? ""));
      list.push({ agent: a.name, text: hit ? `Watching “${a.watch}”: ${hit.count} trades, ${money(hit.net)}.` : `Watching “${a.watch || "your rule"}”. No matching tag in this filter yet.` });
    }
    return list;
  }, [store.agents, store.stats]);
  return (
    <div className="stack">
      <div className="grid-3">
        {store.agents.map((a) => (
          <div key={a.id} className="card">
            <div className="between"><span className="badge">{a.role}</span><button className={`chip ${a.active ? "on" : ""}`} onClick={() => store.toggleAgent(a.id)}>{a.active ? "Active" : "Paused"}</button></div>
            <h3 style={{ color: "var(--text)", fontSize: 18, marginTop: 8 }}>{a.name}</h3>
            <p className="muted">{a.description}</p>
          </div>
        ))}
      </div>
      <div className="product-grid">
        <div className="card">
          <h3>Build an agent</h3>
          <p className="muted">Describe what it should watch. It will attach to tags already in the book — no code.</p>
          <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="No-chase agent" /></Field>
          <Field label="Watch for"><input value={watch} onChange={(e) => setWatch(e.target.value)} placeholder="chased" /></Field>
          <button className="btn btn-primary" onClick={() => {
            if (!name.trim()) return;
            store.addAgent({ id: uid("ag"), name, role: "Your rules", description: `Flags trades matching “${watch}”.`, active: true, custom: true, watch: watch.toLowerCase() });
            setName(""); setWatch("");
          }}>Create</button>
        </div>
        <div className="card">
          <h3>Alert tape</h3>
          {alerts.map((a, i) => <div key={i} className="msg" style={{ marginTop: 8 }}><b>{a.agent}</b><div className="muted">{a.text}</div></div>)}
        </div>
      </div>
    </div>
  );
}

export function University() {
  const { id } = useParams();
  const store = useStore();
  const lesson = LESSONS.find((l) => l.id === id);
  if (lesson) {
    return (
      <article className="stack" style={{ maxWidth: 760 }}>
        <Link to="/app/university" className="faint">← University</Link>
        <div className="kicker">{lesson.track} · {lesson.minutes} min</div>
        <h2>{lesson.title}</h2>
        {lesson.body.split("\n\n").map((p) => <p key={p.slice(0, 20)}>{p}</p>)}
        <button className="btn btn-primary" onClick={() => store.completeLesson(lesson.id)}>{store.lessonsDone.includes(lesson.id) ? "Completed" : "Mark complete"}</button>
      </article>
    );
  }
  const tracks = [...new Set(LESSONS.map((l) => l.track))];
  return (
    <div className="stack">
      <div>
        <h2 style={{ fontSize: 20 }}>Folio University</h2>
        <p className="muted">{store.lessonsDone.length} / {LESSONS.length} lessons marked. Short on purpose.</p>
      </div>
      {tracks.map((t) => (
        <div key={t}>
          <div className="nav-label">{t}</div>
          <div className="grid-3">
            {LESSONS.filter((l) => l.track === t).map((l) => (
              <Link key={l.id} to={`/app/university/${l.id}`} className="card">
                <div className="between"><b>{l.title}</b>{store.lessonsDone.includes(l.id) && <span className="badge good">Done</span>}</div>
                <div className="faint">{l.minutes} min</div>
              </Link>
            ))}
          </div>
        </div>
      ))}
      <div className="card">
        <h3>Economic calendar</h3>
        <p className="faint">Illustrative events for the demo week. Confirm the live calendar before you trade.</p>
        {[
          ["2026-10-22", "08:30 ET", "Initial jobless claims", "USD", "Medium"],
          ["2026-10-23", "09:45 ET", "PMI flash", "USD", "Medium"],
          ["2026-10-24", "10:00 ET", "Existing home sales", "USD", "Low"],
          ["2026-10-28", "14:00 ET", "Consumer confidence", "USD", "Medium"],
        ].map((row) => (
          <div key={row[2]} className="between" style={{ padding: "6px 0" }}><span>{row[0]} {row[1]}</span><b>{row[2]}</b><span className="faint">{row[3]} · {row[4]}</span></div>
        ))}
      </div>
    </div>
  );
}

export function Spaces() {
  const store = useStore();
  const { id } = useParams();
  const spaceId = id || "desk";
  const space = SPACES.find((s) => s.id === spaceId) ?? SPACES[0];
  const [text, setText] = useState("");
  const feed = store.messages.filter((m) => m.spaceId === space.id);
  const you = store.stats.net;
  const board = [
    { name: "Yasmine K.", pnl: 4200 },
    { name: store.user?.name ?? "You", pnl: you },
    { name: "Owen P.", pnl: 1880 },
    { name: "Lina S.", pnl: 960 },
    { name: "Hugo M.", pnl: -240 },
  ].sort((a, b) => b.pnl - a.pnl);
  return (
    <div className="split-3">
      <div className="card">
        {SPACES.map((s) => (
          <Link key={s.id} to={`/app/spaces/${s.id}`} className={`list-btn ${s.id === space.id ? "on" : ""}`}>
            <b>{s.name}</b>
            <div className="faint">{s.kind} · {s.members} members</div>
          </Link>
        ))}
      </div>
      <div className="stack">
        <div>
          <h2 style={{ fontSize: 20 }}>{space.name}</h2>
          <p className="muted">{space.blurb} {space.mentor && `Mentor: ${space.mentor}.`}</p>
        </div>
        <form className="composer" onSubmit={(e) => { e.preventDefault(); if (!text.trim()) return; store.postMessage(space.id, text.trim()); setText(""); }}>
          <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Share a process note, not a signal" />
          <button className="btn btn-primary">Post</button>
        </form>
        <div className="feed">
          {feed.map((m) => (
            <div key={m.id} className="msg">
              <div className="between"><b>{m.author}</b><span className="faint">{new Date(m.time).toLocaleString()}</span></div>
              <p>{m.text}</p>
              {m.symbol && <div className="badge">{m.symbol} {m.pnl != null ? signedMoney(m.pnl) : ""}</div>}
              <button className="btn btn-ghost btn-sm" onClick={() => store.reactMessage(m.id)}>▲ {m.reactions}</button>
            </div>
          ))}
        </div>
      </div>
      <div className="stack">
        <div className="card">
          <h3>Challenge · green week</h3>
          <p className="muted">Your filtered net this book: {signedMoney(you)}. The board mixes your real stats with sample members.</p>
          {board.map((b, i) => (
            <div key={b.name} className="between"><span>{i + 1}. {b.name}</span><b className={b.pnl >= 0 ? "green" : "red"}>{signedMoney(b.pnl)}</b></div>
          ))}
        </div>
        <div className="card">
          <h3>Mentor mode</h3>
          <p className="muted">Share today’s intention with {space.mentor ?? "the room"}.</p>
          <button className="btn btn-primary btn-sm" onClick={() => store.postMessage(space.id, store.checklists["2026-10-22"]?.intention || "Flat by 15:00. A+ only.")}>Send day plan</button>
        </div>
      </div>
    </div>
  );
}

export function PropFirm() {
  const store = useStore();
  const snaps = propSnapshots(store.trades, store.accounts);
  const [id, setId] = useState(snaps[0]?.accountId ?? "");
  const [adding, setAdding] = useState(false);
  const snap = snaps.find((s) => s.accountId === id) ?? snaps[0];
  return (
    <div className="stack">
      <div className="between">
        <div>
          <h2 style={{ fontSize: 20 }}>Prop accounts</h2>
          <p className="muted">Futures, CFDs, and Forex. Add as many firms as you run.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Add account</button>
      </div>
      {adding && <AddAccountModal preset="prop" onClose={() => setAdding(false)} />}
      {!snap && <div className="card muted">No prop account yet. Add a Futures, CFD, or Forex evaluation.</div>}
      <div className="account-cards">
        {snaps.map((s) => (
          <button key={s.accountId} className="card" style={{ textAlign: "left", borderColor: s.accountId === snap?.accountId ? "var(--accent)" : undefined }} onClick={() => setId(s.accountId)}>
            <div className="between"><b>{s.name}</b><span className="badge">{s.firm}</span></div>
            <div className="num" style={{ fontSize: 22 }}>{signedMoney(s.net)}</div>
            <div className="progress"><span style={{ width: `${Math.max(0, Math.min(100, s.progress * 100))}%` }} /></div>
            <div className="faint">Target {money(s.target)} · forecast {pct(s.pass)}</div>
          </button>
        ))}
      </div>
      {snap && <div className="grid-4">
        <GaugeCard label="Profit target" value={Math.max(0, snap.progress)} text={`${money(snap.net)} / ${money(snap.target)}`} />
        <GaugeCard label="Daily loss room" value={snap.dailyLimit ? Math.max(0, snap.dailyRoom / snap.dailyLimit) : 0} text={money(snap.dailyRoom)} bad={snap.breachedDaily} />
        <GaugeCard label={snap.trailRoom < 0 ? "Max loss" : "Loss room left"} value={snap.lossLimit ? Math.max(0, Math.min(1, snap.trailRoom / snap.lossLimit)) : 0} text={money(snap.trailRoom)} bad={snap.breachedMax} />
        <GaugeCard label="Consistency" value={snap.consistencyOk ? 0.8 : 0.3} text={snap.net > 0 ? pct(snap.consistency) : "n/a"} bad={!snap.consistencyOk} />
      </div>}
      {snap && <div className="product-grid">
        <div className="card">
          <h3>Warnings</h3>
          {snap.warnings.map((w) => <p key={w}>{w}</p>)}
          <p className="faint">{snap.note}</p>
          <p className="muted">Trading days {snap.tradingDays} / {snap.minDays} minimum. Best day {money(snap.bestDay)}. Worst day {money(snap.worstDay)}. Days-to-target estimate {Number.isFinite(snap.daysToTarget) ? snap.daysToTarget.toFixed(1) : "—"}. Equity {money(snap.equity)}.</p>
        </div>
        <div className="card">
          <h3>Pass forecast {pct(snap.pass)}</h3>
          <div className="progress" style={{ height: 14 }}><span style={{ width: `${snap.pass * 100}%`, background: snap.pass > 0.6 ? "var(--green)" : "var(--amber)" }} /></div>
          <p className="muted">A rough read from progress, rule breaches, and consistency. Not a probability from the firm, and not a suggestion to size up.</p>
          <Link to="/app/trades" className="btn btn-ghost btn-sm">Review this account’s fills</Link>
        </div>
      </div>}
    </div>
  );
}

function GaugeCard({ label, value, text, bad }: { label: string; value: number; text: string; bad?: boolean }) {
  return (
    <div className="metric">
      <span className="faint">{label}</span>
      <b className={bad ? "red" : ""}>{text}</b>
      <div className="progress"><span style={{ width: `${Math.max(4, Math.min(100, value * 100))}%`, background: bad ? "var(--red)" : "var(--green)" }} /></div>
    </div>
  );
}

export function Accounts() {
  const store = useStore();
  const [csv, setCsv] = useState(SAMPLE_CSV);
  const [adding, setAdding] = useState(false);
  const groups = [...new Set(BROKERS.map((b) => b.group))];
  return (
    <div className="stack">
      <div className="between">
        <div>
          <h2 style={{ fontSize: 20 }}>Trading accounts</h2>
          <p className="muted">Prop Futures, CFDs, Forex, and broker accounts. Add as many as you run.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Add account</button>
      </div>
      {adding && <AddAccountModal onClose={() => setAdding(false)} />}
      <div className="account-cards">
        {store.accounts.map((a) => (
          <div key={a.id} className="card">
            <div className="between"><b>{a.name}</b><span className="badge">{deskLabel(a)}</span></div>
            <div className="faint">{a.firm || a.broker} · {a.kind === "prop" ? "Prop" : "Broker"}</div>
            <div className="num" style={{ marginTop: 6 }}>${a.balance0.toLocaleString()}</div>
            {a.rules && <div className="faint">Target ${a.rules.profitTarget.toLocaleString()} · daily loss ${a.rules.dailyLoss.toLocaleString()}</div>}
            <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => store.removeAccount(a.id)}>Remove</button>
          </div>
        ))}
      </div>
      <div className="card">
        <h3>Connected in this browser</h3>
        <p className="muted">Connect is a simulation. It does not authenticate with a broker. CSV import is real and stays local.</p>
        <div className="chips">{store.connected.map((c) => <span key={c} className="chip on">{c}</span>)}</div>
      </div>
      {groups.map((g) => (
        <div key={g}>
          <div className="nav-label">{g}</div>
          <div className="grid-4">
            {BROKERS.filter((b) => b.group === g).map((b) => {
              const on = store.connected.includes(b.name);
              return (
                <button key={b.name} className="card" style={{ textAlign: "left" }} onClick={() => { store.connectBroker(b.name); store.toast(on ? `Disconnected ${b.name}` : `Connected ${b.name} (simulated)`); }}>
                  <b>{b.name}</b>
                  <div className={on ? "green" : "faint"}>{on ? "Connected" : "Connect"}</div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="card">
        <h3>CSV import</h3>
        <p className="faint">date,symbol,side,qty,entry,exit,stop,account,playbook,emotion,notes</p>
        <textarea className="note-editor" value={csv} onChange={(e) => setCsv(e.target.value)} />
        <div className="row">
          <button className="btn btn-primary" onClick={() => store.importCsv(csv)}>Import</button>
          <button className="btn btn-ghost" onClick={() => {
            const blob = new Blob([SAMPLE_CSV], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url; a.download = "folio-sample.csv"; a.click();
          }}>Download sample</button>
        </div>
      </div>
    </div>
  );
}

export function Settings() {
  const store = useStore();
  const [email, setEmail] = useState(store.user?.email && store.user.email !== "amine@folio.demo" ? store.user.email : "");
  const [password, setPassword] = useState("");
  const [note, setNote] = useState("");
  const saveEmail = async () => {
    const result = await store.signup(
      { name: store.user?.name || "Trader", email, plan: store.user?.plan || "pro", city: store.user?.city || "Salé", timezone: store.user?.timezone || "Africa/Casablanca" },
      password,
    );
    setNote(result || `This journal now autosaves under ${email.trim().toLowerCase()}.`);
    if (!result) setPassword("");
  };
  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <div className="card">
        <h3>Profile</h3>
        <p><b>{store.user?.name}</b></p>
        <p className="muted">{store.user?.email} · {store.user?.city} · {store.user?.timezone}</p>
        <div className="chips" style={{ marginTop: 8 }}>
          {(["essential", "pro", "ultra"] as const).map((p) => (
            <button key={p} className={`chip ${store.user?.plan === p ? "on" : ""}`} onClick={() => store.setPlan(p)}>{p}</button>
          ))}
        </div>
        <p className="faint">Plan label only. This demo keeps every feature unlocked.</p>
      </div>
      <div className="card">
        <h3>Display</h3>
        <button className="btn btn-ghost" onClick={() => store.setTheme(store.theme === "dark" ? "light" : "dark")}>Theme: {store.theme}</button>
      </div>
      <div className="card">
        <h3>Autosave</h3>
        <p className="muted">Every trade, note, account, and permission is saved in this browser as you type. Log in with the same email and password on this computer to open the same desk. It is not stored on a server, so another phone needs the JSON file below.</p>
        <div className="stack" style={{ marginTop: 12 }}>
          <Field label="Email"><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" /></Field>
          <Field label={store.hasPassword ? "New password" : "Password"}><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 4 characters" /></Field>
          <button className="btn btn-primary" onClick={saveEmail}>{store.hasPassword ? "Update email lock" : "Save this desk under my email"}</button>
          {note && <p className={note.startsWith("This journal") ? "green" : "red"}>{note}</p>}
        </div>
      </div>
      <div className="card">
        <h3>Backup</h3>
        <div className="row">
          <button className="btn btn-primary" onClick={() => {
            const blob = new Blob([JSON.stringify({
              version: store.version,
              user: store.user,
              theme: store.theme,
              trades: store.trades,
              playbooks: store.playbooks,
              notes: store.notes,
              messages: store.messages,
              agents: store.agents,
              checklists: store.checklists,
              backtests: store.backtests,
              connected: store.connected,
              filters: store.filters,
              widgets: store.widgets,
              lastImport: store.lastImport,
              aiCredits: store.aiCredits,
              lessonsDone: store.lessonsDone,
              accounts: store.accounts,
              permissions: store.permissions,
            }, null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "folio-backup.json";
            a.click();
          }}>Export JSON</button>
          <label className="btn btn-ghost">
            Import JSON
            <input type="file" accept="application/json" hidden onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const text = await file.text();
              const parsed = JSON.parse(text);
              if (parsed.version === 1 && Array.isArray(parsed.trades)) {
                store.replaceState(parsed);
                store.toast("Backup restored");
              } else store.toast("That file is not a Folio backup");
            }} />
          </label>
          <button className="btn btn-ghost" onClick={() => store.resetDemo()}>Clear journal</button>
          <button className="btn btn-ghost" onClick={() => { store.logout(); window.location.assign(`${import.meta.env.BASE_URL}#/`); }}>Log out</button>
        </div>
      </div>
      <p className="faint">Saved under {store.user?.email || "this browser"} · {store.hasPassword ? "password lock on" : "set a password above so login can open this desk"}. Folio does not place live orders.</p>
    </div>
  );
}
