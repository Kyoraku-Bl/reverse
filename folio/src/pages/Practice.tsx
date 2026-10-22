import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { detectFvg, ema, runStrategy, sessionCandles, SPECS, STRATEGY_TEMPLATES, tradePnl, type Candle } from "../lib/market";
import { priceFmt, signedMoney, uid } from "../lib/format";
import { candlesForTrade } from "../lib/market";
import { useStore } from "../lib/store";
import type { Side } from "../lib/types";
import { CandleChart } from "../components/Charts";

const SPEEDS = [0.5, 1, 2, 5, 10, 30];

export function Replay() {
  const { id } = useParams();
  const store = useStore();
  const [mode, setMode] = useState<"trade" | "day" | "scenario">(id ? "trade" : "trade");
  const [tradeId, setTradeId] = useState(id || store.trades[0]?.id || "");
  const trade = store.trades.find((t) => t.id === tradeId) ?? store.trades[0];
  const dayTrades = store.trades.filter((t) => trade && t.openedAt.slice(0, 10) === trade.openedAt.slice(0, 10) && t.symbol === trade.symbol);
  const similar = store.trades.filter((t) => trade && t.playbookId === trade.playbookId && t.symbol === trade.symbol).slice(0, 5);
  const candles = useMemo(() => (trade ? candlesForTrade(trade, mode === "day" ? 96 : 72) : []), [trade, mode]);
  const [cursor, setCursor] = useState(20);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [showFvg, setShowFvg] = useState(true);
  const [showDepth, setShowDepth] = useState(true);
  const [draw, setDraw] = useState<{ a: number; b: number } | null>(null);

  useEffect(() => { setCursor(18); setPlaying(false); }, [tradeId, mode]);
  useEffect(() => {
    if (!playing) return;
    const ms = Math.max(40, 700 / speed);
    const t = setInterval(() => setCursor((c) => (c >= candles.length - 1 ? c : c + 1)), ms);
    return () => clearInterval(t);
  }, [playing, speed, candles.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === " ") { e.preventDefault(); setPlaying((p) => !p); }
      if (e.key === "ArrowRight") setCursor((c) => Math.min(candles.length - 1, c + 1));
      if (e.key === "ArrowLeft") setCursor((c) => Math.max(1, c - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [candles.length]);

  if (!trade) return <div className="card">Add a trade to replay it.</div>;
  const last = candles[Math.min(cursor, candles.length - 1)];
  const prints = candles.slice(Math.max(0, cursor - 8), cursor + 1).flatMap((c, i) => [
    { px: c.o, side: "buy" },
    { px: c.c, side: c.c >= c.o ? "buy" : "sell" },
    { px: c.l, side: "sell" },
  ].map((p, k) => ({ ...p, id: `${i}-${k}` })));
  const fvg = showFvg ? detectFvg(candles.slice(0, cursor + 1)) : [];

  return (
    <div className="stack">
      <div className="between wrap">
        <div className="tabs">
          {(["trade", "day", "scenario"] as const).map((m) => (
            <button key={m} className={`tab ${mode === m ? "on" : ""}`} onClick={() => setMode(m)}>{m} replay</button>
          ))}
        </div>
        <select value={tradeId} onChange={(e) => setTradeId(e.target.value)}>
          {store.trades.slice(0, 80).map((t) => <option key={t.id} value={t.id}>{t.openedAt.slice(0, 10)} {t.symbol} {t.side} {t.pnl.toFixed(0)}</option>)}
        </select>
      </div>
      <div className="replay-layout">
        <div className="card">
          <div className="between">
            <div>
              <b>{trade.symbol}</b> <span className="muted">{mode === "day" ? `${dayTrades.length} fills this symbol-day` : mode === "scenario" ? `${similar.length} similar setups` : "single trade"}</span>
            </div>
            <div className="transport">
              <button className="btn btn-ghost btn-sm" onClick={() => setCursor(18)}>Go to entry</button>
              <button className="btn btn-primary btn-sm" onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setCursor((c) => Math.min(candles.length - 1, c + 1))}>Step</button>
              {SPEEDS.map((sp) => <button key={sp} className={`chip ${speed === sp ? "on" : ""}`} onClick={() => setSpeed(sp)}>{sp}×</button>)}
            </div>
          </div>
          <CandleChart
            candles={candles}
            reveal={cursor + 1}
            height={420}
            boxes={fvg}
            lines={[
              { price: trade.entry, color: "#7c6bf6", label: "Entry" },
              { price: trade.stop, color: "#ff6b7d", label: "Stop" },
              { price: trade.target, color: "#f0b429", label: "Target" },
            ]}
            markers={[{ index: 18, label: "In", color: "#7c6bf6" }, { index: 60, label: "Out", color: "#3dd68c" }]}
            onPick={(index) => setDraw((d) => d && d.a !== index ? { a: d.a, b: index } : { a: index, b: index })}
          />
          <div className="row" style={{ marginTop: 8 }}>
            <label className="row"><input type="checkbox" checked={showFvg} onChange={(e) => setShowFvg(e.target.checked)} /> FVG boxes</label>
            <label className="row"><input type="checkbox" checked={showDepth} onChange={(e) => setShowDepth(e.target.checked)} /> Depth</label>
            <button className="btn btn-ghost btn-sm" onClick={() => setDraw(null)}>Clear drawing</button>
            {draw && <span className="faint">Line {draw.a} → {draw.b}</span>}
            <span className="faint">Space play · arrows step</span>
          </div>
          {mode === "scenario" && (
            <div className="chips" style={{ marginTop: 8 }}>
              {similar.map((t) => <button key={t.id} className="chip" onClick={() => setTradeId(t.id)}>{t.openedAt.slice(5, 10)} {signedMoney(t.pnl)}</button>)}
            </div>
          )}
        </div>
        <div className="stack">
          <div className="card">
            <h3>Time & sales</h3>
            <div className="ladder">
              {prints.slice(-12).reverse().map((p) => (
                <div key={p.id}><span className={p.side === "buy" ? "green" : "red"}>{p.side}</span><span>{priceFmt(trade.symbol, p.px)}</span><span className="faint">sim</span></div>
              ))}
            </div>
          </div>
          {showDepth && last && (
            <div className="card">
              <h3>Depth ladder</h3>
              <p className="faint">Simulated sizes around the last print. Not a live book.</p>
              <div className="ladder">
                {Array.from({ length: 7 }, (_, i) => {
                  const px = last.c + (3 - i) * (SPECS[trade.symbol]?.tick ?? 0.25) * 4;
                  return (
                    <div key={i}>
                      <span className="red">{20 + ((i * 17) % 40)}</span>
                      <span>{priceFmt(trade.symbol, px)}</span>
                      <span className="green">{15 + ((i * 13) % 36)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          <div className="card">
            <h3>This fill</h3>
            <div className={trade.pnl >= 0 ? "green" : "red"} style={{ fontSize: 22 }}>{signedMoney(trade.pnl)}</div>
            <p className="muted">{trade.notes}</p>
            <button className="btn btn-ghost btn-sm" onClick={() => store.postMessage("desk", `Replay note: ${trade.symbol} ${trade.notes}`, { symbol: trade.symbol, pnl: trade.pnl })}>Share to mentor space</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Backtest() {
  const store = useStore();
  const [symbol, setSymbol] = useState("NQ");
  const [seed, setSeed] = useState(77);
  const [tab, setTab] = useState<"manual" | "auto">("manual");
  const candles = useMemo(() => sessionCandles(symbol, seed, 180), [symbol, seed]);
  const [cursor, setCursor] = useState(24);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [side, setSide] = useState<Side>("long");
  const [type, setType] = useState<"market" | "limit" | "stop">("market");
  const [qty, setQty] = useState(1);
  const [limit, setLimit] = useState(0);
  const [sl, setSl] = useState(0);
  const [tp, setTp] = useState(0);
  const [riskPct, setRiskPct] = useState(0.5);
  const [pos, setPos] = useState<{ side: Side; qty: number; entry: number; sl: number; tp: number } | null>(null);
  const [fills, setFills] = useState<{ side: Side; entry: number; exit: number; pnl: number; r: number }[]>([]);
  const [working, setWorking] = useState<{ side: Side; type: "limit" | "stop"; price: number; qty: number; sl: number; tp: number } | null>(null);
  const [showFvg, setShowFvg] = useState(true);
  const [showEma, setShowEma] = useState(false);
  const [template, setTemplate] = useState("orb");
  const [auto, setAuto] = useState<ReturnType<typeof runStrategy> | null>(null);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setCursor((c) => (c >= candles.length - 1 ? (setPlaying(false), c) : c + 1)), Math.max(50, 600 / speed));
    return () => clearInterval(t);
  }, [playing, speed, candles.length]);

  useEffect(() => {
    const c = candles[cursor];
    if (!c) return;
    if (working) {
      const hit = working.type === "limit"
        ? (working.side === "long" ? c.l <= working.price : c.h >= working.price)
        : (working.side === "long" ? c.h >= working.price : c.l <= working.price);
      if (hit) {
        setPos({ side: working.side, qty: working.qty, entry: working.price, sl: working.sl, tp: working.tp });
        setWorking(null);
      }
    }
    if (pos) {
      const stopHit = pos.side === "long" ? c.l <= pos.sl : c.h >= pos.sl;
      const tpHit = pos.tp ? (pos.side === "long" ? c.h >= pos.tp : c.l <= pos.tp) : false;
      if (stopHit || tpHit) {
        const exit = stopHit ? pos.sl : pos.tp;
        const pnl = tradePnl(symbol, pos.side, pos.qty, pos.entry, exit, 3);
        const risk = Math.abs(pos.entry - pos.sl) * pos.qty * (SPECS[symbol]?.pv ?? 1);
        setFills((f) => [...f, { side: pos.side, entry: pos.entry, exit, pnl, r: risk ? pnl / risk : 0 }]);
        setPos(null);
      }
    }
  }, [cursor]); // eslint-disable-line

  const last = candles[Math.min(cursor, candles.length - 1)];
  const balance = 50000 + fills.reduce((s, f) => s + f.pnl, 0) + (pos && last ? tradePnl(symbol, pos.side, pos.qty, pos.entry, last.c, 0) : 0);
  const fvg = showFvg ? detectFvg(candles.slice(0, cursor + 1)) : [];
  const emaLine = showEma ? ema(candles.slice(0, cursor + 1).map((c) => c.c), 20) : [];

  const place = () => {
    if (!last) return;
    const spec = SPECS[symbol];
    const dist = last.c * 0.004;
    const stop = sl || (side === "long" ? last.c - dist : last.c + dist);
    const target = tp || (side === "long" ? last.c + dist * 2 : last.c - dist * 2);
    const riskDollarsAmt = 50000 * (riskPct / 100);
    const sized = Math.max(spec.market === "stocks" ? 1 : spec.market === "crypto" ? 0.01 : 1, Number((riskDollarsAmt / (Math.abs(last.c - stop) * spec.pv || 1)).toFixed(2)));
    const q = qty || sized;
    if (type === "market") setPos({ side, qty: q, entry: last.c, sl: stop, tp: target });
    else setWorking({ side, type, price: limit || last.c, qty: q, sl: stop, tp: target });
  };

  const flatten = () => {
    if (!pos || !last) return;
    const pnl = tradePnl(symbol, pos.side, pos.qty, pos.entry, last.c, 3);
    const risk = Math.abs(pos.entry - pos.sl) * pos.qty * (SPECS[symbol]?.pv ?? 1);
    setFills((f) => [...f, { side: pos.side, entry: pos.entry, exit: last.c, pnl, r: risk ? pnl / risk : 0 }]);
    setPos(null);
  };

  const runAuto = () => {
    const result = runStrategy(template, candles, symbol);
    setAuto(result);
    const net = result.reduce((s, t) => s + t.pnl, 0);
    store.saveBacktest({
      id: uid("bt"),
      name: `${symbol} ${template}`,
      mode: "auto",
      symbol,
      strategy: template,
      seed,
      createdAt: new Date().toISOString(),
      note: "Simulated tape. Not live history.",
      net,
      trades: result.map((t) => ({ side: t.side, entry: t.entry, exit: t.exit, pnl: t.pnl, r: t.r })),
    });
    store.toast("Automated run saved");
  };

  return (
    <div className="stack">
      <div className="between wrap">
        <div className="tabs">
          <button className={`tab ${tab === "manual" ? "on" : ""}`} onClick={() => setTab("manual")}>Manual</button>
          <button className={`tab ${tab === "auto" ? "on" : ""}`} onClick={() => setTab("auto")}>Automated</button>
        </div>
        <div className="row">
          <select value={symbol} onChange={(e) => { setSymbol(e.target.value); setCursor(24); setFills([]); setPos(null); setAuto(null); }}>
            {Object.keys(SPECS).map((s) => <option key={s}>{s}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" onClick={() => { setSeed((n) => n + 1); setCursor(24); setFills([]); setPos(null); }}>New tape</button>
        </div>
      </div>
      <p className="faint">Practice tape generated in the browser. It is not  historical exchange data and it will not match a live chart.</p>
      {tab === "manual" ? (
        <div className="replay-layout">
          <div className="card">
            <div className="transport">
              <button className="btn btn-primary btn-sm" onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"}</button>
              <button className="btn btn-ghost btn-sm" onClick={() => setCursor((c) => Math.min(candles.length - 1, c + 1))}>Bar</button>
              {SPEEDS.map((sp) => <button key={sp} className={`chip ${speed === sp ? "on" : ""}`} onClick={() => setSpeed(sp)}>{sp}×</button>)}
              <span className="faint">Bar {cursor + 1} / {candles.length}</span>
              <label className="row"><input type="checkbox" checked={showFvg} onChange={(e) => setShowFvg(e.target.checked)} /> FVG</label>
              <label className="row"><input type="checkbox" checked={showEma} onChange={(e) => setShowEma(e.target.checked)} /> EMA 20</label>
            </div>
            <CandleChart candles={candles} reveal={cursor + 1} height={420} boxes={fvg} lines={[
              ...(pos ? [{ price: pos.entry, color: "#7c6bf6", label: "Position" }, { price: pos.sl, color: "#ff6b7d", label: "SL" }, { price: pos.tp, color: "#3dd68c", label: "TP" }] : []),
              ...(showEma && emaLine.length ? [{ price: emaLine[emaLine.length - 1], color: "#f0b429", label: "EMA" }] : []),
            ]} />
            <div className="between" style={{ marginTop: 8 }}>
              <b>Session {signedMoney(balance - 50000)}</b>
              <span className="muted">Equity {signedMoney(balance)} from a $50k practice account</span>
            </div>
          </div>
          <div className="stack">
            <div className="card">
              <h3>Order ticket</h3>
              <div className="row">
                <button className={`chip ${side === "long" ? "on" : ""}`} onClick={() => setSide("long")}>Buy</button>
                <button className={`chip ${side === "short" ? "on" : ""}`} onClick={() => setSide("short")}>Sell</button>
              </div>
              <div className="stack" style={{ marginTop: 8 }}>
                <label className="field">Type
                  <select value={type} onChange={(e) => setType(e.target.value as never)}>
                    <option value="market">Market</option>
                    <option value="limit">Limit</option>
                    <option value="stop">Stop</option>
                  </select>
                </label>
                {type !== "market" && <label className="field">Price<input type="number" value={limit} onChange={(e) => setLimit(Number(e.target.value))} /></label>}
                <label className="field">Qty <span className="faint">(0 = size from risk)</span><input type="number" value={qty} onChange={(e) => setQty(Number(e.target.value))} /></label>
                <label className="field">Risk %<input type="number" step="0.1" value={riskPct} onChange={(e) => setRiskPct(Number(e.target.value))} /></label>
                <label className="field">Stop<input type="number" value={sl} onChange={(e) => setSl(Number(e.target.value))} placeholder="auto if empty" /></label>
                <label className="field">Target<input type="number" value={tp} onChange={(e) => setTp(Number(e.target.value))} /></label>
                <button className="btn btn-primary" onClick={place}>Place</button>
                <button className="btn btn-ghost" onClick={flatten} disabled={!pos}>Flatten</button>
                {working && <div className="faint">Working {working.type} {working.side} @ {working.price}</div>}
                {pos && <div>Open {pos.side} {pos.qty} @ {priceFmt(symbol, pos.entry)}</div>}
              </div>
            </div>
            <div className="card">
              <h3>Session fills</h3>
              {fills.length === 0 && <p className="muted">No fills yet.</p>}
              {fills.map((f, i) => (
                <div key={i} className="between"><span>{f.side} {priceFmt(symbol, f.entry)} → {priceFmt(symbol, f.exit)}</span><b className={f.pnl >= 0 ? "green" : "red"}>{f.pnl.toFixed(0)} · {f.r.toFixed(2)}R</b></div>
              ))}
              {fills.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => store.saveBacktest({
                  id: uid("bt"), name: `${symbol} manual`, mode: "manual", symbol, seed, createdAt: new Date().toISOString(), note: "Manual drill", net: fills.reduce((s, f) => s + f.pnl, 0), trades: fills,
                })}>Save session</button>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="product-grid">
          <div className="stack">
            {STRATEGY_TEMPLATES.map((t) => (
              <button key={t.id} className={`card`} style={{ textAlign: "left", borderColor: template === t.id ? "var(--accent)" : undefined }} onClick={() => setTemplate(t.id)}>
                <b>{t.name}</b>
                <div className="muted">{t.blurb}</div>
              </button>
            ))}
            <button className="btn btn-primary" onClick={runAuto}>Run on this tape</button>
          </div>
          <div className="card">
            <h3>Result</h3>
            {!auto && <p className="muted">Pick a template. The run uses the simulated tape currently loaded — same seed, same symbol.</p>}
            {auto && (
              <>
                <div className="kpi val" style={{ color: auto.reduce((s, t) => s + t.pnl, 0) >= 0 ? "var(--green)" : "var(--red)" }}>{signedMoney(auto.reduce((s, t) => s + t.pnl, 0))}</div>
                <p className="muted">{auto.length} trades · win rate {auto.length ? Math.round((auto.filter((t) => t.pnl > 0).length / auto.length) * 100) : 0}%</p>
                <table>
                  <tbody>
                    {auto.slice(0, 12).map((t, i) => (
                      <tr key={i}><td>{t.reason}</td><td>{t.side}</td><td className={t.pnl >= 0 ? "green" : "red"}>{t.pnl.toFixed(0)}</td><td>{t.r.toFixed(2)}R</td></tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        </div>
      )}
      <div className="card">
        <h3>Saved sessions</h3>
        {store.backtests.map((b) => (
          <div key={b.id} className="between" style={{ padding: "6px 0" }}>
            <span>{b.name} · {b.mode}{b.strategy ? ` · ${b.strategy}` : ""}</span>
            <b className={b.net >= 0 ? "green" : "red"}>{signedMoney(b.net)}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

void SPECS;
