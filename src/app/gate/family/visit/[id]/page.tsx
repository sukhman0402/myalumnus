import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/BackLink";
import { tr } from "@/lib/i18n";
import { fmtTime } from "@/lib/format";
import { requireOnDuty } from "@/lib/gate";
import { GateShell } from "../../../GateShell";
import { ExitButton } from "../../../inside/ExitButton";

export const metadata: Metadata = { title: "Family visit · Guard console" };

type F = { id: string; guests: number; purpose: string | null; entered_at: string; exited_at: string | null; student: string; program: string | null; roll_no: string | null };

/** Close a family visit when the whole group has left (mockup g28). */
export default async function FamilyVisitPage({ params }: { params: Promise<{ id: string }> }) {
  const duty = await requireOnDuty();
  const { lang } = duty;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("gate_family", { p_id: id });
  const f = data as F | null;
  if (!f) notFound();
  return (
    <GateShell duty={duty} title={tr(lang, "title.inside")}>
      <section className="ma-panel" aria-labelledby="fx">
        <BackLink href={"/gate"} label={tr(lang, "back")} />
        <h2 className="ma-panel__title" id="fx">{tr(lang, "fam.close.title", { s: f.student })}</h2>
        <dl className="ma-kv">
          <dt>{tr(lang, "kv.guests")}</dt><dd className="ma-tabular">{f.guests}</dd>
          <dt>{tr(lang, "kv.hoststudent")}</dt><dd>{[f.student, f.program, f.roll_no ? tr(lang, "kv.roll", { r: f.roll_no }) : null].filter(Boolean).join(" · ")}</dd>
          <dt>{tr(lang, "kv.insince")}</dt><dd className="ma-tabular">{fmtTime(f.entered_at)}</dd>
          <dt>{tr(lang, "kv.purpose")}</dt><dd>{f.purpose || "—"}</dd>
        </dl>
        {f.exited_at ? null : (
          <div className="ma-actions">
            <ExitButton lang={lang} id={f.id} kind="family" name={f.student} rowLabel={tr(lang, "fam.close")} variant="primary" />
          </div>
        )}
      </section>
    </GateShell>
  );
}
