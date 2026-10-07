import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/Icon";
import { BackLink } from "@/components/BackLink";
import { AutoRefresh } from "@/components/AutoRefresh";
import { tr } from "@/lib/i18n";
import { requireOnDuty } from "@/lib/gate";
import { GateShell } from "../GateShell";

export const metadata: Metadata = { title: "Flagged & hold · Guard console" };

/** Visitors held at this gate and not yet decided. */
export default async function CasesPage() {
  const duty = await requireOnDuty();
  const { lang } = duty;
  const supabase = await createClient();
  const { data } = await supabase.rpc("gate_open_cases");
  const cases = (data ?? []) as { id: string; name_given: string; reason: string; status: "admin" | "host"; created_at: string }[];
  return (
    <GateShell duty={duty} title={tr(lang, "title.cases")}>
      <AutoRefresh seconds={10} />
      <section className="ma-panel" aria-labelledby="ch">
        <BackLink href={"/gate"} label={tr(lang, "back")} />
        <h2 className="ma-panel__title" id="ch">{tr(lang, "title.cases")}</h2>
        {cases.length ? (
          <ul className="ma-list">
            {cases.map((c) => (
              <li key={c.id}>
                <Link className="ma-row" href={`/gate/case/${c.id}`}>
                  <span className="ma-row__photo"><Icon name="flag" /></span>
                  <span className="ma-row__text"><b>{c.name_given}</b><span>{c.reason}</span></span>
                  <span className="ma-row__end"><span className="ma-chip ma-chip--hold"><span className="ma-circle"><Icon name={c.status === "host" ? "phone" : "hourglass"} /></span>
                    <span className="ma-tabular">{tr(lang, c.status === "host" ? "case.withhost" : "case.waiting")}</span></span></span>
                  <span className="ma-row__chev"><Icon name="chevron-right" /></span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="ma-list"><div className="ma-empty"><b>{tr(lang, "cases.none")}</b></div></div>
        )}
      </section>
    </GateShell>
  );
}
