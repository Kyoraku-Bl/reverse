import { Fragment, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { addMonths, compactMoney, monthLabel } from "../lib/format";
import type { DayStat } from "../lib/stats";
import { ChevronLeft, ChevronRight } from "lucide-react";

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

  return (
    <div className="card">
      <div className="cal-head">
        <div className="row">
          <button className="icon-btn" onClick={() => setMonth(addMonths(month, -1))} aria-label="Previous month"><ChevronLeft size={16} /></button>
          <strong>{monthLabel(month)}</strong>
          <button className="icon-btn" onClick={() => setMonth(addMonths(month, 1))} aria-label="Next month"><ChevronRight size={16} /></button>
          <button className="btn btn-ghost btn-sm" onClick={() => setMonth("2026-10")}>This month</button>
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
