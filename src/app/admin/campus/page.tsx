import type { Metadata } from "next";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { fmtTime, nowMs } from "@/lib/format";
import { AdminShell } from "../AdminShell";
import { ChangeLog, type Change } from "../ChangeLog";
import { Banner } from "../ui";
import { RulesForm } from "./RulesForm";

export const metadata: Metadata = { title: "Campus · Admin console" };

type Rule = { campus_id: string; campus: string; open_time: string; close_time: string; escalate_minutes: number; updated_at: string; gates: string[] };
const LABELS = { open_time: "Hours start", close_time: "Hours end", escalate_minutes: "Escalation minutes" };

/** Campus rules (mockups a15, a16). Only two rules, on purpose. Changes are logged. */
export default async function CampusPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const me = await requireRole("admin");
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_rules");
  const rules = (data ?? []) as Rule[];
  const logs = await Promise.all(rules.map((r) => supabase.rpc("admin_changes", { p_table: "campus_rules", p_row: r.campus_id })));
  const savedAt = sp.saved && /^\d{13}$/.test(sp.saved) && nowMs() - Number(sp.saved) < 10 * 60_000 ? fmtTime(new Date(Number(sp.saved)).toISOString()) : null;

  return (
    <AdminShell me={me} title="Campus" current="/admin/campus"
      banner={savedAt ? <Banner kind="success" icon="check"><b>Saved · <span className="ma-tabular">{savedAt}</span>.</b> Guards see the new rules from their next search.</Banner> : null}
      aside={<section className="ma-panel" aria-labelledby="ch"><h2 className="ma-panel__title" id="ch">Changes</h2>
        {rules.map((r, i) => <ChangeLog key={r.campus_id} rows={(logs[i].data ?? []) as Change[]} labels={LABELS} added="Rules created" />)}</section>}>
      {rules.map((r) => (
        <section key={r.campus_id} className="ma-panel" aria-labelledby={`h-${r.campus_id}`}>
          <h2 className="ma-panel__title" id={`h-${r.campus_id}`}>Campus rules{rules.length > 1 ? ` · ${r.campus}` : ""}</h2>
          <p className="ma-note">These are the only two rules the console applies{r.gates.length ? `, at ${r.gates.join(" and ")}` : ""}. Times are campus time. Every change is logged.</p>
          <RulesForm campus={r.campus_id} open={r.open_time.slice(0, 5)} close={r.close_time.slice(0, 5)} minutes={r.escalate_minutes} />
        </section>
      ))}
    </AdminShell>
  );
}
