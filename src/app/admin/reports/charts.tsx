import { Icon } from "@/components/Icon";
import { fmtDay } from "@/lib/format";

// The weekly review charts (research/62, option B): one axis per chart, values labelled only where they matter,
// a text description on every chart (role="img"), and the full table one click away. Colours come from the
// design tokens (.ma-chart-* in screens.css); amber marks also carry labels because amber is low-contrast.

const h12 = (h: number) => `${(h + 11) % 12 + 1}${h < 12 ? "AM" : "PM"}`;
const niceMax = (v: number) => Math.max(5, Math.ceil(v / 5) * 5);

export function Kpi({ value, label, sub, icon }: { value: React.ReactNode; label: string; sub: string; icon: string }) {
  return (
    <div className="ma-chart-kpi">
      <span className="ma-chart-kpi__l"><Icon name={icon} size={16} />{label}</span>
      <b className="ma-chart-kpi__v ma-tabular">{value}</b>
      <span className="ma-note">{sub}</span>
    </div>
  );
}

export function Outcomes({ segs }: { segs: { label: string; n: number; kind: "approve" | "held" | "deny" }[] }) {
  const shown = segs.filter((s) => s.n > 0);
  const desc = segs.map((s) => `${s.label}: ${s.n}`).join("; ");
  return (
    <>
      {shown.length ? (
        <div className="ma-chart-stack" role="img" aria-label={desc}>
          {shown.map((s) => <span key={s.label} className={`ma-chart-seg ma-chart-seg--${s.kind}`} style={{ flex: `${s.n} 0 0` }} data-tip={`${s.label}: ${s.n}`} />)}
        </div>
      ) : <p className="ma-note">No decisions this week.</p>}
      <ul className="ma-chart-legend">{segs.map((s) => <li key={s.label}><span className={`ma-chart-key ma-chart-seg--${s.kind}`} />{s.label} <b className="ma-tabular">{s.n}</b></li>)}</ul>
    </>
  );
}

