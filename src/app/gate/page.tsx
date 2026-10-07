import type { Metadata } from "next";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { tr } from "@/lib/i18n";
import { fmtTime } from "@/lib/format";
import { decidedRecently, getDuty, getLang, getRules, isAfterDuty } from "@/lib/gate";
import { OfflineSync } from "./OfflineSync";
import { startShift } from "./actions";
import { homeLists } from "./HomeLists";
import { AutoRefresh } from "@/components/AutoRefresh";
import { GateSearch } from "./GateSearch";
import { Today } from "./Today";

export const metadata: Metadata = { title: "Home · Guard console" };

export default async function GatePage({ searchParams }: { searchParams: Promise<{ q?: string; done?: string; family?: string; next?: string }> }) {
  const [me, duty, lang, sp] = await Promise.all([requireRole("gate"), getDuty(), getLang(), searchParams]);
  const supabase = await createClient();

  // No guard on shift yet: the device shows the name picker (planning/02 Q1).
  if (!duty) {
    const next = isAfterDuty(sp.next) ? sp.next : null;
    const { data } = await supabase.rpc("gate_guards");
    const guards = data as { id: string; name: string; shift_label: string | null }[] | null;
    return (
      <Shell title={tr(lang, "title.duty")}>
        <section className="ma-panel" aria-labelledby="pick">
          <h2 className="ma-panel__title" id="pick">{tr(lang, "duty.title")}</h2>
          {next ? (
            <div className="ma-banner ma-banner--escalation" role="status">
              <span className="ma-circle"><Icon name="user-check" /></span>
              <span className="ma-banner__text"><b>{tr(lang, "duty.next", { p: tr(lang, ({ expected: "nav.expected", inside: "nav.inside", insights: "nav.insights", settings: "nav.settings" } as const)[next]) })}</b></span>
            </div>
          ) : null}
          {guards && guards.length ? (
            <ul className="ma-list">
              {guards.map((g) => (
                <li key={g.id}>
                  <form action={startShift}>
                    <input type="hidden" name="guard_id" value={g.id} />
                    {next ? <input type="hidden" name="next" value={next} /> : null}
                    <button className="ma-row">
                      <span className="ma-row__photo"><Icon name="shield-user" /></span>
                      <span className="ma-row__text"><b>{g.name}</b>{g.shift_label ? <span className="ma-tabular">{tr(lang, "duty.shift", { s: g.shift_label })}</span> : null}</span>
                      <span className="ma-row__chev"><Icon name="chevron-right" /></span>
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <div className="ma-list"><div className="ma-empty"><b>{tr(lang, "duty.none.t")}</b><span>{tr(lang, "duty.none.d", { g: me.gate_name ?? "" })}</span></div></div>
          )}
        </section>
      </Shell>
    );
  }

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

  const [rules, lists] = await Promise.all([getRules(me.gate_id ?? ""), homeLists(lang)]);
  return (
    <Shell title={tr(lang, "title.home")} banner={banner} aside={<><Today lang={lang} />{lists.aside}</>}>
      <OfflineSync lang={lang} />
      <AutoRefresh seconds={15} />
      <GateSearch lang={lang} initialQuery={sp.done || sp.family ? "" : (sp.q ?? "").slice(0, 80)} guard={duty.guard.id} hours={rules} />
      {lists.main}
    </Shell>
  );
}
