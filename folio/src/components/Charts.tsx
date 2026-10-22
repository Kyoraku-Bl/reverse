import { useMemo, useState } from "react";
import type { Candle, Fvg } from "../lib/market";

export function EquityChart({ data, height = 180 }: { data: { date: string; equity: number }[]; height?: number }) {
  const w = 640;
  const h = height;
  if (data.length < 2) return <div className="muted">Not enough sessions.</div>;
  const min = Math.min(0, ...data.map((d) => d.equity));
  const max = Math.max(...data.map((d) => d.equity), 1);
  const x = (i: number) => (i / (data.length - 1)) * (w - 16) + 8;
  const y = (v: number) => h - 16 - ((v - min) / (max - min || 1)) * (h - 28);
  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.equity).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${h - 8} L8,${h - 8} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={height} role="img" aria-label="Equity curve">
      <defs>
        <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3dd68c" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#3dd68c" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 0.5, 1].map((g) => (
        <line key={g} x1="0" x2={w} y1={16 + g * (h - 32)} y2={16 + g * (h - 32)} stroke="currentColor" opacity="0.08" />
      ))}
      <path d={area} fill="url(#eq)" />
      <path d={line} fill="none" stroke="#7d9bff" strokeWidth="2.4" />
    </svg>
  );
}

export function Radar({ parts }: { parts: { label: string; value: number }[] }) {
  const n = parts.length || 1;
  const cx = 120;
  const cy = 112;
  const r = 72;
  const pt = (i: number, mag: number) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
    return [cx + Math.cos(a) * r * mag, cy + Math.sin(a) * r * mag];
  };
  const poly = parts.map((p, i) => pt(i, Math.max(0.08, p.value / 100)).join(",")).join(" ");
  const grid = [0.35, 0.65, 1].map((g) => parts.map((_, i) => pt(i, g).join(",")).join(" "));
  return (
    <svg viewBox="0 0 240 230" width="100%" height="210">
      {grid.map((g) => (
        <polygon key={g} points={g} fill="none" stroke="currentColor" opacity="0.15" />
      ))}
      <polygon points={poly} fill="rgba(124,107,246,0.35)" stroke="#a99bff" strokeWidth="1.6" />
      {parts.map((p, i) => {
        const [x, y] = pt(i, 1.18);
        return (
          <text key={p.label} x={x} y={y} textAnchor="middle" fontSize="9" fill="currentColor" opacity="0.7">
            {p.label}
          </text>
        );
      })}
    </svg>
  );
}

export function Gauge({ value, max = 100 }: { value: number; max?: number }) {
  const p = Math.max(0, Math.min(1, value / max));
  const ang = Math.PI * (1 - p);
  const x = 50 + Math.cos(ang) * 36;
  const y = 54 - Math.sin(ang) * 36;
  return (
    <svg viewBox="0 0 100 62" width="92" height="58">
      <path d="M10 54 A40 40 0 0 1 90 54" fill="none" stroke="currentColor" opacity="0.15" strokeWidth="8" strokeLinecap="round" />
      <path d="M10 54 A40 40 0 0 1 90 54" fill="none" stroke="url(#g)" strokeWidth="8" strokeLinecap="round" strokeDasharray={`${p * 126} 126`} />
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#ff6b7d" />
          <stop offset="50%" stopColor="#f0b429" />
          <stop offset="100%" stopColor="#3dd68c" />
        </linearGradient>
      </defs>
      <circle cx={x} cy={y} r="4" fill="#f5f6f8" />
    </svg>
  );
}

export function Ring({ value, label }: { value: number; label?: string }) {
  const p = Math.max(0, Math.min(1, value));
  const c = 2 * Math.PI * 28;
  return (
    <svg viewBox="0 0 72 72" width="72" height="72">
      <circle cx="36" cy="36" r="28" fill="none" stroke="currentColor" opacity="0.12" strokeWidth="7" />
      <circle cx="36" cy="36" r="28" fill="none" stroke="#7c6bf6" strokeWidth="7" strokeDasharray={`${c * p} ${c}`} strokeLinecap="round" transform="rotate(-90 36 36)" />
      {label && (
        <text x="36" y="40" textAnchor="middle" fontSize="11" fill="currentColor" fontFamily="JetBrains Mono, monospace">
          {label}
        </text>
      )}
    </svg>
  );
}

export function HSplit({ win, loss }: { win: number; loss: number }) {
  const t = win + loss || 1;
  return (
    <div style={{ display: "flex", height: 8, borderRadius: 99, overflow: "hidden", width: "100%", marginTop: 8 }}>
      <i style={{ width: `${(win / t) * 100}%`, background: "#3dd68c" }} />
      <i style={{ width: `${(loss / t) * 100}%`, background: "#ff6b7d" }} />
    </div>
  );
}

