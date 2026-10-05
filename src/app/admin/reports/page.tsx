import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { addDays, fmtDay, fmtDuration, isYmd, KIND_LABEL, mondayOf, ymd } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { AdminShell } from "../AdminShell";
import { Banner, PanelHead } from "../ui";
import { ChartTips } from "./ChartTips";
import { DayBars, Escalations, HourBars, Kpi, Outcomes, TypeBars } from "./charts";
import type { Report } from "./types";

export const metadata: Metadata = { title: "Reports · Admin console" };

/** The weekly review as infographics (research/62, option B), with the same numbers as a table. */
export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ from?: string }> }) {
  const me = await requireRole("admin");
  const sp = await searchParams;
  const thisWeek = mondayOf(ymd());
  const from = isYmd(sp.from) ? mondayOf(sp.from) : thisWeek;
  const to = addDays(from, 6);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_report", { p_from: from, p_days: 7 });
  const r = data as Report | null;
  const title = `Week of ${fmtDay(from)} – ${fmtDay(to)} ${to.slice(0, 4)}`;
  const nav = (
    <div className="ma-week">
      <Link className="ma-btn ma-btn--secondary" href={`/admin/reports?from=${addDays(from, -7)}`}><Icon name="chevron-left" />Previous week</Link>
      {from < thisWeek ? <Link className="ma-btn ma-btn--secondary" href={`/admin/reports?from=${addDays(from, 7)}`}>Next week<Icon name="chevron-right" /></Link> : null}
      {r ? <a className="ma-btn ma-btn--secondary" href={`/admin/reports/export?from=${from}`} download><Icon name="download" />Export CSV</a> : null}
    </div>
  );
  if (!r || error) {
    return (
      <AdminShell me={me} title="Reports" current="/admin/reports">
        <Banner kind="danger" icon="circle-alert" alert>Couldn&apos;t build the report. Refresh the page.</Banner>
      </AdminShell>
    );
  }

  const limit = r.hours?.escalate_minutes ?? 10;
  const open = Number((r.hours?.open ?? "10:00").slice(0, 2)), close = Number((r.hours?.close ?? "18:00").slice(0, 2));
  const people = r.visits, total = people + r.family_groups;
  const types = [
    ...r.by_type.filter((t) => t.visits > 0).map((t) => ({ label: KIND_LABEL[t.type] ?? t.type, n: t.visits })),
    ...(r.family_groups ? [{ label: "Student family", n: r.family_groups }] : []),
  ];
  const esc = r.escalations.map((e) => {
    const start = new Date(e.created_at).getTime();
    const end = new Date(e.decided_at ?? e.passed_at ?? new Date().toISOString()).getTime();
    const minutes = Math.min((end - start) / 60000, limit + 5);
    const who: "admin" | "host" | "guard" | "open" = e.by_role === "admin" && !e.passed_at ? "admin" : e.passed_at ? "host" : e.decided_at ? "guard" : "open";
    const result = e.status === "approved" ? `approved by ${e.by_role === "admin" ? "admin" : "guard"}${e.passed_at ? " after the host call" : ""}`
      : e.status === "denied" ? `denied by ${e.by_role === "admin" ? "admin" : "guard"}${e.passed_at ? " after the host call" : ""}` : "still open";
    return { name: e.name, minutes: who === "admin" ? minutes : Math.max(minutes, e.passed_at ? limit : minutes), who, result: who === "admin" ? `${result}, ${fmtDuration(end - start, true)}` : result };
  });
  const median = r.median_admin_seconds !== null ? fmtDuration(r.median_admin_seconds * 1000, true) : "—";
  const quiet = total === 0 && r.held === 0;

  return (
    <AdminShell me={me} title="Reports" current="/admin/reports">
      <ChartTips />
      <section className="ma-panel" aria-labelledby="ph">
        <PanelHead id="ph" title={title} actions={nav} />
        {from === thisWeek ? <p className="ma-note">This week so far.</p> : null}
        {quiet ? <p className="ma-note"><b>No visits recorded in this week.</b></p> : null}
        <div className="ma-chart-grid4">
          <Kpi value={total} label="Visits" sub={`${people} ${people === 1 ? "person" : "people"} + ${r.family_groups} family ${r.family_groups === 1 ? "group" : "groups"}`} icon="users" />
          <Kpi value={r.held} label="Flag & Hold" sub={`${r.held_approved} approved · ${r.held_denied} denied${r.held_open ? ` · ${r.held_open} open` : ""}`} icon="flag" />
          <Kpi value={median} label="Admin decision time" sub={`median of ${r.admin_decided} · limit ${limit} min`} icon="hourglass" />
          <Kpi value={r.overstays} label="Overstays" sub="still inside after visiting hours" icon="triangle-alert" />
        </div>
        <div className="ma-chart-card">
          <h3>How visits were decided</h3>
          <Outcomes segs={[
            { label: "Approved at the gate", n: r.outcomes.gate_approved, kind: "approve" },
            { label: `Held, then approved${r.passed_to_host ? ` (${r.passed_to_host} passed to the host)` : ""}`, n: r.outcomes.held_approved, kind: "held" },
            { label: "Denied", n: r.outcomes.gate_denied + r.outcomes.held_denied, kind: "deny" },
          ]} />
        </div>
        <div className="ma-chart-charts">
          <div className="ma-chart-card"><h3>Visits per day</h3><DayBars days={r.by_day} /></div>
          <div className="ma-chart-card"><h3>When visitors arrive</h3><HourBars hours={r.by_hour} open={open} close={close} />
            <ul className="ma-chart-legend"><li><span className="ma-chart-key" style={{ background: "var(--ma-chart-bar)" }} />Within visiting hours</li>
              <li><span className="ma-chart-key" style={{ background: "var(--ma-chart-bar-out)" }} />Outside: held for admin</li></ul></div>
          <div className="ma-chart-card"><h3>Who visited</h3>{types.length ? <TypeBars rows={types} note={r.family_groups ? `Student family counts groups (${r.family_guests} guests).` : undefined} /> : <p className="ma-note">No visits this week.</p>}</div>
          <div className="ma-chart-card"><h3>Escalations against the {limit}-minute limit</h3><Escalations items={esc} limit={limit} /></div>
        </div>
        <details className="ma-chart-table">
          <summary>Show as a table</summary>
          <div className="ma-tablecard"><div className="ma-table-wrap" tabIndex={0} role="region" aria-label="Weekly review as a table">
            <table className="ma-table">
              <thead><tr><th>Visitor type</th><th>Visits</th><th>Flag &amp; Hold</th><th>Denied</th><th>Overstays</th></tr></thead>
              <tbody>
                {r.by_type.map((t) => <tr key={t.type} style={{ cursor: "default" }}><td>{KIND_LABEL[t.type] ?? t.type}</td><td className="ma-tabular">{t.visits}</td><td className="ma-tabular">{t.held}</td><td className="ma-tabular">{t.denied}</td><td className="ma-tabular">{t.overstays}</td></tr>)}
                <tr style={{ cursor: "default" }}><td>Student family</td><td className="ma-tabular">{r.family_groups} {r.family_groups === 1 ? "group" : "groups"} ({r.family_guests} guests)</td><td>—</td><td>—</td><td className="ma-tabular">{r.family_overstays}</td></tr>
              </tbody>
            </table>
          </div></div>
          <dl className="ma-kv">
            <dt>Median time to decide (admin)</dt><dd>{median} · {r.admin_decided} {r.admin_decided === 1 ? "case" : "cases"} decided by admin</dd>
            <dt>Passed to host</dt><dd>{r.passed_to_host} {r.passed_to_host === 1 ? "case" : "cases"}</dd>
          </dl>
        </details>
      </section>
    </AdminShell>
  );
}
