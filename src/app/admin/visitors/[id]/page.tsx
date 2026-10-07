import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos";
import { fmtDate, fmtTime, KIND_LABEL, nowMs, ymd } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { AdminShell } from "../../AdminShell";
import { ConfirmButton } from "../../ConfirmButton";
import { Chip, PersonCell, UUID } from "../../ui";
import { cancelExpected } from "../actions";

export const metadata: Metadata = { title: "Expected visit · Admin console" };

type Visit = {
  id: string; expected_at: string; purpose: string | null; host_name: string | null; host_phone: string | null; gate: string | null;
  created_at: string; arrived_at: string | null;
  person: { id: string; full_name: string; kind: string; program: string | null; batch_year: number | null; photo_path: string | null };
};

/** One expected visit with all its details (owner, 2026-10-06: moved here from the Visitors list). */
export default async function ExpectedVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole("admin");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_expected_one", { p_id: id });
  const v = data as Visit | null;
  if (!v) notFound();
  const src = (await signPhotos([v.person.photo_path])).get(v.person.photo_path ?? "") ?? null;
  const day = ymd(new Date(v.expected_at));
  const today = ymd();
  const tab = day === today ? "today" : day > today ? "upcoming" : "past";
  const late = !v.arrived_at && new Date(v.expected_at).getTime() < nowMs();
  const p = v.person;

  return (
    <AdminShell me={me} title="Expected visit" current="/admin/visitors">
      <section className="ma-panel" aria-labelledby="vh">
        <Link className="ma-link" href={`/admin/visitors?tab=${tab}`}><Icon name="arrow-left" />Visitors</Link>
        <h2 className="ma-record__name" id="vh">{p.full_name}</h2>
        <div className="ma-record__chips">
          {v.arrived_at ? <Chip icon="check" text={`Arrived ${fmtTime(v.arrived_at)}`} kind="success" />
            : tab === "past" ? <Chip icon="clock" text="Didn't arrive" />
            : late ? <Chip icon="clock" text="Not arrived yet" kind="hold" />
            : <Chip icon="calendar-clock" text="Expected" />}
        </div>
        <dl className="ma-kv">
          <dt>When</dt><dd className="ma-tabular">{fmtDate(v.expected_at)}, {fmtTime(v.expected_at)}</dd>
          <dt>Visiting</dt><dd>{v.host_name ?? "—"}{v.host_phone ? <> · <span className="ma-tabular">{v.host_phone}</span></> : null}</dd>
          <dt>Purpose</dt><dd>{v.purpose || "—"}</dd>
          <dt>Gate</dt><dd>{v.gate ?? "Any gate"}</dd>
          <dt>Record</dt><dd><Link className="ma-link" href={`/admin/alumni/${p.id}`}>
            <PersonCell name={`${p.full_name} · ${KIND_LABEL[p.kind] ?? p.kind}${p.program ? ` · ${p.program}` : ""}${p.batch_year ? ` · ${p.batch_year}` : ""}`} src={src} /></Link></dd>
          <dt>Added</dt><dd className="ma-tabular">{fmtDate(v.created_at)}, {fmtTime(v.created_at)}</dd>
        </dl>
        {tab !== "past" && !v.arrived_at ? (
          <div className="ma-actions">
            <ConfirmButton action={cancelExpected} fields={{ id: v.id, tab }} label="Cancel visit" icon="x"
              title={`Cancel ${p.full_name}'s visit?`} confirmLabel="Cancel visit" keepLabel="Keep visit"
              body={<p>The visit is removed from the gate&apos;s Expected list. {p.full_name}&apos;s record stays, and they can still be checked in as a normal visitor.</p>} />
          </div>
        ) : null}
      </section>
    </AdminShell>
  );
}