export function Bars({ data }: { data: { label: string; value: number }[] }) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  return (
    <div className="stack" style={{ gap: 6 }}>
      {data.map((d) => (
        <div key={d.label} className="row" style={{ gap: 8 }}>
          <span className="faint" style={{ width: 72, fontSize: 12 }}>{d.label}</span>
          <div style={{ flex: 1, height: 8, background: "var(--bg)", borderRadius: 99, overflow: "hidden" }}>
            <i style={{ display: "block", height: "100%", width: `${(Math.abs(d.value) / max) * 100}%`, background: d.value >= 0 ? "#3dd68c" : "#ff6b7d" }} />
          </div>
          <span className="num" style={{ width: 72, textAlign: "right", fontSize: 12, color: d.value >= 0 ? "var(--green)" : "var(--red)" }}>
            {d.value >= 0 ? "+" : ""}
            {Math.round(d.value).toLocaleString()}
          </span>
        </div>
      ))}
    </div>
  );
}

export function CandleChart({
  candles,
  reveal,
  lines = [],
  markers = [],
  boxes = [],
  height = 380,
  onPick,
}: {
  candles: Candle[];
  reveal?: number;
  lines?: { price: number; color: string; label: string }[];
  markers?: { index: number; label: string; color: string }[];
  boxes?: Fvg[];
  height?: number;
  onPick?: (index: number, price: number) => void;
}) {
  const shown = candles.slice(0, reveal ?? candles.length);
  const [hover, setHover] = useState<number | null>(null);
  const pad = { l: 8, r: 64, t: 12, b: 22 };
  const w = 860;
  const h = height;
  const prices = shown.flatMap((c) => [c.h, c.l]).concat(lines.map((l) => l.price));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const y = (p: number) => pad.t + ((max - p) / (max - min || 1)) * (h - pad.t - pad.b);
  const slot = (w - pad.l - pad.r) / Math.max(shown.length, 1);
  const x = (i: number) => pad.l + i * slot + slot / 2;
  const ticks = useMemo(() => {
    return [0, 0.25, 0.5, 0.75, 1].map((g) => max - g * (max - min));
  }, [max, min]);
  if (!shown.length) return <div className="muted">No tape.</div>;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      width="100%"
      height={height}
      onMouseLeave={() => setHover(null)}
      onClick={(e) => {
        if (!onPick) return;
        const rect = (e.target as SVGElement).ownerSVGElement?.getBoundingClientRect() ?? (e.currentTarget as SVGSVGElement).getBoundingClientRect();
        const px = ((e.clientX - rect.left) / rect.width) * w;
        const py = ((e.clientY - rect.top) / rect.height) * h;
        const index = Math.max(0, Math.min(shown.length - 1, Math.floor((px - pad.l) / slot)));
        const price = max - ((py - pad.t) / (h - pad.t - pad.b)) * (max - min);
        onPick(index, price);
      }}
    >
      {ticks.map((p) => (
        <g key={p}>
          <line x1={pad.l} x2={w - pad.r} y1={y(p)} y2={y(p)} stroke="currentColor" opacity="0.08" />
          <text x={w - pad.r + 6} y={y(p) + 4} fontSize="10" fill="currentColor" opacity="0.55" fontFamily="JetBrains Mono, monospace">
            {p > 100 ? p.toFixed(1) : p.toFixed(p < 10 ? 5 : 2)}
          </text>
        </g>
      ))}
      {boxes.map((b, i) => (
        <rect key={i} x={x(b.from)} y={y(b.top)} width={Math.max(6, x(Math.min(b.to, shown.length - 1)) - x(b.from))} height={Math.max(2, y(b.bottom) - y(b.top))} fill={b.dir === "up" ? "rgba(61,214,140,0.18)" : "rgba(255,107,125,0.18)"} />
      ))}
      {lines.map((l) => (
        <g key={l.label}>
          <line x1={pad.l} x2={w - pad.r} y1={y(l.price)} y2={y(l.price)} stroke={l.color} strokeDasharray="4 4" />
          <text x={pad.l + 4} y={y(l.price) - 4} fontSize="10" fill={l.color}>{l.label}</text>
        </g>
      ))}
      {shown.map((c, i) => {
        const up = c.c >= c.o;
        const color = up ? "#3dd68c" : "#ff6b7d";
        const body = Math.max(1, Math.abs(y(c.o) - y(c.c)));
        return (
          <g key={c.t} onMouseEnter={() => setHover(i)}>
            <line x1={x(i)} x2={x(i)} y1={y(c.h)} y2={y(c.l)} stroke={color} strokeWidth="1.2" />
            <rect x={x(i) - Math.max(1.5, slot * 0.32)} y={Math.min(y(c.o), y(c.c))} width={Math.max(3, slot * 0.64)} height={body} fill={color} rx="1" />
          </g>
        );
      })}
      {markers.filter((m) => m.index < shown.length).map((m) => (
        <g key={m.label + m.index}>
          <circle cx={x(m.index)} cy={y(shown[m.index].c)} r="4" fill={m.color} />
          <text x={x(m.index) + 6} y={y(shown[m.index].c) - 6} fontSize="10" fill={m.color}>{m.label}</text>
        </g>
      ))}
      {hover != null && shown[hover] && (
        <g>
          <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={h - pad.b} stroke="currentColor" opacity="0.25" />
          <text x={pad.l + 6} y={16} fontSize="11" fill="currentColor">
            {new Date(shown[hover].t).toLocaleString()} · O {shown[hover].o} H {shown[hover].h} L {shown[hover].l} C {shown[hover].c}
          </text>
        </g>
      )}
    </svg>
  );
}
