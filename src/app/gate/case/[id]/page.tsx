import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/Icon";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Timer } from "@/components/Timer";
import { tr, type Lang } from "@/lib/i18n";
import { fmtTime } from "@/lib/format";
import { requireOnDuty } from "@/lib/gate";
import { GateShell } from "../../GateShell";
import { CaseDecide } from "./CaseDecide";

export const metadata: Metadata = { title: "Flag & Hold · Guard console" };

type Case = {
  id: string; name_given: string; says: string | null; reason: string; purpose: string | null; host_name: string;
  host_phone: string | null; status: "admin" | "host" | "approved" | "denied"; created_at: string; handoff_at: string;
  decided_at: string | null; note: string | null; decided_by_name: string | null; decided_by_role: "admin" | "guard" | null;
  admins: number; first_admin: string | null; escalate_minutes: number;
};

const WHY = ["Name not found", "Photo doesn't match", "No photo, details don't match", "Outside visiting hours", "Something else"];
/** Reasons are stored in English; show them in the guard's language. */
function whyText(lang: Lang, reason: string) {
  const i = WHY.indexOf(reason);
  return i >= 0 ? tr(lang, `fh.why.${i + 1}` as Parameters<typeof tr>[1]) : reason;
}

/** A held visitor, from the guard's side (mockups g14–g17). It refreshes itself until someone decides. */
export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const duty = await requireOnDuty();
  const { lang } = duty;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("gate_case", { p_case: id });
  const c = data as Case | null;
  if (!c) notFound();

  const open = c.status === "admin" || c.status === "host";
  const handoff = fmtTime(c.handoff_at);
  const host = c.host_name;
  const hostShort = host.split(",")[0]; // "Dr. Meera Pillai, Placement Cell" → button says "Call Dr. Meera Pillai"
  const kv = (
    <dl className="ma-kv">
      <dt>{tr(lang, "kv.visitor")}</dt><dd>{c.name_given} {tr(lang, "kv.asgiven")}</dd>
      <dt>{tr(lang, "kv.says")}</dt><dd>{c.says || "—"}</dd>
      <dt>{tr(lang, "kv.why")}</dt><dd>{whyText(lang, c.reason)}</dd>
      <dt>{tr(lang, "kv.purpose")}</dt><dd>{c.purpose || "—"}</dd>
      <dt>{tr(lang, "kv.host")}</dt><dd>{host}{c.host_phone ? <> · <span className="ma-tabular">{c.host_phone}</span></> : null}</dd>
    </dl>
  );

  let body: React.ReactNode;
  if (c.status === "admin") {
    const others = Math.max(0, c.admins - 1);
    body = (
      <>
        <Banner kind="escalation" icon="hourglass">{tr(lang, "case.withadmin", { timer: "" })}<Timer since={c.created_at} /></Banner>
        <ol className="ma-steps" aria-label={tr(lang, "title.flag")}>
          <li className="ma-step" aria-current="step"><span className="ma-step__n">1</span>
            <div><b>{tr(lang, "case.step1")}</b><span>{others
              ? tr(lang, "case.step1.sub", { n: c.first_admin ?? "", k: others, t: fmtTime(c.created_at) })
              : tr(lang, "case.step1.sub1", { n: c.first_admin ?? "", t: fmtTime(c.created_at) })}</span></div></li>
          <li className="ma-step"><span className="ma-step__n">2</span>
            <div><b>{tr(lang, "case.step2")}</b><span>{tr(lang, "case.step2.sub", { h: host, t: handoff })}</span></div></li>
        </ol>
        <p className="ma-say"><Icon name="message-circle" /><span><small>{tr(lang, "case.tell")}</small><q>{tr(lang, "case.tell.admin", { t: handoff, h: host })}</q></span></p>
        {kv}
      </>
    );
  } else if (c.status === "host") {
    body = (
      <>
        <Banner kind="escalation" icon="phone">{tr(lang, "case.host.banner.a", { m: c.escalate_minutes })} <b>{tr(lang, "case.host.banner.b")}</b></Banner>
        <div className="ma-step" style={{ flexWrap: "wrap", alignItems: "center" }}>
          <span className="ma-step__n">2</span>
          <div style={{ flex: "1 1 12rem" }}><b>{host}</b><span className="ma-tabular">{c.host_phone || "—"}</span></div>
          {c.host_phone ? <a className="ma-btn ma-btn--primary" href={`tel:${c.host_phone.replace(/[^+0-9]/g, "")}`}><Icon name="phone" />{tr(lang, "case.host.call", { h: hostShort })}</a> : null}
        </div>
        <p className="ma-say"><Icon name="message-circle" /><span><small>{tr(lang, "case.after")}</small>{tr(lang, "case.after.text")}</span></p>
        <p className="ma-note">{tr(lang, "case.admin.can")}</p>
        {kv}
        <CaseDecide lang={lang} caseId={c.id} name={c.name_given} unreachable={tr(lang, "case.unreachable")} />
      </>
    );
  } else {
    const ok = c.status === "approved";
    const t = c.decided_at ? fmtTime(c.decided_at) : "";
    const byAdmin = c.decided_by_role === "admin";
    const reason = c.note ?? "";
    body = (
      <>
        <Banner kind={ok ? "success" : "danger"} icon={ok ? "check" : "ban"}>
          <b>{ok
            ? tr(lang, byAdmin ? "case.approved.admin.b" : "case.approved.host.b", { a: c.decided_by_name ?? "", t })
            : tr(lang, byAdmin ? "case.denied.admin.b" : "case.denied.host.b", { a: c.decided_by_name ?? "", t, r: reason })}</b>{" "}
          {ok ? tr(lang, byAdmin ? "case.approved.admin" : "case.approved.host", { n: c.name_given })
            : byAdmin ? tr(lang, "case.denied.admin", { r: reason }) : tr(lang, "case.denied.host")}
        </Banner>
        {ok ? null : <p className="ma-say"><Icon name="message-circle" /><span><small>{tr(lang, "case.tell")}</small><q>{tr(lang, "case.tell.denied", { h: host })}</q></span></p>}
        {kv}
        <div className="ma-actions"><Link className="ma-btn ma-btn--primary" href="/gate"><Icon name="search" />{tr(lang, "back.search")}</Link></div>
      </>
    );
  }

  return (
    <GateShell duty={duty} title={tr(lang, "title.flag")} section="search">
      {open ? <AutoRefresh seconds={5} /> : null}
      <section className="ma-panel" aria-labelledby="ch">
        <Link className="ma-link" href="/gate"><Icon name="arrow-left" />{tr(lang, open ? "case.back" : "back.search")}</Link>
        <h2 className="ma-panel__title" id="ch">{c.name_given}</h2>
        {body}
      </section>
    </GateShell>
  );
}

function Banner({ kind, icon, children }: { kind: "escalation" | "success" | "danger"; icon: string; children: React.ReactNode }) {
  return (
    <div className={`ma-banner ma-banner--${kind}`} role="status">
      <span className="ma-circle"><Icon name={icon} /></span><span className="ma-banner__text">{children}</span>
    </div>
  );
}
