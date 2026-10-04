import type { Metadata } from "next";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { tr } from "@/lib/i18n";
import { fmtTime } from "@/lib/format";
import { decidedRecently, gateNav, getDuty, getLang, getRules, identity } from "@/lib/gate";
import { OfflineSync } from "./OfflineSync";
import { endShift, startShift } from "./actions";
import { GateSearch } from "./GateSearch";
import { LangToggle } from "./LangToggle";
import { Today } from "./Today";

export const metadata: Metadata = { title: "Search · Guard console" };

export default async function GatePage({ searchParams }: { searchParams: Promise<{ q?: string; done?: string; family?: string }> }) {
  const me = await requireRole("gate");
  const [duty, lang, sp] = await Promise.all([getDuty(), getLang(), searchParams]);
  const supabase = await createClient();
  const common = { lang, skipLabel: tr(lang, "skip.main"), soonLabel: tr(lang, "soon"), nav: gateNav(lang, "search"), identityIcon: "shield-user" };

  // No guard on shift yet: the device shows the name picker (planning/02 Q1).
  if (!duty) {
    const { data } = await supabase.rpc("gate_guards");
    const guards = data as { id: string; name: string; shift_label: string | null }[] | null;
    return (
      <Shell {...common} title={tr(lang, "title.duty")} identity={`${me.gate_name} · ${me.university_name}`} actions={<LangToggle lang={lang} />}>
        <section className="ma-panel" aria-labelledby="pick">
          <h2 className="ma-panel__title" id="pick">{tr(lang, "duty.title")}</h2>
          <p className="ma-note">{tr(lang, "duty.note")}</p>
          {guards && guards.length ? (
            <ul className="ma-guardpick">
              {guards.map((g) => (
                <li key={g.id}>
                  <form action={startShift}>
                    <input type="hidden" name="guard_id" value={g.id} />
                    <button className="ma-btn ma-btn--secondary"><Icon name="shield-user" />{g.name}{g.shift_label ? ` · ${g.shift_label}` : ""}</button>
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

  const rules = await getRules(me.gate_id ?? "");
  return (
    <Shell {...common} title={tr(lang, "title.search")} identity={identity({ me, lang, ...duty })} banner={banner}
      actions={<>
        <LangToggle lang={lang} />
        <form action={endShift} className="ma-inline-form"><button className="ma-btn ma-btn--secondary"><Icon name="users" />{tr(lang, "duty.change")}</button></form>
      </>}
      aside={<Today lang={lang} />}>
      <OfflineSync lang={lang} />
      <GateSearch lang={lang} initialQuery={sp.done || sp.family ? "" : (sp.q ?? "").slice(0, 80)} guard={duty.guard.id} hours={rules} />
    </Shell>
  );
}
