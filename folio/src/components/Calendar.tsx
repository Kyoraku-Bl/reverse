import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { addMonths, compactMoney, monthLabel } from "../lib/format";
import type { DayStat } from "../lib/stats";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function MonthCalendar({
  month,
  setMonth,
  daily,
  monthNet,
}: {
  month: string;
  setMonth: (m: string) => void;
  daily: DayStat[];
  monthNet: number;
}) {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const switchRef = useRef<HTMLDivElement>(null);
  const cells = useMemo(() => {
    const [y, m] = month.split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const startPad = first.getUTCDay();
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const map = new Map(daily.filter((d) => d.date.startsWith(month)).map((d) => [d.date, d]));
    const out: Array<DayStat | null> = Array.from({ length: startPad }, () => null);
    for (let d = 1; d <= days; d++) {
      const key = `${month}-${String(d).padStart(2, "0")}`;
      out.push(map.get(key) ?? { date: key, pnl: 0, trades: 0, wins: 0, r: 0, fees: 0 });
    }
    while (out.length % 7) out.push(null);
    return out;
  }, [month, daily]);

  const weeks: Array<Array<DayStat | null>> = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  const activeDays = daily.filter((d) => d.date.startsWith(month) && d.trades).length;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (switchRef.current && !switchRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    switchRef.current?.querySelector<HTMLButtonElement>("[data-year-on]")?.scrollIntoView({ block: "center" });
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, month]);

  const year = Number(month.slice(0, 4));
  const years = useMemo(() => {
    const now = new Date().getFullYear();
    const start = Math.min(2010, year - 2);
    const end = Math.max(now + 3, year + 2);
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }, [year]);

  const pick = (value: string) => {
    setMonth(value);
    setOpen(false);
  };

  return (
    <div className="card">
      <div className="cal-head">
        <div className="row month-switch" ref={switchRef}>
          <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft size={16} /></button>
          <button type="button" className="month-title" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="dialog">
            {monthLabel(month)}
            <ChevronDown size={14} />
          </button>
          <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month"><ChevronRight size={16} /></button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>This month</button>
          {open && (
            <div className="month-picker" role="dialog" aria-label="Choose month and year">
              <div className="month-picker-years" role="listbox" aria-label="Years">
                {years.map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    data-year-on={yr === year ? "" : undefined}
                    className={yr === year ? "on" : ""}
                    onClick={() => setMonth(`${yr}-${month.slice(5, 7)}`)}
                  >
                    {yr}
                  </button>
                ))}
              </div>
              <div>
                <div className="month-picker-grid" role="listbox" aria-label="Months">
                  {MONTHS.map((label, i) => {
                    const value = `${year}-${String(i + 1).padStart(2, "0")}`;
                    return (
                      <button key={label} type="button" className={value === month ? "on" : ""} onClick={() => pick(value)}>
                        {label}
                      </button>
                    );
                  })}
                </div>
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8, width: "100%" }} onClick={() => pick(currentMonth())}>
                  This month
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="muted" style={{ fontSize: 12 }}>
          Monthly stats: <b className={monthNet >= 0 ? "green" : "red"}>{compactMoney(monthNet)}</b> · {activeDays} days
        </div>
      </div>
      <div className="cal-grid">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="cal-dow">{d}</div>
        ))}
        <div />
        {weeks.map((week, wi) => {
          const pnl = week.reduce((s, d) => s + (d?.pnl ?? 0), 0);
          const days = week.filter((d) => d && d.trades).length;
          return (
            <Fragment key={wi}>
              {week.map((d, di) => {
                if (!d) return <div key={`${wi}-${di}`} />;
                const dayNum = Number(d.date.slice(-2));
                const tone = d.trades === 0 ? "" : d.pnl > 1 ? "win" : d.pnl < -1 ? "loss" : "flat";
                return (
                  <div key={d.date} className={`cal-cell ${tone}`}>
                    <button onClick={() => nav(`/app/day/${d.date}`)}>
                      <span className="d">{dayNum}</span>
                      {d.trades > 0 && (
                        <>
                          <span className="pnl num">{compactMoney(d.pnl)}</span>
                          <span className="faint">{d.trades} trade{d.trades === 1 ? "" : "s"}</span>
                          <span className="faint">{d.trades ? Math.round((d.wins / d.trades) * 100) : 0}%</span>
                        </>
                      )}
                    </button>
                  </div>
                );
              })}
              <div className="week-pill">
                <span className="faint">Week {wi + 1}</span>
                <b className={pnl >= 0 ? "green" : "red"}>{compactMoney(pnl)}</b>
                <span className="faint">{days} day{days === 1 ? "" : "s"}</span>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}
