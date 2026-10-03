import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { HoldLink } from "@/components/HoldLink";
import { tr } from "@/lib/i18n";
import { gateNav, identity, requireOnDuty } from "@/lib/gate";
import { Today } from "../Today";
import { LangToggle } from "../LangToggle";

export const metadata: Metadata = { title: "Same name · Guard console" };

type Hit = { id: string; full_name: string; program: string | null; batch_year: number | null };

/**
 * Two or more people share the visitor's name (mockup g10). The guard asks the question first; only the
 * record that matches the answer opens, so a lookalike can't be waved through by picking the first row.
 */
export default async function SameNamePage({ searchParams }: { searchParams: Promise<{ n?: string; q?: string }> }) {
  const duty = await requireOnDuty();
  const { lang } = duty;
  const sp = await searchParams;
  const name = (sp.n ?? "").trim().slice(0, 80);
  const q = (sp.q ?? name).slice(0, 80);

  const supabase = await createClient();
  const { data } = name ? await supabase.rpc("gate_same_name", { p_name: name }) : { data: [] };
  const people = (data ?? []) as Hit[];
  const back = `/gate?q=${encodeURIComponent(q)}`;
  // The list changed since the search (a record was removed or renamed): don't show a "1 people" question.
  if (people.length === 0) redirect(back);
  if (people.length === 1) redirect(`/gate/person/${people[0].id}?q=${encodeURIComponent(q)}&picked=1`);

  return (
    <Shell lang={lang} skipLabel={tr(lang, "skip.main")} soonLabel={tr(lang, "soon")} nav={gateNav(lang, "search")}
      title={tr(lang, "title.search")} identityIcon="shield-user" identity={identity(duty)}
      actions={<LangToggle lang={lang} />} aside={<Today lang={lang} />}>
      <section className="ma-panel" aria-labelledby="dh">
        <Link className="ma-link" href={back}><Icon name="arrow-left" />{tr(lang, "back.results")}</Link>
        <h2 className="ma-panel__title" id="dh">{tr(lang, "dup.title", { c: people.length, n: people[0]?.full_name ?? name })}</h2>
        <p className="ma-say"><Icon name="message-circle" /><span><small>{tr(lang, "dup.ask.small")}</small><q>{tr(lang, "dup.ask")}</q></span></p>
        <p className="ma-note">{tr(lang, "dup.tap")}</p>
        <ul className="ma-list ma-choices">
          {people.map((p) => {
            // "Batch 2016 · Computer Science" over "B.Tech": the answer the guard listens for comes first.
            const [degree, ...dept] = (p.program ?? "").split(" ");
            const department = dept.join(" ") || degree;
            return (
              <li key={p.id}>
                <Link className="ma-row" href={`/gate/person/${p.id}?q=${encodeURIComponent(q)}&picked=1`}>
                  <span className="ma-row__photo"><Icon name="user" /></span>
                  <span className="ma-row__text">
                    <b>{[p.batch_year ? tr(lang, "batch", { y: p.batch_year }) : null, department].filter(Boolean).join(" · ")}</b>
                    <span>{dept.length ? degree : ""}</span>
                  </span>
                  <span className="ma-row__chev"><Icon name="chevron-right" /></span>
                </Link>
              </li>
            );
          })}
        </ul>
        <div className="ma-actions"><span className="ma-note">{tr(lang, "dup.neither")}</span><HoldLink lang={lang} href={`/gate/hold?name=${encodeURIComponent(people[0]?.full_name ?? name)}&q=${encodeURIComponent(q)}`} /></div>
      </section>
    </Shell>
  );
}
