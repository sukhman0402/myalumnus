import { Icon } from "@/components/Icon";
import { fmtDay } from "@/lib/format";

// The weekly review charts (research/62, option B): one axis per chart, values labelled only where they matter,
// a text description on every chart (role="img"), and the full table one click away. Colours come from the
// design tokens (.ma-chart-* in screens.css); amber marks also carry labels because amber is low-contrast.

const h12 = (h: number) => `${(h + 11) % 12 + 1}${h < 12 ? "AM" : "PM"}`;
const niceMax = (v: number) => Math.max(10, Math.ceil(v / 10) * 10);   // halves are whole numbers

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
  const W = 960, H = 260, top = 20, bot = 36, left = 32;
  const mx = niceMax(Math.max(...days.map((d) => d.n), 0));
  const bw = Math.min(72, (W - left) / days.length - 24), gap = (W - left - days.length * bw) / days.length;
  const y = (v: number) => top + (H - top - bot) * (1 - v / mx);
  const peak = Math.max(...days.map((d) => d.n));
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
            {d.n ? <text x={x + bw / 2} y={H - bot - hgt - 8} className="ma-chart-val" textAnchor="middle">{d.n}</text> : null}
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
  const W = 960, H = 260, top = 30, bot = 36, left = 32, n = shown.length;
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
      {/* Visiting hours as two thin lines with a label, no shaded band (owner, 2026-10-06: "remove the gradient"). */}
      {iOpen >= 0 ? <><line x1={x0(iOpen) - 3} x2={x0(iOpen) - 3} y1={top - 14} y2={H - bot} className="ma-chart-hours" />
        <text x={x0(iOpen) + 2} y={top - 6} className="ma-chart-ax">Visiting hours {h12(open)}–{h12(close)}</text></> : null}
      {iClose >= 0 ? <line x1={x0(iClose) - 3} x2={x0(iClose) - 3} y1={top - 14} y2={H - bot} className="ma-chart-hours" /> : null}
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

export type EscItem = { name: string; host: number; admin: number; open: boolean; legacy: boolean; result: string };

/**
 * Escalations against the limit, one large bar per held visitor (owner, 2026-10-06: "make it bigger").
 * Host first: the first part of a bar is the time the guard spent reaching the host; if it passed to the admins,
 * the second part (amber, hatched) is the time until an admin decided. The dashed line is the campus limit.
 */
export function Escalations({ items, limit }: { items: EscItem[]; limit: number }) {
  if (!items.length) return <p className="ma-note">No visitors were held this week.</p>;
  const W = 960, left = 190, right = 120, rowH = 44, barH = 24, top = 34, H = top + items.length * rowH + 30;
  const mxMin = Math.max(limit + 4, Math.ceil(Math.max(...items.map((i) => i.host + i.admin)) / 5) * 5);
  const sc = (m: number) => left + (W - left - right) * Math.min(m, mxMin) / mxMin;
  const ticks = Array.from({ length: Math.floor(mxMin / 5) + 1 }, (_, k) => k * 5);
  const mm = (m: number) => (m < 1 ? `${Math.round(m * 60)} s` : `${Math.round(m)} min`);
  const desc = `Held visitors this week, against the ${limit}-minute limit: ${items.map((i) => `${i.name}, ${i.result}`).join("; ")}.`;
  return (
    <>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={desc} className="ma-chart-esc">
        {ticks.map((m) => <g key={m}><line x1={sc(m)} x2={sc(m)} y1={top - 10} y2={H - 26} className="ma-chart-grid" /><text x={sc(m)} y={H - 8} className="ma-chart-ax" textAnchor="middle">{m} min</text></g>)}
        <line x1={sc(limit)} x2={sc(limit)} y1={top - 22} y2={H - 26} className="ma-chart-limit" />
        <text x={sc(limit) + 6} y={top - 12} className="ma-chart-ax ma-chart-ax--strong">{limit}-minute limit</text>
        {items.map((it, i) => {
          const y = top + i * rowH, total = it.host + it.admin;
          return (
            <g key={i} className="ma-chart-hit" data-tip={`${it.name}: ${it.result}`}>
              <rect x={0} y={y - 6} width={W} height={rowH - 4} fill="transparent" />
              <text x={left - 12} y={y + barH / 2 + 5} className="ma-chart-name" textAnchor="end">{it.name.length > 20 ? `${it.name.slice(0, 19)}…` : it.name}</text>
              <rect x={sc(0)} y={y} width={Math.max(4, sc(it.host) - sc(0))} height={barH} rx={6} className={it.legacy ? "ma-chart-bar--legacy" : "ma-chart-bar"} />
              {it.admin > 0 ? <rect x={sc(it.host)} y={y} width={Math.max(4, sc(total) - sc(it.host))} height={barH} rx={6} className="ma-chart-bar--admin" /> : null}
              <text x={sc(total) + 8} y={y + barH / 2 + 5} className="ma-chart-val">{it.open ? "open" : mm(total)}</text>
            </g>
          );
        })}
      </svg>
      <ul className="ma-chart-legend">
        <li><span className="ma-chart-key" style={{ background: "var(--ma-chart-bar)" }} />Guard reaching the host</li>
        <li><span className="ma-chart-key ma-chart-bar--admin-key" />With the admins, until decided</li>
      </ul>
    </>
  );
}
