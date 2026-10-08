import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/Icon";
import { tr } from "@/lib/i18n";
import { signPhotos } from "@/lib/photos";
import { decidedRecently, requireOnDuty, timeFns } from "@/lib/gate";
import { GateShell } from "../GateShell";
import { InsideList, type InsideRow } from "./InsideList";

export const metadata: Metadata = { title: "Inside now · Guard console" };

type Row = InsideRow;

function duration(fromIso: string, toIso: string) {
  const m = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

/**
 * Everyone let in at this gate who hasn't left, plus open family visits (mockups g20, g22, g23, g29).
 * Overstay = still inside after visiting hours end (planning/02 Q4).
 */
export default async function InsidePage({ searchParams }: { searchParams: Promise<{ exited?: string; closed?: string }> }) {
  const { t: fmtTime } = await timeFns();   // this device's 12/24-hour choice
  const duty = await requireOnDuty();
  const { lang } = duty;
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.rpc("gate_inside");
  const rows = (data ?? []) as Row[];
  const over = rows.filter((r) => r.kind === "visit" && r.over_minutes > 0).length;

  let banner: React.ReactNode = null;
  const uuid = /^[0-9a-f-]{36}$/i;
  if (sp.exited && uuid.test(sp.exited)) {
    const { data: v } = await supabase.rpc("gate_inside_visit", { p_visit: sp.exited });
    const x = v as { name: string; entered_at: string; exited_at: string | null } | null;
    if (x?.exited_at && decidedRecently(x.exited_at)) banner = (
      <div className="ma-banner ma-banner--success" role="status"><span className="ma-circle"><Icon name="check" /></span>
        <span className="ma-banner__text"><b>{tr(lang, "exit.done.b", { n: x.name, t: fmtTime(x.exited_at) })}</b> {tr(lang, "exit.done", { d: duration(x.entered_at, x.exited_at) })}</span></div>
    );
  } else if (sp.closed && uuid.test(sp.closed)) {
    const { data: f } = await supabase.rpc("gate_family", { p_id: sp.closed });
    const x = f as { student: string; guests: number; exited_at: string | null } | null;
    if (x?.exited_at && decidedRecently(x.exited_at)) banner = (
      <div className="ma-banner ma-banner--success" role="status"><span className="ma-circle"><Icon name="check" /></span>
        <span className="ma-banner__text"><b>{tr(lang, "fam.closed.b", { s: x.student, t: fmtTime(x.exited_at) })}</b> {tr(lang, "fam.closed", { g: x.guests, s: x.student })}</span></div>
    );
  }

  const urls = await signPhotos(rows.map((r) => (r.kind === "visit" ? r.photo_path : null)));
  return (
    <GateShell duty={duty} title={tr(lang, "title.inside")} banner={banner}>
      <section className="ma-panel" aria-labelledby="ih">
        <h2 className="ma-panel__title" id="ih">
          {rows.length === 1 ? tr(lang, "in.title1") : tr(lang, "in.title", { n: rows.length })}{" "}
          {over ? <span className="ma-chip ma-chip--hold"><span className="ma-circle"><Icon name="triangle-alert" /></span>
            <span className="ma-tabular">{over === 1 ? tr(lang, "in.overstay") : tr(lang, "in.overstays", { n: over })}</span></span> : null}
        </h2>
        {rows.length ? (
          <>
            <InsideList lang={lang} rows={rows} urls={urls} />
          </>
        ) : (
          <div className="ma-list"><div className="ma-empty"><b>{tr(lang, "in.none")}</b></div></div>
        )}
      </section>
    </GateShell>
  );
}
