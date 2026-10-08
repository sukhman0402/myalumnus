import type { Metadata } from "next";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { tr } from "@/lib/i18n";
import { decidedRecently, getDuty, getLang, getRules, timeFns } from "@/lib/gate";
import { OfflineSync } from "./OfflineSync";
import { homeLists } from "./HomeLists";
import { AutoRefresh } from "@/components/AutoRefresh";
import { GateSearch } from "./GateSearch";
import { Today } from "./Today";

function duration(fromIso: string, toIso: string) {
  const m = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

export const metadata: Metadata = { title: "Home · Guard console" };

export default async function GatePage({ searchParams }: { searchParams: Promise<{ q?: string; done?: string; family?: string; exited?: string; closed?: string }> }) {
  const { t: fmtTime } = await timeFns();   // this device's 12/24-hour choice
  const [me, duty, lang, sp] = await Promise.all([requireRole("gate"), getDuty(), getLang(), searchParams]);
  const supabase = await createClient();

  // The device couldn't open its gate's post (no gate set up for this device): nothing to decide with, say so.
  if (!duty) return (
    <Shell title={tr(lang, "title.home")}>
      <section className="ma-panel"><div className="ma-empty"><b>{tr(lang, "duty.none.t")}</b><span>{tr(lang, "duty.none.d", { g: me.gate_name ?? "" })}</span></div></section>
    </Shell>
  );

  // After Approve / Deny the record page comes back here with ?done=<visit id>: confirm what was saved.
  let banner: React.ReactNode = null;
  if (sp.done && /^[0-9a-f-]{36}$/i.test(sp.done)) {
    const { data } = await supabase.rpc("gate_visit", { p_visit: sp.done });
    const v = (data as { outcome: string; reason: string | null; decided_at: string; full_name: string }[] | null)?.[0];
    const name = v?.full_name;
    const fresh = v && decidedRecently(v.decided_at); // not on an old bookmark
    if (v && name && fresh) {
      const ok = v.outcome === "approved";
      const t = fmtTime(v.decided_at);
      banner = (
        <div className={`ma-banner ma-banner--${ok ? "success" : "danger"}`} role="status">
          <span className="ma-circle"><Icon name={ok ? "check" : "ban"} /></span>
          <span className="ma-banner__text">
            <b>{tr(lang, ok ? "res.approved.b" : "res.denied.b", { n: name, t })}</b>{" "}
            {ok ? tr(lang, "res.approved") : tr(lang, "res.denied", { r: v.reason ?? "" })}
          </span>
        </div>
      );
    }
  }

  if (!banner && sp.family && /^[0-9a-f-]{36}$/i.test(sp.family)) {
    const { data } = await supabase.rpc("gate_family", { p_id: sp.family });
    const f = data as { guests: number; student: string; entered_at: string } | null;
    if (f && decidedRecently(f.entered_at)) banner = (
      <div className="ma-banner ma-banner--success" role="status">
        <span className="ma-circle"><Icon name="check" /></span>
        <span className="ma-banner__text"><b>{tr(lang, "fam.saved.b", { g: f.guests, s: f.student, t: fmtTime(f.entered_at) })}</b> {tr(lang, "fam.saved")}</span>
      </div>
    );
  }

  // After Mark exit the guard comes back here (Iteration 3, NEW-4), not to a page with no way back.
  const uuid = /^[0-9a-f-]{36}$/i;
  if (!banner && sp.exited && uuid.test(sp.exited)) {
    const { data } = await supabase.rpc("gate_inside_visit", { p_visit: sp.exited });
    const x = data as { name: string; entered_at: string; exited_at: string | null } | null;
    if (x?.exited_at && decidedRecently(x.exited_at)) banner = (
      <div className="ma-banner ma-banner--success" role="status"><span className="ma-circle"><Icon name="check" /></span>
        <span className="ma-banner__text"><b>{tr(lang, "exit.done.b", { n: x.name, t: fmtTime(x.exited_at) })}</b> {tr(lang, "exit.done", { d: duration(x.entered_at, x.exited_at) })}</span></div>
    );
  } else if (!banner && sp.closed && uuid.test(sp.closed)) {
    const { data } = await supabase.rpc("gate_family", { p_id: sp.closed });
    const x = data as { student: string; guests: number; exited_at: string | null } | null;
    if (x?.exited_at && decidedRecently(x.exited_at)) banner = (
      <div className="ma-banner ma-banner--success" role="status"><span className="ma-circle"><Icon name="check" /></span>
        <span className="ma-banner__text"><b>{tr(lang, "fam.closed.b", { s: x.student, t: fmtTime(x.exited_at) })}</b> {tr(lang, "fam.closed", { g: x.guests, s: x.student })}</span></div>
    );
  }

  const [rules, lists] = await Promise.all([getRules(me.gate_id ?? ""), homeLists(lang)]);
  return (
    <Shell title={tr(lang, "title.home")} banner={banner} aside={<><Today lang={lang} />{lists.aside}</>}>
      <OfflineSync lang={lang} />
      <AutoRefresh seconds={15} />
      <GateSearch lang={lang} initialQuery={sp.done || sp.family || sp.exited || sp.closed ? "" : (sp.q ?? "").slice(0, 80)} guard={duty.guard.id} hours={rules} h24={(await timeFns()).h24} />
      {lists.main}
    </Shell>
  );
}
