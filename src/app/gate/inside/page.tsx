import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/Icon";
import { tr, type TKey } from "@/lib/i18n";
import { fmtMinutes, fmtTime, type Kind } from "@/lib/format";
import { signPhotos } from "@/lib/photos";
import { decidedRecently, requireOnDuty } from "@/lib/gate";
import { GateShell } from "../GateShell";
import { ExitButton } from "./ExitButton";

export const metadata: Metadata = { title: "Inside now · Guard console" };

type Row = { kind: "visit" | "family"; id: string; person_id: string | null; name: string; person_kind: Kind | null; program: string | null;
  batch_year: number | null; photo_path: string | null; entered_at: string; purpose: string | null; guests: number | null; over_minutes: number };

function duration(fromIso: string, toIso: string) {
  const m = Math.max(0, Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / 60000));
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
}

/**
 * Everyone let in at this gate who hasn't left, plus open family visits (mockups g20, g22, g23, g29).
 * Overstay = still inside after visiting hours end (planning/02 Q4).
 */
export default async function InsidePage({ searchParams }: { searchParams: Promise<{ exited?: string; closed?: string }> }) {
  const duty = await requireOnDuty("inside");
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
    <GateShell duty={duty} title={tr(lang, "title.inside")} section="inside" banner={banner}>
      <section className="ma-panel" aria-labelledby="ih">
        <h2 className="ma-panel__title" id="ih">
          {rows.length === 1 ? tr(lang, "in.title1") : tr(lang, "in.title", { n: rows.length })}{" "}
          {over ? <span className="ma-chip ma-chip--hold"><span className="ma-circle"><Icon name="triangle-alert" /></span>
            <span className="ma-tabular">{over === 1 ? tr(lang, "in.overstay") : tr(lang, "in.overstays", { n: over })}</span></span> : null}
        </h2>
        {rows.length ? (
          <>
            <p className="ma-note">{tr(lang, "in.sub")}</p>
            <ul className="ma-list">
              {rows.map((r) => {
                const photo = r.kind === "visit" ? urls.get(r.photo_path ?? "") ?? null : null;
                const kind = r.person_kind ? tr(lang, `kind.${r.person_kind}` as TKey) : tr(lang, "walkin.norecord");
                const sub = r.kind === "family"
                  ? tr(lang, "in.family", { g: r.guests ?? 0, s: r.name, t: fmtTime(r.entered_at) })
                  : tr(lang, "in.since", { k: kind, t: fmtTime(r.entered_at), p: r.purpose || tr(lang, "purpose.none") });
                const title = r.kind === "family" ? tr(lang, "fam.close.title", { s: r.name }) : r.name;
                return (
                  <li key={r.id}>
                    <div className="ma-row ma-row--static">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {photo ? <span className="ma-row__photo ma-row__photo--img"><img src={photo} alt="" /></span>
                        : <span className="ma-row__photo"><Icon name={r.kind === "family" ? "users" : "user"} /></span>}
                      <span className="ma-row__text"><b>{title}</b><span>{sub}</span></span>
                      <span className="ma-row__end">
                        {r.kind === "visit" && r.over_minutes > 0 ? (
                          <>
                            <span className="ma-chip ma-chip--hold"><span className="ma-circle"><Icon name="triangle-alert" /></span>
                              <span className="ma-tabular">{tr(lang, "chip.overstay", { m: fmtMinutes(r.over_minutes, lang) })}</span></span>
                            <Link className="ma-btn ma-btn--row" href={`/gate/inside/${r.id}`}><Icon name="phone" />{tr(lang, "in.follow")}<span className="ma-visually-hidden"> · {r.name}</span></Link>
                          </>
                        ) : r.kind === "family" ? (
                          <Link className="ma-btn ma-btn--row" href={`/gate/family/visit/${r.id}`}><Icon name="door-open" />{tr(lang, "in.close")}<span className="ma-visually-hidden"> · {title}</span></Link>
                        ) : (
                          <ExitButton lang={lang} id={r.id} kind="visit" name={r.name} thumb={photo}
                            meta={`${kind} · ${tr(lang, "in.since", { k: "", t: fmtTime(r.entered_at), p: r.purpose || tr(lang, "purpose.none") }).replace(/^ · /, "")}`}
                            rowLabel={tr(lang, "in.exit")} />
                        )}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <div className="ma-list"><div className="ma-empty"><b>{tr(lang, "in.none")}</b><span>{tr(lang, "in.none.sub")}</span></div></div>
        )}
      </section>
    </GateShell>
  );
}
