import { useMemo, useState } from "react";
import { Link, Outlet, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../lib/store";
import { BROKERS, FAQS, PLANS, POSTS } from "../lib/content";
import { compactMoney, pct } from "../lib/format";
import { freshState } from "../lib/seed";
import { computeStats } from "../lib/stats";
import { answerQuestion } from "../lib/ai";
import { Field, Logo } from "../components/Ui";
import { EquityChart } from "../components/Charts";

export function MarketingLayout() {
  return (
    <div className="mkt">
      <nav className="m-nav">
        <Link to="/" className="brand"><Logo /> Folio</Link>
        <div className="m-links">
          <Link to="/">Products</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/brokers">Brokers</Link>
          <Link to="/blog">Journal</Link>
          <Link to="/compare">Compare</Link>
        </div>
        <div className="grow" />
        <Link to="/login" className="btn btn-ghost btn-sm">Log in</Link>
        <Link to="/signup" className="btn btn-primary btn-sm">Open the journal</Link>
      </nav>
      <Outlet />
      <footer className="m-footer">
        <div>
          <div className="brand"><Logo size={24} /> Folio</div>
          <p>A trading journal for people who review. Futures, forex, stocks, crypto, and evaluations — in one desk.</p>
        </div>
        <div>
          <strong>Product</strong>
          <Link to="/features/journal">Automated journal</Link>
          <Link to="/features/replay">Trade replay</Link>
          <Link to="/features/backtesting">Backtesting</Link>
          <Link to="/features/ai">Folio AI</Link>
          <Link to="/features/prop">Prop firm sync</Link>
        </div>
        <div>
          <strong>Company</strong>
          <Link to="/blog">Notes</Link>
          <Link to="/compare">Versus spreadsheets</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </div>
        <div>
          <strong>Desk</strong>
          <Link to="/signup">Demo journal</Link>
          <Link to="/brokers">Broker formats</Link>
          <Link to="/login">Log in</Link>
        </div>
      </footer>
      <p className="disclaimer">
        Folio is an independent demo. It is not a broker, not a prop firm, and not affiliated with the platforms named as import formats. Trading involves substantial risk of loss. Sample testimonials are illustrative. Nothing here is financial advice. Simulated tapes are not live market data.
      </p>
    </div>
  );
}

export function Landing() {
  const demo = useMemo(() => freshState(), []);
  const stats = useMemo(() => computeStats(demo.trades, 225000), [demo]);
  const [tab, setTab] = useState("journal");
  const [annual, setAnnual] = useState(true);
  const [ask, setAsk] = useState("Where do I leak?");
  const reply = answerQuestion(ask, stats, demo.trades);
  const products = [
    { id: "journal", title: "Every fill, journaled.", text: "Connect a file or add the trade by hand. Tags, notes, screenshots, and the playbook land on the fill — not in a spreadsheet you abandon by Thursday.", points: ["CSV, manual, and simulated broker sync", "Notes, ratings, emotions, mistakes", "Running P&L, MAE, and MFE", "Multi-account book"] },
    { id: "backtest", title: "Prove the idea before it costs you.", text: "Step a simulated tape bar by bar, or run a plain-English template — opening range, fair value gap, trend, mean reversion — and read the expectancy.", points: ["Bar-by-bar practice", "Market, limit, and stop drills", "Four strategy templates", "Sessions you can save"] },
    { id: "replay", title: "Rewatch the trade you actually took.", text: "Trade replay, day replay, and a scenario cut. Speed from a crawl to 30×. Entry, stop, and target stay on the chart.", points: ["Synced to your fills", "Variable speed", "Time & sales and a depth ladder", "Share the review into a space"] },
    { id: "ai", title: "Ask the book, not a forum.", text: "Folio AI answers from the trades in your filter. Hours, tilt, playbooks, drawdown, and the evaluation. It will not invent a setup you did not take.", points: ["Grounded in your journal", "Tilt and leak detection", "Weekly read", "Agents for habits, risk, and tone"] },
    { id: "spaces", title: "A desk, not a chatroom.", text: "Private rooms for a mentor and friends. Share a day, react, run a challenge. Mentor mode is a review, not a signal service.", points: ["Invite-only rooms", "Shared trades", "Challenges and a board", "Mentor notes"] },
    { id: "prop", title: "Know the rule before you break it.", text: "Profit target, daily loss, trailing max, minimum days, and consistency — across the sample FTMO, Apex, and Topstep sheets.", points: ["Real-time rule gauges", "Pass-rate forecast", "Multi-account view", "Warnings before the breach"] },
  ];
  const current = products.find((p) => p.id === tab)!;
  return (
    <>
      <header className="m-hero">
        <div>
          <div className="kicker">Trading journal · replay · backtesting</div>
          <h1>Journal the fill.<br /><em>Find the leak.</em></h1>
          <p className="lede">Folio keeps the executions, the score, the tape, and the evaluation rules in one desk — so the next session starts from evidence, not from memory.</p>
          <div className="hero-actions">
            <Link to="/signup" className="btn btn-primary">Open the demo journal</Link>
            <Link to="/pricing" className="btn btn-ghost">See pricing</Link>
          </div>
          <div className="stat-row">
            <div><strong>{stats.count}</strong> sample fills</div>
            <div><strong>50+</strong> live reports</div>
            <div><strong>3</strong> replay modes</div>
            <div><strong>Local</strong> data stays in the browser</div>
          </div>
        </div>
        <div className="frame">
          <div className="frame-top"><i /><i /><i /></div>
          <div className="frame-body">
            <div className="between"><b>Demo book</b><span className="badge good">Net {compactMoney(stats.net)}</span></div>
            <div className="kpis" style={{ marginTop: 10, gridTemplateColumns: "1fr 1fr 1fr" }}>
              <div className="card"><div className="faint">Win rate</div><div className="val num">{pct(stats.winRate)}</div></div>
              <div className="card"><div className="faint">Profit factor</div><div className="val num">{stats.profitFactor.toFixed(2)}</div></div>
              <div className="card"><div className="faint">Folio Score</div><div className="val num">{stats.folioScore.toFixed(0)}</div></div>
            </div>
            <div className="card" style={{ marginTop: 10 }}>
              <div className="faint">Daily net cumulative P&L</div>
              <EquityChart data={stats.equity} height={150} />
            </div>
          </div>
        </div>
      </header>
      <div className="marquee">
        <div className="marquee-track">
          {[...BROKERS, ...BROKERS].map((b, i) => <span key={b.name + i}>{b.name}</span>)}
        </div>
      </div>
      <section className="section" id="products">
        <div className="kicker">Six tools. One hub.</div>
        <h2>Everything that makes the next trade cleaner.</h2>
        <div className="tabs">
          {products.map((p) => (
            <button key={p.id} className={`tab ${tab === p.id ? "on" : ""}`} onClick={() => setTab(p.id)}>{p.id}</button>
          ))}
        </div>
        <div className="product-grid">
          <div>
            <h3 style={{ fontSize: 32, letterSpacing: "-0.04em" }}>{current.title}</h3>
            <p className="lede" style={{ marginTop: 8 }}>{current.text}</p>
            <ul className="checks">{current.points.map((pt) => <li key={pt}>{pt}</li>)}</ul>
            <Link to={`/features/${current.id}`} className="btn btn-ghost" style={{ marginTop: 16 }}>Learn more</Link>
          </div>
          <div className="card">
            <div className="faint">From the demo book</div>
            <p style={{ fontSize: 22, letterSpacing: "-0.03em", margin: "8px 0" }}>{stats.bestPlaybook ? "The paying setup is already in the tags." : "Tag the setup."}</p>
            <p className="muted">Worst hour in this book: {stats.worstHour?.label ?? "—"}. Tilt and FOMO: {compactMoney(stats.tilt.pnl)}. Exit efficiency: {pct(stats.exitEfficiency)}.</p>
            <Link to="/signup" className="btn btn-primary" style={{ marginTop: 14 }}>Review it yourself</Link>
          </div>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="kicker">Folio AI</div>
        <h2>Answers from your trades. Not from a thread.</h2>
        <div className="product-grid">
          <div className="card">
            <div className="chips" style={{ marginBottom: 10 }}>
              {["Where do I leak?", "Best playbook", "Worst hour", "FTMO status", "Exit efficiency"].map((c) => (
                <button key={c} className={`chip ${ask === c ? "on" : ""}`} onClick={() => setAsk(c)}>{c}</button>
              ))}
            </div>
            <h3 style={{ color: "white", fontSize: 18 }}>{reply.title}</h3>
            <p style={{ whiteSpace: "pre-wrap", color: "#c5cbd6", marginTop: 8 }}>{reply.body}</p>
          </div>
          <div>
            <p className="lede">Agents watch the part of the session you will not. Habits. Risk. Tone. Or a rule only you would write.</p>
            <div className="stack" style={{ marginTop: 16 }}>
              {["Habit agent — rituals slipping", "Risk agent — daily loss, size, streaks", "Sentiment agent — tilt before it invoices you", "Custom agent — your rule, no code"].map((t) => (
                <div key={t} className="card">{t}</div>
              ))}
            </div>
          </div>
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="kicker">From the desk</div>
        <h2>Sample notes from traders who review.</h2>
        <p className="muted">Illustrative, not endorsements. The product is the journal — not a signal room.</p>
        <div className="grid-3" style={{ marginTop: 16 }}>
          {[
            ["I stopped adding indicators and started deleting the hour that was paying the bills in reverse.", "Nadia B.", "Futures, Casablanca"],
            ["The evaluation died on consistency, not on the max loss. I only saw it because the gauge was in the way.", "Omar L.", "Prop evaluation"],
            ["Replay is the only thing that made an early exit feel like a habit instead of a one-off.", "Elena V.", "Index futures"],
          ].map(([quote, name, role]) => (
            <blockquote key={name} className="card">
              <p style={{ fontSize: 16 }}>{quote}</p>
              <div className="faint" style={{ marginTop: 10 }}>{name} · {role}</div>
            </blockquote>
          ))}
        </div>
      </section>
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="between">
          <div>
            <div className="kicker">Pricing</div>
            <h2>Simple plans. The demo unlocks all of them.</h2>
          </div>
          <button className="btn btn-ghost" onClick={() => setAnnual((v) => !v)}>{annual ? "Annual · save 25%" : "Monthly"}</button>
        </div>
        <div className="grid-3" style={{ marginTop: 18 }}>
          {PLANS.map((p) => (
            <div key={p.id} className={`price ${p.featured ? "featured" : ""}`}>
              <div className="between"><b>{p.name}</b>{p.featured && <span className="badge new">Most used</span>}</div>
              <div className="amt">${annual ? p.annual : p.monthly}<span style={{ fontSize: 16, color: "#9aa1b2" }}>/mo</span></div>
              <p className="muted">{p.blurb}</p>
              <ul>{p.points.map((pt) => <li key={pt}>{pt}</li>)}</ul>
              <Link to="/signup" className="btn btn-primary btn-block">Start {p.name}</Link>
            </div>
          ))}
        </div>
      </section>
      <section className="section faq" style={{ paddingTop: 0 }}>
        <h2>Questions</h2>
        {FAQS.map((f) => (
          <details key={f.q}><summary>{f.q}</summary><p className="muted">{f.a}</p></details>
        ))}
      </section>
    </>
  );
}

const FEATURES: Record<string, { title: string; lede: string; points: string[] }> = {
  journal: { title: "Automated journal", lede: "The fill arrives with the price, the time, and the size. You add the only thing a broker cannot know: why you clicked.", points: ["Multi-account book", "Custom tags for setup, emotion, and mistake", "Trade rating and reviewed state", "Running P&L and partials", "CSV import that actually parses", "Day checklist and end-of-day note"] },
  replay: { title: "Trade replay", lede: "Rewatch the candle as it printed, with your entry and exit nailed to the tape.", points: ["Trade replay for one fill", "Day replay for the whole session", "Scenario cut against similar setups", "Speeds from 0.5× to 30×", "Time and sales, depth ladder, drawings"] },
  backtesting: { title: "Backtesting", lede: "A practice tape, not a promise of live history. Step it, or let a template run.", points: ["Bar-by-bar manual orders", "Market, limit, stop, stop-loss, take-profit", "Opening range, FVG, trend, mean reversion", "Saved sessions", "Send a drill note to the notebook"] },
  ai: { title: "Folio AI", lede: "A reader for your own book. Ask a specific question. Get a number that is in the filter.", points: ["Playbook, hour, symbol, side", "Tilt, revenge, and after-loss stats", "MAE / MFE and exit efficiency", "Prop status", "Agents you can turn off"] },
  spaces: { title: "Spaces", lede: "A private room for the people allowed to see the day. Not a signal feed.", points: ["Mentor mode", "Share a trade card", "Reactions", "Challenge board", "Group rooms"] },
  prop: { title: "Prop firm sync", lede: "The footnotes that fail evaluations: daily loss, trailing max, consistency, minimum days.", points: ["FTMO, Apex, and Topstep sample sheets", "Pass forecast", "Warnings before the line", "Per-account dashboards"] },
};

export function FeaturePage() {
  const { slug = "journal" } = useParams();
  const f = FEATURES[slug] ?? FEATURES.journal;
  return (
    <section className="section">
      <div className="kicker">Product</div>
      <h2>{f.title}</h2>
      <p className="lede">{f.lede}</p>
      <ul className="checks">{f.points.map((p) => <li key={p}>{p}</li>)}</ul>
      <Link to="/signup" className="btn btn-primary" style={{ marginTop: 18 }}>Try it in the demo</Link>
    </section>
  );
}

export function Pricing() {
  const [annual, setAnnual] = useState(true);
  return (
    <section className="section">
      <div className="between">
        <div>
          <div className="kicker">Pricing</div>
          <h2>Pay for the desk. Not for a locked report.</h2>
          <p className="lede">Essential is a complete journal. Pro adds replay, AI, and the prop desk. Ultra is for mentors. In this demo, every plan is unlocked so you can see the whole product.</p>
        </div>
        <button className="btn btn-ghost" onClick={() => setAnnual((v) => !v)}>{annual ? "Showing annual" : "Showing monthly"}</button>
      </div>
      <div className="grid-3" style={{ marginTop: 20 }}>
        {PLANS.map((p) => (
          <div key={p.id} className={`price ${p.featured ? "featured" : ""}`}>
            <b>{p.name}</b>
            <div className="amt">${annual ? p.annual : p.monthly}<span style={{ fontSize: 16 }}>/mo</span></div>
            <p className="muted">{annual ? `$${p.annual * 12} billed yearly` : "Billed monthly"}</p>
            <ul>{p.points.map((pt) => <li key={pt}>{pt}</li>)}</ul>
            <Link to="/signup" className="btn btn-primary btn-block">Continue with {p.name}</Link>
          </div>
        ))}
      </div>
      <div className="faq" style={{ marginTop: 28 }}>
        {FAQS.map((f) => <details key={f.q}><summary>{f.q}</summary><p className="muted">{f.a}</p></details>)}
      </div>
    </section>
  );
}

export function Brokers() {
  const groups = [...new Set(BROKERS.map((b) => b.group))];
  return (
    <section className="section">
      <div className="kicker">Import formats</div>
      <h2>The brokers traders actually use.</h2>
      <p className="lede">Names below are file formats the desk is built to recognize. This demo simulates the connect step and really parses CSV. It does not log into your broker.</p>
      {groups.map((g) => (
        <div key={g} style={{ marginTop: 22 }}>
          <h3>{g}</h3>
          <div className="chips" style={{ marginTop: 8 }}>{BROKERS.filter((b) => b.group === g).map((b) => <span key={b.name} className="chip">{b.name}</span>)}</div>
        </div>
      ))}
      <Link to="/signup" className="btn btn-primary" style={{ marginTop: 20 }}>Connect a demo account</Link>
    </section>
  );
}

export function Blog() {
  return (
    <section className="section">
      <div className="kicker">Notes</div>
      <h2>Process, not picks.</h2>
      <div className="stack" style={{ marginTop: 18 }}>
        {POSTS.map((p) => (
          <Link key={p.slug} to={`/blog/${p.slug}`} className="card">
            <div className="kicker">{p.kicker} · {p.date}</div>
            <h3 style={{ color: "white", fontSize: 24, marginTop: 6 }}>{p.title}</h3>
            <p className="muted">{p.excerpt}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function Post() {
  const { slug } = useParams();
  const post = POSTS.find((p) => p.slug === slug) ?? POSTS[0];
  return (
    <article className="section" style={{ maxWidth: 760 }}>
      <div className="kicker">{post.kicker} · {post.date}</div>
      <h2>{post.title}</h2>
      {post.body.split("\n\n").map((para) => <p key={para.slice(0, 24)} className="lede" style={{ marginTop: 14 }}>{para}</p>)}
    </article>
  );
}

export function Compare() {
  const rows = [
    ["Auto stats from fills", "Yes", "If you build them", "Sometimes"],
    ["Playbooks with rules", "Yes", "A column", "Rarely"],
    ["MAE / MFE", "Yes", "Manual", "No"],
    ["Trade replay", "Yes", "No", "No"],
    ["Bar-by-bar practice", "Yes", "No", "No"],
    ["Prop rule gauges", "Yes", "A tab you forget", "No"],
    ["AI grounded in your book", "Yes", "No", "Generic"],
    ["Mentor space", "Yes", "A chat app", "Comments"],
  ];
  return (
    <section className="section">
      <div className="kicker">Compare</div>
      <h2>A journal should argue with you.</h2>
      <div className="table-wrap" style={{ marginTop: 16 }}>
        <table>
          <thead><tr><th> </th><th>Folio</th><th>Spreadsheet</th><th>Generic notes app</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r[0]}>{r.map((c) => <td key={c}>{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </section>
  );
}

export function Legal({ kind }: { kind: "privacy" | "terms" }) {
  return (
    <section className="section" style={{ maxWidth: 760 }}>
      <h2>{kind === "privacy" ? "Privacy" : "Terms"}</h2>
      {kind === "privacy" ? (
        <p className="lede" style={{ marginTop: 12 }}>This demo stores your journal in local storage on this browser. It is not sent to a server. Export a backup from Settings. Clearing site data deletes it. Do not paste live account credentials into the broker connect screen — that control is a simulation.</p>
      ) : (
        <p className="lede" style={{ marginTop: 12 }}>Folio is a demonstration product. It does not execute live orders, custody funds, or provide investment advice. Prop rules shown are sample sheets for the demo book and may not match a firm’s current program. You are responsible for confirming every rule with the firm before you trade.</p>
      )}
    </section>
  );
}

export function AuthPage({ mode }: { mode: "login" | "signup" }) {
  const store = useStore();
  const navigate = useNavigate();
  const [name, setName] = useState("Amine El Idrissi");
  const [email, setEmail] = useState("amine@folio.demo");
  const [plan, setPlan] = useState<"essential" | "pro" | "ultra">("pro");
  const go = () => {
    const user = { name: name || "Amine El Idrissi", email, plan, city: "Salé", timezone: "Africa/Casablanca" };
    store.login(user);
    navigate("/app");
  };
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Link to="/" className="brand"><Logo /> Folio</Link>
        <h2 style={{ margin: "14px 0 6px" }}>{mode === "login" ? "Welcome back" : "Open your desk"}</h2>
        <p className="muted">The demo book is preloaded. Nothing is sent to a server.</p>
        <div className="stack" style={{ marginTop: 14 }}>
          {mode === "signup" && <Field label="Name"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>}
          <Field label="Email"><input value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
          <Field label="Password"><input type="password" defaultValue="demo-only" /></Field>
          {mode === "signup" && (
            <Field label="Plan">
              <select value={plan} onChange={(e) => setPlan(e.target.value as never)}>
                <option value="essential">Essential</option>
                <option value="pro">Pro</option>
                <option value="ultra">Ultra</option>
              </select>
            </Field>
          )}
          <button className="btn btn-primary" onClick={go}>{mode === "login" ? "Log in" : "Create the desk"}</button>
          <button className="btn btn-ghost" onClick={go}>Continue as Amine in Salé</button>
          <p className="faint">{mode === "login" ? <Link to="/signup">Need an account?</Link> : <Link to="/login">Already have a desk?</Link>}</p>
        </div>
      </div>
    </div>
  );
}


