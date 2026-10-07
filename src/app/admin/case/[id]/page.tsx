import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/Icon";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Timer } from "@/components/Timer";
import { fmtTime, personMeta, type Kind } from "@/lib/format";
import { signPhotos } from "@/lib/photos";
import { AdminShell } from "../../AdminShell";
import { AdminDecide } from "./AdminDecide";
import { adminSince, handoffAt, isLegacy, passedByGuard, stageOf } from "@/lib/cases";

export const metadata: Metadata = { title: "Escalation · Admin console" };

type Person = { id: string; full_name: string; kind: Kind; program: string | null; batch_year: number | null; photo_path: string | null };
type Case = {
  id: string; name_given: string; says: string | null; reason: string; purpose: string | null; host_name: string; host_phone: string | null;
  status: "admin" | "host" | "approved" | "denied"; created_at: string; passed_to_host_at: string | null; passed_to_admin_at: string | null; decided_at: string | null; note: string | null;
  gate: { name: string; campus_id: string } | null; held: { name: string } | null; decider: { name: string; role: string } | null; person: Person | null;
};

/** One held visitor, from the admin's side. Host first (0017): the guard calls the host; the case reaches the admins if
 *  the host can't be reached or hasn't confirmed in time. An admin may decide at either stage. */
export default async function AdminCasePage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole("admin");
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("cases")
    .select("id, name_given, says, reason, purpose, host_name, host_phone, status, created_at, passed_to_host_at, passed_to_admin_at, decided_at, note, gate:gates(name, campus_id), held:staff!cases_held_by_fkey(name), decider:staff!cases_decided_by_fkey(name, role), person:people(id, full_name, kind, program, batch_year, photo_path)")
    .eq("id", id).maybeSingle();
  const c = data as unknown as Case | null;
  if (!c) notFound();
  const { data: rule } = await supabase.from("campus_rules").select("escalate_minutes").eq("campus_id", c.gate?.campus_id ?? "").maybeSingle();
  const minutes = rule?.escalate_minutes ?? 10;
  const handoff = handoffAt(c, minutes);
  const stage = stageOf(c, minutes);
  const legacy = isLegacy(c);
  const since = adminSince(c, minutes);
  const byGuard = passedByGuard(c, minutes);
  const open = stage === "admin" || stage === "host";
  const firstHost = c.host_name.split(",")[0];
  const guard = c.held?.name ?? "The guard";

  // When the guard found no record, suggest close spellings (pg_trgm; planning/02 D10).
  const { data: similar } = !c.person && open ? await supabase.rpc("admin_similar_names", { p_name: c.name_given }) : { data: [] };
  const sims = (similar ?? []) as Person[];

  // No explanatory captions on an open case (owner, 2026-10-07): a status chip next to the name says where it stands.
  let banner: React.ReactNode = null;
  const stageChip = stage === "admin"
    ? <span className="ma-chip ma-chip--hold"><span className="ma-circle"><Icon name="hourglass" /></span><span className="ma-tabular">Waiting for you · <Timer since={since ?? c.created_at} /></span></span>
    : stage === "host"
      ? <span className="ma-chip"><span className="ma-circle"><Icon name="phone" /></span><span className="ma-tabular">Guard calling host · <Timer since={c.created_at} /></span></span>
      : null;
  if (!open) {
    const ok = c.status === "approved";
    const byYou = c.decider?.name === me.name && c.decider?.role === "admin";
    const who = byYou ? "You" : c.decider?.role === "admin" ? c.decider.name : "The guard, after the host call,";
    banner = <Banner kind={ok ? "success" : "danger"} icon={ok ? "check" : "ban"}><b>{who} {ok ? "approved" : "denied"} · {c.decided_at ? fmtTime(c.decided_at) : ""}.</b>{" "}
      {ok ? `${guard} at ${c.gate?.name} sees it now and lets ${c.name_given} in.` : `${guard} at ${c.gate?.name} sees it now.`}</Banner>;
  }

  const urls = await signPhotos([c.person?.photo_path, ...sims.map((s) => s.photo_path)]);
  const row = (p: Person, chip?: React.ReactNode) => {
    const src = urls.get(p.photo_path ?? "") ?? null;
    return (
      <div className="ma-row ma-row--static">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {src ? <span className="ma-row__photo ma-row__photo--img"><img src={src} alt="" /></span> : <span className="ma-row__photo"><Icon name="user" /></span>}
        <span className="ma-row__text"><b>{p.full_name}</b><span>{personMeta("en", p)} · {p.photo_path ? "photo on file" : "no photo"}</span></span>
        {chip ? <span className="ma-row__end">{chip}</span> : null}
      </div>
    );
  };

  // Case trail: each time stands out (owner: "highlight timings"); the next step is marked, not timed.
  const trail: [string, string, boolean?][] = [[fmtTime(c.created_at), `${guard} held the visitor at ${c.gate?.name}`]];
  if (legacy) {
    trail.push([fmtTime(c.created_at), "Admins were alerted"]);
    trail.push([fmtTime(c.passed_to_host_at!), `Passed to the host: ${guard} called ${firstHost}`]);
  } else {
    trail.push([fmtTime(c.created_at), `${guard} called the host, ${firstHost}`]);
    if (since) trail.push([fmtTime(since), byGuard ? "Host not reached: passed to admins" : `No confirmation in ${minutes} min: passed to admins`]);
  }
  if (c.decided_at) trail.push([fmtTime(c.decided_at), `${c.status === "approved" ? "Approved" : "Denied"} by ${c.decider?.role === "admin" ? c.decider.name : "the guard"}${c.note ? `: ${c.note}` : ""}`]);
  else if (stage === "host" && !legacy) trail.push([fmtTime(handoff), "Comes to admins if the host hasn't confirmed", true]);
  else trail.push(["Next", stage === "admin" ? "An admin decides" : "The guard or an admin decides", true]);

  return (
    <AdminShell me={me} title="Escalation" current="/admin"
      aside={<>
        <section className="ma-panel" aria-labelledby="hh">
          <h2 className="ma-panel__title" id="hh">Host</h2>
          <div className="ma-step" style={{ flexWrap: "wrap", alignItems: "center" }}>
            <span className="ma-step__n"><Icon name="phone" size={16} /></span>
            <div style={{ flex: "1 1 10rem" }}><b>{c.host_name}</b><span className="ma-tabular">{c.host_phone || "No phone given"}</span></div>
          </div>
        </section>
        <section className="ma-panel" aria-labelledby="th">
          <h2 className="ma-panel__title" id="th">Case trail</h2>
          <ol className="ma-trail">{trail.map(([t, text, next], i) => <li key={i} className={next ? "is-next" : undefined}><time>{t}</time><span>{text}</span></li>)}</ol>
        </section>
      </>}>
      {open ? <AutoRefresh seconds={5} /> : null}
      <section className="ma-panel" aria-labelledby="who">
        <Link className="ma-link" href="/admin#queue"><Icon name="arrow-left" />Escalation queue</Link>
        <div className="ma-case-head"><h2 className="ma-record__name" id="who">{c.name_given}</h2>{stageChip}</div>
        {banner}
        <dl className="ma-kv">
          <dt>Name given</dt><dd>{c.name_given}</dd>
          <dt>Says</dt><dd>{c.says || "—"}</dd>
          <dt>Why held</dt><dd>{c.reason}</dd>
          <dt>Purpose</dt><dd>{c.purpose || "—"}</dd>
          <dt>Held by</dt><dd>{c.held?.name ?? "—"} · {c.gate?.name} · {fmtTime(c.created_at)}</dd>
        </dl>
        {c.person ? (
          <div className="ma-sub" role="group" aria-labelledby="rec">
            <h3 className="ma-sub__title" id="rec">Their record on file</h3>
            <div className="ma-list">{row(c.person)}</div>
          </div>
        ) : sims.length ? (
          <div className="ma-sub" role="group" aria-labelledby="sim">
            <h3 className="ma-sub__title" id="sim">Similar names in the alumni list</h3>
            <ul className="ma-list">{sims.map((p) => <li key={p.id}>{row(p)}</li>)}</ul>
          </div>
        ) : open ? <p className="ma-note">No similar names in the alumni list.</p> : null}
        {!open && c.note ? <dl className="ma-kv"><dt>Note</dt><dd>{c.note}</dd></dl> : null}
        {open ? <AdminDecide caseId={c.id} name={c.name_given} /> : (
          <div className="ma-actions"><Link className="ma-btn ma-btn--secondary" href="/admin">Back to dashboard</Link></div>
        )}
      </section>
    </AdminShell>
  );
}

function Banner({ kind, icon, children }: { kind: "escalation" | "success" | "danger"; icon: string; children: React.ReactNode }) {
  return <div className={`ma-banner ma-banner--${kind}`} role="status"><span className="ma-circle"><Icon name={icon} /></span><span className="ma-banner__text">{children}</span></div>;
}
