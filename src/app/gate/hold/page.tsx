import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/BackLink";
import { tr } from "@/lib/i18n";
import { personMeta, type Kind } from "@/lib/format";
import { requireOnDuty } from "@/lib/gate";
import { GateShell } from "../GateShell";
import { HoldForm } from "./HoldForm";

export const metadata: Metadata = { title: "Put on hold · Guard console" };

type Person = { id: string; full_name: string; kind: Kind; program: string | null; batch_year: number | null;
  expected: { purpose: string | null; host: string | null } | null; hours: { in_hours: boolean } };

/**
 * Hold the visitor for admin (mockup g13). Opened from a record (person=…), from the same-name screen or from
 * a search with no match (name=…). What the guard already knows is filled in; the reason defaults to the likely one.
 */
export default async function HoldPage({ searchParams }: { searchParams: Promise<{ person?: string; name?: string; q?: string; purpose?: string }> }) {
  const duty = await requireOnDuty();
  const { lang } = duty;
  const sp = await searchParams;
  const supabase = await createClient();
  let p: Person | null = null;
  if (sp.person && /^[0-9a-f-]{36}$/i.test(sp.person)) {
    const { data } = await supabase.rpc("gate_person", { p_person: sp.person });
    p = data as Person | null;
  }
  const q = (sp.q ?? "").slice(0, 80);
  const back = p ? `/gate/person/${p.id}?q=${encodeURIComponent(q)}&picked=1` : `/gate?q=${encodeURIComponent(q)}`;
  const why = p ? (p.hours.in_hours ? 2 : 4) : 1;

  return (
    <GateShell duty={duty} title={tr(lang, "title.flag")}>
      <section className="ma-panel" aria-labelledby="fh">
        <BackLink href={back} label={tr(lang, "back")} />
        <h2 className="ma-panel__title" id="fh">{tr(lang, "fh.title")}</h2>
        <HoldForm lang={lang} clientId={crypto.randomUUID()} back={back} personId={p?.id ?? ""}
          name={p?.full_name ?? (sp.name ?? "").slice(0, 120)} says={p ? personMeta(lang, p) : ""} why={why}
          purpose={(sp.purpose ?? p?.expected?.purpose ?? "").slice(0, 200)} host={p?.expected?.host ?? ""} />
      </section>
    </GateShell>
  );
}
