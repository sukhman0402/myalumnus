import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/Icon";
import { tr, type TKey } from "@/lib/i18n";
import { fmtTime, type Kind } from "@/lib/format";
import { signPhotos } from "@/lib/photos";
import { requireOnDuty } from "@/lib/gate";
import { GateShell } from "../GateShell";

export const metadata: Metadata = { title: "Expected today · Guard console" };

type Row = { person_id: string; full_name: string; kind: Kind; program: string | null; photo_path: string | null;
  expected_at: string; purpose: string | null; host_name: string | null; arrived_at: string | null };

/** Today's expected visitors at this gate, in time order (mockups g18, g19). */
export default async function ExpectedPage() {
  const duty = await requireOnDuty("expected");
  const { lang } = duty;
  const supabase = await createClient();
  const { data } = await supabase.rpc("gate_expected");
  const rows = (data ?? []) as Row[];
  const urls = await signPhotos(rows.map((r) => r.photo_path));
  return (
    <GateShell duty={duty} title={tr(lang, "title.expected")}>
      <section className="ma-panel" aria-labelledby="eh">
        <h2 className="ma-panel__title" id="eh">{tr(lang, "exp.title", { n: rows.length })}</h2>
        {rows.length ? (
          <>
            <ul className="ma-list">
              {rows.map((r) => {
                const photo = urls.get(r.photo_path ?? "") ?? null;
                return (
                  <li key={`${r.person_id}-${r.expected_at}`}>
                    <Link className="ma-row" href={`/gate/person/${r.person_id}?picked=1&from=expected`}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {photo ? <span className="ma-row__photo ma-row__photo--img"><img src={photo} alt="" /></span> : <span className="ma-row__photo"><Icon name="user" /></span>}
                      <span className="ma-row__text"><b>{r.full_name}</b>
                        <span>{tr(lang, "exp.meta", { k: tr(lang, `kind.${r.kind}` as TKey), t: fmtTime(r.expected_at), h: r.host_name || "—" })}</span></span>
                      {r.arrived_at ? <span className="ma-row__end"><span className="ma-chip ma-chip--success"><span className="ma-circle"><Icon name="check" /></span>
                        <span className="ma-tabular">{tr(lang, "chip.arrived", { t: fmtTime(r.arrived_at) })}</span></span></span> : null}
                      <span className="ma-row__chev"><Icon name="chevron-right" /></span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <div className="ma-list"><div className="ma-empty"><b>{tr(lang, "exp.none")}</b><span>{tr(lang, "exp.none.sub")}</span></div></div>
        )}
      </section>
    </GateShell>
  );
}