export function DayBars({ days }: { days: { d: string; n: number }[] }) {
  const W = 560, H = 220, top = 16, bot = 36, left = 28;
  const mx = niceMax(Math.max(...days.map((d) => d.n), 0));
  const bw = Math.min(44, (W - left) / days.length - 12), gap = (W - left - days.length * bw) / days.length;
  const y = (v: number) => top + (H - top - bot) * (1 - v / mx);
  const peak = Math.max(...days.map((d) => d.n));
  const low = Math.min(...days.map((d) => d.n));
  const busiest = days.find((d) => d.n === peak);
  const desc = `Visits per day: ${days.map((d) => `${fmtDay(d.d)} ${d.n}`).join(", ")}${peak ? `. Busiest ${fmtDay(busiest!.d)} with ${peak}` : ""}.`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={desc}>
      {[0, mx / 2, mx].map((v) => <g key={v}><line x1={left} x2={W} y1={y(v)} y2={y(v)} className="ma-chart-grid" /><text x={left - 6} y={y(v) + 4} className="ma-chart-ax" textAnchor="end">{v}</text></g>)}
      {days.map((d, i) => {
        const x = left + gap / 2 + i * (bw + gap), hgt = (H - top - bot) * d.n / mx;
        const label = fmtDay(d.d);
        return (
          <g key={d.d} className="ma-chart-hit" data-tip={`${label}: ${d.n} ${d.n === 1 ? "visit" : "visits"}`}>
            <rect x={x - gap / 2} y={top} width={bw + gap} height={H - top - bot} fill="transparent" />
            {d.n ? <rect x={x} y={H - bot - hgt} width={bw} height={hgt} rx={4} className="ma-chart-bar" /> : null}
            <text x={x + bw / 2} y={H - bot + 18} className="ma-chart-ax" textAnchor="middle">{label.split(",")[0]}</text>
            {d.n && (d.n === peak || (d.n === low && low !== peak)) ? <text x={x + bw / 2} y={H - bot - hgt - 6} className="ma-chart-val" textAnchor="middle">{d.n}</text> : null}
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
  const W = 560, H = 220, top = 28, bot = 36, left = 28, n = shown.length;
  const mx = niceMax(Math.max(...shown.map((x) => x.n), 0));
  const step = (W - left) / n, bw = step - 6;
  const x0 = (i: number) => left + i * step + 3;
  const y = (v: number) => top + (H - top - bot) * (1 - v / mx);
  const out = shown.filter((x) => x.n && (x.h < open || x.h >= close));
  const iOpen = shown.findIndex((x) => x.h === open), iClose = shown.findIndex((x) => x.h === close);
  const peak = shown.reduce((a, b) => (b.n > a.n ? b : a), shown[0]);
  const desc = `Arrivals by hour${peak?.n ? `: peak at ${h12(peak.h)} with ${peak.n}` : ": none"}; ${out.reduce((s, x) => s + x.n, 0)} outside visiting hours.`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={desc}>
      {iOpen >= 0 ? <><rect x={x0(iOpen) - 3} y={top - 20} width={(iClose >= 0 ? x0(iClose) : W) - x0(iOpen)} height={H - bot - top + 20} className="ma-chart-band" />
        <text x={x0(iOpen) + 2} y={top - 8} className="ma-chart-ax">Visiting hours {h12(open)}–{h12(close)}</text></> : null}
      {[0, mx / 2, mx].map((v) => <g key={v}><line x1={left} x2={W} y1={y(v)} y2={y(v)} className="ma-chart-grid" /><text x={left - 6} y={y(v) + 4} className="ma-chart-ax" textAnchor="end">{v}</text></g>)}
      {shown.map((x, i) => {
        const outside = x.h < open || x.h >= close, hgt = (H - top - bot) * x.n / mx;
        return (
          <g key={x.h} className="ma-chart-hit" data-tip={`${h12(x.h)}: ${x.n} ${x.n === 1 ? "arrival" : "arrivals"}${outside ? " · outside visiting hours" : ""}`}>
            <rect x={x0(i) - 3} y={top} width={bw + 6} height={H - top - bot} fill="transparent" />
            {x.n ? <rect x={x0(i)} y={H - bot - hgt} width={bw} height={hgt} rx={3} className={`ma-chart-bar${outside ? " ma-chart-bar--out" : ""}`} /> : null}
            {i % 2 === 0 ? <text x={x0(i) + bw / 2} y={H - bot + 18} className="ma-chart-ax" textAnchor="middle">{h12(x.h)}</text> : null}
            {x.n && outside ? <text x={x0(i) + bw / 2} y={H - bot - hgt - 6} className="ma-chart-val" textAnchor="middle">{x.n}</text> : null}
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
            <b className="ma-tabular">{r.n}</b>
          </li>
        ))}
      </ul>
      {note ? <p className="ma-note">{note}</p> : null}
    </>
  );
}

export function Escalations({ items, limit }: { items: { name: string; minutes: number; who: "admin" | "host" | "guard" | "open"; result: string }[]; limit: number }) {
  if (!items.length) return <p className="ma-note">No visitors were held this week.</p>;
  const W = 560, left = 140, right = 20, rowH = 24, H = 40 + items.length * rowH + 10;
  const mxMin = Math.max(limit + 2, Math.ceil(Math.max(...items.map((i) => i.minutes)) / 2) * 2);
  const sc = (m: number) => left + (W - left - right) * Math.min(m, mxMin) / mxMin;
  const ticks = Array.from({ length: Math.floor(mxMin / 2) + 1 }, (_, k) => k * 2).filter((m, k, a) => a.length <= 8 || k % 2 === 0);
  const desc = `Escalations this week: ${items.map((i) => `${i.name}, ${i.result}${i.who === "admin" ? ` in ${i.minutes.toFixed(1)} minutes` : ""}`).join("; ")}.`;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={desc}>
        {ticks.map((m) => <g key={m}><line x1={sc(m)} x2={sc(m)} y1={10} y2={H - 30} className="ma-chart-grid" /><text x={sc(m)} y={H - 12} className="ma-chart-ax" textAnchor="middle">{m} min</text></g>)}
        <line x1={sc(limit)} x2={sc(limit)} y1={6} y2={H - 30} className="ma-chart-limit" />
        <text x={sc(limit) + 4} y={16} className="ma-chart-ax">Host call at {limit} min</text>
        {items.map((it, i) => {
          const y = 30 + i * rowH;
          return (
            <g key={i} className="ma-chart-hit" data-tip={`${it.name}: ${it.result}`}>
              <text x={left - 10} y={y + 4} className="ma-chart-ax" textAnchor="end">{it.name.length > 18 ? `${it.name.slice(0, 17)}…` : it.name}</text>
              <line x1={sc(0)} x2={sc(it.minutes)} y1={y} y2={y} className="ma-chart-stem" />
              <circle cx={sc(it.minutes)} cy={y} r={6} className={`ma-chart-dot ma-chart-dot--${it.who === "admin" ? "admin" : "host"}`} />
            </g>
          );
        })}
      </svg>
      <ul className="ma-chart-legend">
        <li><span className="ma-chart-key ma-chart-dot--admin" />Decided by admin</li>
        <li><span className="ma-chart-key ma-chart-dot--host" />Passed to the host, or still open</li>
      </ul>
    </>
  );
}
