import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/BackLink";
import { RecordPhoto } from "@/components/RecordPhoto";
import { tr } from "@/lib/i18n";
import { fmtMonth } from "@/lib/format";
import { photoSrc, requireOnDuty } from "@/lib/gate";
import { GateShell } from "../../GateShell";
import { FamilyForm } from "./FamilyForm";

export const metadata: Metadata = { title: "Family visit · Guard console" };

type S = { id: string; full_name: string; program: string | null; roll_no: string | null; photo_path: string | null; photo_added_on: string | null };

/** Log a family visit: headcount and purpose, with the responsibility read to the student (mockup g26). */
export default async function FamilyLogPage({ params }: { params: Promise<{ id: string }> }) {
  const duty = await requireOnDuty();
  const { lang } = duty;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("gate_student", { p_student: id });
  const s = data as S | null;
  if (!s) notFound();
  const src = await photoSrc(s.photo_path);
  return (
    <GateShell duty={duty} title={tr(lang, "title.family")}>
      <section className="ma-panel" aria-labelledby="lh">
        <BackLink href={"/gate/family"} label={tr(lang, "back")} />
        <FamilyForm lang={lang} studentId={s.id} clientId={crypto.randomUUID()}
          photo={<RecordPhoto src={src} name={s.full_name}
            caption={s.photo_added_on ? tr(lang, "photo.added", { d: fmtMonth(s.photo_added_on, lang) }) : null}
            enlargeLabel={tr(lang, "photo.enlarge", { n: s.full_name })} altText={tr(lang, "photo.alt", { n: s.full_name })}
            closeLabel={tr(lang, "close")} noneTitle={tr(lang, "photo.none.t")} />}
          heading={<div><h2 className="ma-record__name" id="lh">{s.full_name}</h2>
            <p className="ma-record__meta">{[tr(lang, "kind.student"), s.program, s.roll_no ? tr(lang, "kv.roll", { r: s.roll_no }) : null].filter(Boolean).join(" · ")}</p></div>} />
      </section>
    </GateShell>
  );
}
