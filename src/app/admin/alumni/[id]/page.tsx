import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos";
import { fmtMonth, KIND_LABEL } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { AdminShell } from "../../AdminShell";
import { ChangeLog, type Change } from "../../ChangeLog";
import { Banner, UUID } from "../../ui";
import { PersonForm } from "../PersonForm";
import { PhotoEditor } from "../PhotoEditor";

export const metadata: Metadata = { title: "Edit record · Admin console" };

type Person = {
  id: string; kind: string; full_name: string; program: string | null; batch_year: number | null; roll_no: string | null;
  phone: string | null; email: string | null; photo_path: string | null; photo_added_on: string | null; active: boolean; visits: number;
};

const LABELS = { full_name: "Name", kind: "Type", program: "Programme", batch_year: "Batch", roll_no: "Roll no.", phone: "Phone", email: "Email", photo_path: "Photo", active: "Shown at the gate" };

/** One record: photo as the guard sees it, the details, and its change log. */
export default async function PersonPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const me = await requireRole("admin");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const [{ data }, { data: changes }] = await Promise.all([
    supabase.rpc("admin_person", { p_id: id }),
    supabase.rpc("admin_changes", { p_table: "people", p_row: id }),
  ]);
  const p = data as Person | null;
  if (!p) notFound();
  const src = (await signPhotos([p.photo_path])).get(p.photo_path ?? "") ?? null;

  return (
    <AdminShell me={me} title="Edit record" current="/admin/alumni"
      banner={sp.saved ? <Banner kind="success" icon="check"><b>Saved.</b> The gate sees the change from the next search.</Banner> : null}
      aside={<>
        <section className="ma-panel" aria-labelledby="vh">
          <h2 className="ma-panel__title" id="vh">Visits</h2>
          <p className="ma-note">{p.visits ? `${p.visits} recorded ${p.visits === 1 ? "visit" : "visits"}.` : "No visits recorded yet."}</p>
          {p.visits ? <Link className="ma-link" href={`/admin/history?q=${encodeURIComponent(p.full_name)}&range=90`}><Icon name="history" size={16} />See them in History</Link> : null}
        </section>
        <section className="ma-panel" aria-labelledby="ch">
          <h2 className="ma-panel__title" id="ch">Logs</h2>
          <ChangeLog rows={(changes ?? []) as Change[]} labels={LABELS} added="Added this record" />
        </section>
      </>}>
      <section className="ma-panel" aria-labelledby="fh">
        <Link className="ma-link" href="/admin/alumni"><Icon name="arrow-left" />People</Link>
        <h2 className="ma-panel__title" id="fh">{p.full_name} · {KIND_LABEL[p.kind]}</h2>
        {!p.active ? <Banner kind="escalation" icon="triangle-alert"><b>Hidden from the gate.</b> Guards can&apos;t find this record. Tick “Show at the gate” below to bring it back.</Banner> : null}
        <PhotoEditor personId={p.id} src={src} name={p.full_name} caption={p.photo_added_on ? `Photo added ${fmtMonth(p.photo_added_on)}` : null} />
        <PersonForm initial={{
          id: p.id, kind: p.kind, name: p.full_name, roll: p.roll_no ?? "", batch: p.batch_year ? String(p.batch_year) : "",
          program: p.program ?? "", phone: p.phone ?? "", email: p.email ?? "", active: p.active,
        }} />
      </section>
    </AdminShell>
  );
}
