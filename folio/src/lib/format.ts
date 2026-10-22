import type { ViewMode } from "./types";

export function etParts(iso: string) {
  const d = new Date(iso);
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const parts = Object.fromEntries(fmt.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: parts.weekday,
  };
}

export function etDate(iso: string) {
  return etParts(iso).date;
}

export function etHour(iso: string) {
  return etParts(iso).hour;
}

export function formatEt(iso: string, withDate = false) {
  const p = etParts(iso);
  const h = p.hour % 12 || 12;
  const ap = p.hour >= 12 ? "PM" : "AM";
  const time = `${h}:${String(p.minute).padStart(2, "0")} ${ap} ET`;
  if (!withDate) return time;
  return `${p.date} · ${time}`;
}

export function formatLocal(iso: string, tz = "Africa/Casablanca") {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "short",
  }).format(new Date(iso));
}

export function clock(tz: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date());
}

export function money(n: number, digits = 2) {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  return `${sign}$${abs.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits })}`;
}

export function compactMoney(n: number) {
  const sign = n < 0 ? "-" : n > 0 ? "" : "";
  const abs = Math.abs(n);
  if (abs >= 10000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(2)}K`;
  return money(n, abs >= 100 ? 0 : 2).replace("-", sign === "-" ? "-" : "");
}

export function signedMoney(n: number) {
  const core = money(Math.abs(n));
  if (n > 0) return `+${core}`;
  if (n < 0) return `-${core}`;
  return core;
}

export function viewValue(n: number, view: ViewMode, base = 100000, rDenom = 250) {
  if (view === "privacy") return "••••";
  if (view === "percent") {
    const p = (n / base) * 100;
    const sign = p > 0 ? "+" : "";
    return `${sign}${p.toFixed(2)}%`;
  }
  if (view === "r") {
    const r = n / (rDenom || 1);
    const sign = r > 0 ? "+" : "";
    return `${sign}${r.toFixed(2)}R`;
  }
  return signedMoney(n);
}

export function pct(n: number, digits = 1) {
  if (!Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(digits)}%`;
}

export function holdLabel(min: number) {
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function priceFmt(symbol: string, price: number) {
  const digits = symbol.endsWith("USD") && symbol.length === 6 ? 5 : symbol === "BTCUSD" ? 1 : 2;
  return price.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function clsx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

export function uid(prefix = "id") {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-3)}`;
}

export function monthLabel(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

export function addMonths(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function inRange(date: string, from?: string, to?: string) {
  if (from && date < from) return false;
  if (to && date > to) return false;
  return true;
}

export const TODAY = "2026-10-22";

export function rangeBounds(key: string, from?: string, to?: string): { from?: string; to?: string } {
  if (key === "all") return {};
  if (key === "custom") return { from, to };
  if (key === "month") return { from: "2026-10-01", to: TODAY };
  if (key === "30d") return { from: "2026-09-22", to: TODAY };
  if (key === "90d") return { from: "2026-07-24", to: TODAY };
  if (key === "ytd") return { from: "2026-01-01", to: TODAY };
  return {};
}
