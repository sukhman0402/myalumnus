import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos";
import { fmtDate, fmtDuration, fmtTime, KIND_LABEL, nowMs } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { AdminShell } from "../../AdminShell";
import { Chip, PersonCell, UUID } from "../../ui";

export const metadata: Metadata = { title: "Visit detail · Admin console" };

type Person = { id: string; full_name: string; kind: string; program: string | null; batch_year: number | null; roll_no: string | null; photo_path: string | null };
type Visit = {
  type: "visit" | "family"; id: string; outcome?: "approved" | "denied"; reason?: string | null; purpose: string | null; gate: string;
  decided_at?: string; entered_at: string | null; exited_at: string | null; offline?: boolean; synced_at?: string | null; walkin_name?: string | null; guests?: number;
  by_name: string | null; by_role: string | null; closes_at: string | null; person: Person | null;
  case?: { id: string; name_given: string; says: string | null; reason: string; host_name: string; host_phone: string | null; created_at: string;
    passed_to_host_at: string | null; passed_to_admin_at?: string | null; passed_by_guard?: boolean;
    decided_at: string | null; note: string | null; held_by: string | null; status: string } | null;
};

/** One visit and its full trail (mockup a12). */
export default async function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole("admin");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_visit", { p_id: id });
  const v = data as Visit | null;
  if (!v) notFound();
  const src = (await signPhotos([v.person?.photo_path])).get(v.person?.photo_path ?? "") ?? null;
  const name = v.type === "family" ? `Family of ${v.person?.full_name}` : v.person?.full_name ?? v.walkin_name ?? "—";
  const day = v.entered_at ?? v.decided_at ?? v.case?.created_at ?? "";
  const by = v.by_name ? `${v.by_name}${v.by_role === "admin" ? " (admin)" : " (guard)"}` : "—";
  const over = v.entered_at && v.closes_at && new Date(v.exited_at ?? nowMs()) > new Date(v.closes_at);

  const trail: [string, string][] = [];
  const c = v.case;
  if (c) {
    trail.push([c.created_at, `${c.held_by ?? "The guard"} held “${c.name_given}” at ${v.gate} · reason: ${c.reason}${c.says ? ` · says: ${c.says}` : ""}`]);
    if (c.passed_to_host_at) {   // held before 0017: admins first, then the host
      trail.push([c.created_at, "Admins were alerted"]);
      trail.push([c.passed_to_host_at, `No admin decided in time: passed to the host, ${c.host_name}${c.host_phone ? ` (${c.host_phone})` : ""}`]);
    } else {                     // host first
      trail.push([c.created_at, `The guard called the host, ${c.host_name}${c.host_phone ? ` (${c.host_phone})` : ""}`]);
      if (c.passed_to_admin_at) trail.push([c.passed_to_admin_at, c.passed_by_guard ? "Host not reached: passed to admins" : "The host didn't confirm in time: passed to admins"]);
    }
    if (c.decided_at) trail.push([c.decided_at, `${c.status === "approved" ? "Approved" : "Denied"} by ${by}${c.note ? `: ${c.note}` : ""}`]);
  } else if (v.type === "visit" && v.decided_at) {
    trail.push([v.decided_at, `${v.outcome === "approved" ? "Approved" : "Denied"} at ${v.gate} by ${by}${v.reason ? ` · reason: ${v.reason}` : ""}${v.offline ? ` · saved on the iPad while offline${v.synced_at ? `, recorded ${fmtDate(v.synced_at) === fmtDate(v.decided_at) ? "" : `${fmtDate(v.synced_at)} `}at ${fmtTime(v.synced_at)}` : ""}` : ""}`]);
  } else if (v.type === "family") {
    trail.push([v.entered_at!, `${v.by_name ?? "The guard"} logged ${v.guests} ${v.guests === 1 ? "guest" : "guests"} for ${v.person?.full_name} at ${v.gate}`]);
  }
  if (v.type === "visit" && v.entered_at) trail.push([v.entered_at, "Entry recorded"]);
  if (v.exited_at) trail.push([v.exited_at, `${v.type === "family" ? "Visit closed" : "Exit marked"} at the gate${v.entered_at ? ` · ${fmtDuration(new Date(v.exited_at).getTime() - new Date(v.entered_at).getTime())} inside` : ""}`]);
  else if (v.entered_at) trail.push(["", over ? "Still inside after visiting hours: the gate follows up (overstay)" : "Still inside"]);

  return (
    <AdminShell me={me} title="Visit detail" current="/admin/history">
      <section className="ma-panel" aria-labelledby="vh">
        <Link className="ma-link" href="/admin/history"><Icon name="arrow-left" />History</Link>
        <h2 className="ma-record__name" id="vh">{name} · visit on {fmtDate(day)}</h2>
        <div className="ma-record__chips">
          {v.type === "family" ? <Chip icon="users" text={`${v.guests} ${v.guests === 1 ? "guest" : "guests"}`} />
            : v.outcome === "approved" ? <Chip icon="check" text={c ? `Approved by ${c && v.by_role === "admin" ? "admin" : "guard"}` : "Approved"} kind="success" />
            : <Chip icon="ban" text="Denied" kind="danger" />}
          {c ? <Chip icon="flag" text="Was Flag & Hold" kind="hold" /> : null}
          {v.offline ? <Chip icon="cloud-off" text="Recorded offline" /> : null}
          {over ? <Chip icon="triangle-alert" text="Overstay" kind="hold" /> : null}
        </div>
        <dl className="ma-kv">
          <dt>Record</dt>
          <dd>{v.person ? <Link className="ma-link" href={`/admin/alumni/${v.person.id}`}><PersonCell name={`${v.person.full_name} · ${KIND_LABEL[v.person.kind]}${v.person.program ? ` · ${v.person.program}` : ""}${v.person.batch_year ? ` · ${v.person.batch_year}` : ""}`} src={src} /></Link>
            : "Walk-in: no matching record"}</dd>
          {c && c.name_given !== v.person?.full_name ? <><dt>Name given</dt><dd>{c.name_given}</dd></> : null}
          <dt>Purpose</dt><dd>{v.purpose || "—"}</dd>
          {c ? <><dt>Host</dt><dd>{c.host_name}{c.host_phone ? ` · ${c.host_phone}` : ""}</dd></> : null}
          <dt>Gate</dt><dd>{v.gate}</dd>
          <dt>Time inside</dt>
          <dd className="ma-tabular">{v.entered_at ? `${fmtTime(v.entered_at)} – ${v.exited_at ? `${fmtTime(v.exited_at)} (${fmtDuration(new Date(v.exited_at).getTime() - new Date(v.entered_at).getTime())})` : "still inside"}` : "Not let in"}</dd>
          {v.reason || c?.note ? <><dt>{v.outcome === "denied" ? "Reason" : "Note"}</dt><dd>{v.reason || c?.note}</dd></> : null}
        </dl>
        <h3 className="ma-sub__title">Full trail</h3>
        <ol className="ma-trail">{trail.map(([t, text], i) => <li key={i} className={t ? undefined : "is-next"}><time>{t ? fmtTime(t) : "Now"}</time><span>{text}</span></li>)}</ol>
        {c ? <p><Link className="ma-link" href={`/admin/case/${c.id}`}><Icon name="flag" size={16} />Open the escalation case</Link></p> : null}
      </section>
    </AdminShell>
  );
}
