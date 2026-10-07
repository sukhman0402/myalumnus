import type { Metadata } from "next";
import { BackLink } from "@/components/BackLink";
import { tr } from "@/lib/i18n";
import { requireOnDuty } from "@/lib/gate";
import { GateShell } from "../GateShell";
import { StudentSearch } from "./StudentSearch";

export const metadata: Metadata = { title: "Family visit · Guard console" };

/** Find the current student first (mockups g24, g25): their family is their responsibility. */
export default async function FamilyLookupPage() {
  const duty = await requireOnDuty();
  const { lang } = duty;
  return (
    <GateShell duty={duty} title={tr(lang, "title.family")}>
      <section className="ma-panel" aria-labelledby="fh">
        <BackLink href={"/gate"} label={tr(lang, "back")} />
        <h2 className="ma-panel__title" id="fh">{tr(lang, "fam.title")}</h2>
        <StudentSearch lang={lang} />
      </section>
    </GateShell>
  );
}
