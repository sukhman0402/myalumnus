import { fmtDay } from "@/lib/format";

// The weekly review charts (research/62, option B): one axis per chart, values labelled only where they matter,
// a text description on every chart (role="img"), and the full table one click away. Colours come from the
// design tokens (.ma-chart-* in screens.css); amber marks also carry labels because amber is low-contrast.

const h12 = (h: number) => `${(h + 11) % 12 + 1}${h < 12 ? "AM" : "PM"}`;
// Redesign (owner, 2026-10-08): the escalation chart is gone; KPIs are plain headline numbers; per-day columns
// carry their own labels; outcomes are one labelled stacked bar; visitor types show counts and shares.

/** A headline number (redesign, owner 2026-10-08): label, big value, one line of context. No icon. */
export function Kpi({ value, label, sub, tone }: { value: React.ReactNode; label: string; sub: string; tone?: "hold" | "deny" }) {
  return (
    <div className={`ma-chart-kpi${tone ? ` ma-chart-kpi--${tone}` : ""}`}>
      <span className="ma-chart-kpi__l">{label}</span>
      <b className="ma-chart-kpi__v ma-tabular">{value}</b>
      <span className="ma-chart-kpi__s">{sub}</span>
    </div>
  );
}

/** Part-to-whole as one thick stacked bar, each part labelled with its share; the legend carries counts. */
export function Outcomes({ segs }: { segs: { label: string; n: number; kind: "approve" | "held" | "deny" | "left" }[] }) {
  const total = segs.reduce((t, x) => t + x.n, 0);
  const pct = (n: number) => (total ? Math.round(n * 100 / total) : 0);
  const shown = segs.filter((x) => x.n > 0);
  const desc = `${total} decisions: ${segs.map((x) => `${x.label} ${x.n} (${pct(x.n)}%)`).join("; ")}`;
  return (
    <>
      {shown.length ? (
        <div className="ma-chart-stack" role="img" aria-label={desc}>
          {shown.map((x) => (
            <span key={x.label} className={`ma-chart-seg ma-chart-seg--${x.kind}`} style={{ flex: `${x.n} 0 0` }} data-tip={`${x.label}: ${x.n} (${pct(x.n)}%)`}>
              {pct(x.n) >= 12 ? <span className="ma-chart-seg__v ma-tabular">{pct(x.n)}%</span> : null}
            </span>
          ))}
        </div>
      ) : <p className="ma-note">No decisions this week.</p>}
      <ul className="ma-chart-legend ma-chart-legend--rows">
        {segs.map((x) => <li key={x.label}><span className={`ma-chart-key ma-chart-seg--${x.kind}`} />{x.label}<b className="ma-tabular">{x.n}</b></li>)}
      </ul>
    </>
  );
}

/** Visits per day: seven columns, no y-axis. Every column carries its number (seven short labels read faster than an
 *  axis); the busiest day is the one solid column, the rest a lighter step of the same hue. */
export function DayBars({ days, today }: { days: { d: string; n: number }[]; today?: string }) {
  const W = 960, H = 240, top = 28, bot = 40;
  const mx = Math.max(1, ...days.map((d) => d.n));
  const step = W / days.length, bw = Math.min(88, step - 28);
  const peak = Math.max(...days.map((d) => d.n));
  const busiest = days.find((d) => d.n === peak);
  const desc = `Visits per day: ${days.map((d) => `${fmtDay(d.d)} ${d.n}`).join(", ")}${peak ? `. Busiest ${fmtDay(busiest!.d)} with ${peak}` : ""}.`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={desc}>
      <line x1={0} x2={W} y1={H - bot} y2={H - bot} className="ma-chart-base" />
      {days.map((d, i) => {
        const x = i * step + (step - bw) / 2, hgt = (H - top - bot) * d.n / mx;
        const label = fmtDay(d.d).split(",")[0];
        const hot = peak > 0 && d.n === peak;
        return (
          <g key={d.d} className="ma-chart-hit" data-tip={`${fmtDay(d.d)}: ${d.n} ${d.n === 1 ? "visit" : "visits"}`}>
            <rect x={i * step} y={0} width={step} height={H} fill="transparent" />
            {d.n ? <rect x={x} y={H - bot - hgt} width={bw} height={hgt} rx={6} className={hot ? "ma-chart-bar" : "ma-chart-bar ma-chart-bar--soft"} /> : null}
            <text x={x + bw / 2} y={H - bot - hgt - 8} className={hot ? "ma-chart-val ma-chart-val--big" : "ma-chart-val"} textAnchor="middle">{d.n}</text>
            <text x={x + bw / 2} y={H - bot + 22} className={`ma-chart-ax${d.d === today ? " ma-chart-ax--strong" : ""}`} textAnchor="middle">{d.d === today ? "Today" : label}</text>
          </g>
        );
      })}
    </svg>
  );
}

