import type { Metadata } from "next";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { fmtTime, nowMs } from "@/lib/format";
import { AdminShell } from "../AdminShell";
import { ChangeLog, type Change } from "../ChangeLog";
import { Banner } from "../ui";
import { RulesForm } from "./RulesForm";
import { getTheme } from "@/components/Frame";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SignOutButton } from "@/components/SignOutButton";
import { DEMO_MODE } from "@/lib/demo";
import { signOut, switchConsole } from "../../sign-in/actions";

export const metadata: Metadata = { title: "Settings · Admin console" };

type Rule = { campus_id: string; campus: string; open_time: string; close_time: string; escalate_minutes: number; updated_at: string; gates: string[] };
const LABELS = { open_time: "Hours start", close_time: "Hours end", escalate_minutes: "Escalation minutes" };

/** Settings (renamed from Campus, owner 2026-10-06): campus rules (only two, on purpose; changes are logged),
 *  this computer's display, and the account (sign-out moved here from the top bar, owner 2026-10-08). */
export default async function CampusPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const [me, sp, theme] = await Promise.all([requireRole("admin"), searchParams, getTheme()]);
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_rules");
  const rules = (data ?? []) as Rule[];
  const logs = await Promise.all(rules.map((r) => supabase.rpc("admin_changes", { p_table: "campus_rules", p_row: r.campus_id })));
  const savedAt = sp.saved && /^\d{13}$/.test(sp.saved) && nowMs() - Number(sp.saved) < 10 * 60_000 ? fmtTime(new Date(Number(sp.saved)).toISOString()) : null;

  return (
    <AdminShell me={me} title="Settings" current="/admin/campus"
      banner={savedAt ? <Banner kind="success" icon="check"><b>Saved · <span className="ma-tabular">{savedAt}</span>.</b> Guards see the new rules from their next search.</Banner> : null}
      aside={<section className="ma-panel" aria-labelledby="ch"><h2 className="ma-panel__title" id="ch">Logs</h2>
        {rules.map((r, i) => <ChangeLog key={r.campus_id} rows={(logs[i].data ?? []) as Change[]} labels={LABELS} added="Rules created" />)}</section>}>
      {rules.map((r) => (
        <section key={r.campus_id} className="ma-panel" aria-labelledby={`h-${r.campus_id}`}>
          <h2 className="ma-panel__title" id={`h-${r.campus_id}`}>Campus rules{rules.length > 1 ? ` · ${r.campus}` : ""}</h2>
          <RulesForm campus={r.campus_id} open={r.open_time.slice(0, 5)} close={r.close_time.slice(0, 5)} minutes={r.escalate_minutes} />
        </section>
      ))}
      <section className="ma-panel ma-setting" aria-labelledby="disp">
        <div className="ma-setting__text"><h2 className="ma-panel__title" id="disp">Display</h2>
          <p className="ma-note">Light or dark, for this computer only.</p></div>
        <div className="ma-actions"><ThemeToggle variant="row" initial={theme} darkLabel="Dark mode" lightLabel="Light mode" /></div>
      </section>
      {/* Sign-out lives here, not in the top bar: signing in is a one-time setup (owner, 2026-10-08). */}
      <section className="ma-panel ma-setting" aria-labelledby="acct">
        <div className="ma-setting__text"><h2 className="ma-panel__title" id="acct">Account</h2>
          <p className="ma-note">{me.name} · {me.university_name}{DEMO_MODE ? ". Demo: switch to the guard console." : ". This computer stays signed in until you sign out."}</p></div>
        <div className="ma-actions">{DEMO_MODE
          ? <SignOutButton signOut={switchConsole.bind(null, "guard")} label="Switch to Guard console" />
          : <SignOutButton signOut={signOut} />}</div>
      </section>
    </AdminShell>
  );
}
