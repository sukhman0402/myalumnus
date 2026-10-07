import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { tr } from "@/lib/i18n";
import { Icon } from "@/components/Icon";
import { fmtTime } from "@/lib/format";
import { getToday, requireOnDuty } from "@/lib/gate";
import { GateShell } from "../GateShell";

export const metadata: Metadata = { title: "Insights · Guard console" };

type Shift = { since: string | null; approved: number; denied: number; held: number; passed: number; family: number };

/** This shift's numbers for the guard on duty, and today's at this gate, as simple charts (owner, 2026-10-06/07).
 *  Nothing here needs a decision, so it never competes with Home. */
export default async function InsightsPage() {
  const duty = await requireOnDuty("insights");
  const { lang } = duty;
  const supabase = await createClient();
  const [{ data }, today] = await Promise.all([supabase.rpc("gate_insights"), getToday()]);
  const s = ((data ?? []) as Shift[])[0];
  // Infographics instead of number tiles (owner, 2026-10-07). Bars share one scale so they compare at a glance.
  const shift: [string, number, string][] = [
    [tr(lang, "ins.approved"), s?.approved ?? 0, "approve"], [tr(lang, "ins.denied"), s?.denied ?? 0, "deny"],
    [tr(lang, "ins.held"), s?.held ?? 0, "hold"], [tr(lang, "ins.passed"), s?.passed ?? 0, "hold"], [tr(lang, "ins.family"), s?.family ?? 0, "plain"],
  ];
  const max = Math.max(1, ...shift.map(([, n]) => n));
  const visits = today?.visits ?? 0, inside = today?.inside ?? 0;
  const R = 52, C = 2 * Math.PI * R, share = visits ? Math.min(1, inside / visits) : 0;
  return (
    <GateShell duty={duty} title={tr(lang, "title.insights")}>
      <section className="ma-panel" aria-labelledby="sh">
        <h2 className="ma-panel__title" id="sh">{tr(lang, "ins.shift")}</h2>
        <p className="ma-note">{tr(lang, "ins.since", { n: duty.guard.name, t: fmtTime(s?.since ?? duty.since) })}</p>
        <ul className="ma-ins-bars">
          {shift.map(([label, n, kind]) => (
            <li key={label}>
              <span className="ma-ins-bars__l">{label}</span>
              <span className="ma-ins-bars__track"><span className={`ma-ins-bars__fill is-${kind}${n ? "" : " is-zero"}`} style={{ width: `${(n * 100 / max).toFixed(1)}%` }} /></span>
              <b className="ma-tabular">{n}</b>
            </li>
          ))}
        </ul>
      </section>
      <section className="ma-panel" aria-labelledby="td">
        <h2 className="ma-panel__title" id="td">{tr(lang, "ins.today", { g: duty.me.gate_name ?? "" })}</h2>
        <div className="ma-ins-today">
          <svg viewBox="0 0 128 128" className="ma-ins-ring" role="img" aria-label={`${tr(lang, "ins.inside")}: ${inside} · ${tr(lang, "ins.visits")}: ${visits}`}>
            <circle cx="64" cy="64" r={R} className="ma-ins-ring__track" />
            <circle cx="64" cy="64" r={R} className="ma-ins-ring__fill" strokeDasharray={`${(C * share).toFixed(1)} ${C.toFixed(1)}`} transform="rotate(-90 64 64)" />
            <text x="64" y="62" textAnchor="middle" className="ma-ins-ring__n">{inside}</text>
            <text x="64" y="82" textAnchor="middle" className="ma-ins-ring__l">/ {visits}</text>
          </svg>
          <dl className="ma-ins-kv">
            <div><dt><span className="ma-ins-dot is-accent" />{tr(lang, "ins.inside")}</dt><dd className="ma-tabular">{inside}</dd></div>
            <div><dt><span className="ma-ins-dot" />{tr(lang, "ins.visits")}</dt><dd className="ma-tabular">{visits}</dd></div>
            <div><dt><Icon name="calendar-clock" size={16} />{tr(lang, "ins.expected")}</dt><dd className="ma-tabular">{today?.expected ?? 0}</dd></div>
            <div><dt><Icon name="flag" size={16} />{tr(lang, "ins.open")}</dt><dd className="ma-tabular">{today?.flagged ?? 0}</dd></div>
          </dl>
        </div>
      </section>
    </GateShell>
  );
}