export function HourBars({ hours, open, close }: { hours: { h: number; n: number }[]; open: number; close: number }) {
  const withData = hours.filter((x) => x.n > 0).map((x) => x.h);
  const first = Math.max(0, Math.min(open - 2, ...withData)), last = Math.min(23, Math.max(close + 1, ...withData));
  const shown = hours.filter((x) => x.h >= first && x.h <= last);
  const W = 960, H = 280, top = 56, bot = 36, left = 0, n = shown.length;   // room above the tallest bar for the hours label
  const mx = Math.max(1, ...shown.map((x) => x.n));   // no y-axis: the tallest bar fills the height
  const step = (W - left) / n, bw = step - 14;
  const x0 = (i: number) => left + i * step + 7;
  const out = shown.filter((x) => x.n && (x.h < open || x.h >= close));
  const iOpen = shown.findIndex((x) => x.h === open), iClose = shown.findIndex((x) => x.h === close);
  const peak = shown.reduce((a, b) => (b.n > a.n ? b : a), shown[0]);
  const desc = `Arrivals by hour${peak?.n ? `: peak at ${h12(peak.h)} with ${peak.n}` : ": none"}; ${out.reduce((s, x) => s + x.n, 0)} outside visiting hours.`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={desc}>
      {/* Visiting hours as two thin lines with a label, no shaded band (owner, 2026-10-06: "remove the gradient"). */}
      {iOpen >= 0 ? <><line x1={x0(iOpen) - 3} x2={x0(iOpen) - 3} y1={4} y2={H - bot} className="ma-chart-hours" />
        <text x={x0(iOpen) + 2} y={14} className="ma-chart-ax">Visiting hours {h12(open)}–{h12(close)}</text></> : null}
      {iClose >= 0 ? <line x1={x0(iClose) - 3} x2={x0(iClose) - 3} y1={4} y2={H - bot} className="ma-chart-hours" /> : null}
      <line x1={left} x2={W} y1={H - bot} y2={H - bot} className="ma-chart-base" />
      {shown.map((x, i) => {
        const outside = x.h < open || x.h >= close, hgt = (H - top - bot) * x.n / mx;
        return (
          <g key={x.h} className="ma-chart-hit" data-tip={`${h12(x.h)}: ${x.n} ${x.n === 1 ? "arrival" : "arrivals"}${outside ? " · outside visiting hours" : ""}`}>
            <rect x={x0(i) - 3} y={top} width={bw + 6} height={H - top - bot} fill="transparent" />
            {x.n ? <rect x={x0(i)} y={H - bot - hgt} width={bw} height={hgt} rx={5} className={`ma-chart-bar${outside ? " ma-chart-bar--out" : ""}`} /> : null}
            {i % 2 === 0 ? <text x={x0(i) + bw / 2} y={H - bot + 18} className="ma-chart-ax" textAnchor="middle">{h12(x.h)}</text> : null}
            {x.n && (outside || x === peak) ? <text x={x0(i) + bw / 2} y={H - bot - hgt - 6} className="ma-chart-val" textAnchor="middle">{x.n}</text> : null}
          </g>
        );
      })}
    </svg>
  );
}

export function TypeBars({ rows, note }: { rows: { label: string; n: number }[]; note?: string }) {
  const sorted = [...rows].sort((a, b) => b.n - a.n);
  const mx = Math.max(1, ...sorted.map((r) => r.n)), total = sorted.reduce((s, r) => s + r.n, 0);
  return (
    <>
      <ul className="ma-chart-hbars" aria-label="Visits by visitor type">
        {sorted.map((r) => (
          <li key={r.label} className="ma-chart-hbar" data-tip={`${r.label}: ${r.n}${total ? `, ${Math.round(r.n * 100 / total)}%` : ""}`}>
            <span className="ma-chart-hbar__l">{r.label}</span>
            <span className="ma-chart-hbar__track"><span className="ma-chart-hbar__fill" style={{ width: `${(r.n * 100 / mx).toFixed(1)}%` }} /></span>
            <b className="ma-tabular">{r.n}<span className="ma-chart-hbar__p">{total ? ` · ${Math.round(r.n * 100 / total)}%` : ""}</span></b>
          </li>
        ))}
      </ul>
      {note ? <p className="ma-note">{note}</p> : null}
    </>
  );
}
