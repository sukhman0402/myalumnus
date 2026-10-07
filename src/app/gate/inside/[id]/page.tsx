import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/Icon";
import { BackLink } from "@/components/BackLink";
import { RecordPhoto } from "@/components/RecordPhoto";
import { tr } from "@/lib/i18n";
import { fmtMinutes, fmtMonth, fmtTime, personMeta, type Kind } from "@/lib/format";
import { photoSrc, requireOnDuty } from "@/lib/gate";
import { GateShell } from "../../GateShell";
import { ExitButton } from "../ExitButton";

export const metadata: Metadata = { title: "Overstay · Guard console" };

type V = { id: string; name: string; person_id: string | null; kind: Kind | null; program: string | null; batch_year: number | null;
  photo_path: string | null; photo_added_on: string | null; entered_at: string; exited_at: string | null; purpose: string | null;
  phone: string | null; closes_at: string; over_minutes: number };

/** Follow up someone still inside after visiting hours (mockup g21, with the Q4 rule). */
export default async function OverstayPage({ params }: { params: Promise<{ id: string }> }) {
  const duty = await requireOnDuty();
  const { lang } = duty;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.rpc("gate_inside_visit", { p_visit: id });
  const v = data as V | null;
  if (!v) notFound();
  const src = await photoSrc(v.photo_path);
  const meta = v.kind ? personMeta(lang, { kind: v.kind, program: v.program, batch_year: v.batch_year }) : tr(lang, "walkin.norecord");
  const first = v.name.replace(/^(Dr\.|Prof\.)\s+/, "").split(" ")[0];
  const tel = v.phone?.replace(/[^+0-9]/g, "");

  return (
    <GateShell duty={duty} title={tr(lang, "title.inside")}>
      <section className="ma-panel" aria-labelledby="oh">
        <BackLink href={"/gate"} label={tr(lang, "back")} />
        <div className="ma-record">
          <RecordPhoto src={src} name={v.name}
            caption={v.photo_added_on ? tr(lang, "photo.added", { d: fmtMonth(v.photo_added_on, lang) }) : null}
            enlargeLabel={tr(lang, "photo.enlarge", { n: v.name })} altText={tr(lang, "photo.alt", { n: v.name })}
            closeLabel={tr(lang, "close")} noneTitle={tr(lang, "photo.none.t")} noneText={tr(lang, "photo.none.d")} />
          <div className="ma-record__info">
            <div>
              <h2 className="ma-record__name" id="oh">{v.name}</h2>
              <p className="ma-record__meta">{meta}</p>
              {v.over_minutes > 0 ? <div className="ma-record__chips"><span className="ma-chip ma-chip--hold"><span className="ma-circle"><Icon name="triangle-alert" /></span>
                <span className="ma-tabular">{tr(lang, "chip.overstay", { m: fmtMinutes(v.over_minutes, lang) })}</span></span></div> : null}
            </div>
            <dl className="ma-kv">
              <dt>{tr(lang, "kv.insince")}</dt><dd>{tr(lang, "kv.insince.v", { t: fmtTime(v.entered_at), u: fmtTime(v.closes_at) })}</dd>
              <dt>{tr(lang, "kv.purpose")}</dt><dd>{v.purpose || "—"}</dd>
              <dt>{tr(lang, "kv.phone")}</dt><dd><span className="ma-tabular">{v.phone || "—"}</span></dd>
            </dl>
          </div>
        </div>
        <h3 className="ma-sub__title">{tr(lang, "ov.title")}</h3>
        <ol className="ma-next">
          <li>{v.phone ? tr(lang, "ov.1", { n: first }) : tr(lang, "ov.1.nophone")}</li>
          <li>{tr(lang, "ov.2", { p: v.purpose || tr(lang, "purpose.none") })}</li>
          <li>{tr(lang, "ov.3")}</li>
        </ol>
        <div className="ma-actions">
          {tel ? <a className="ma-btn ma-btn--primary" href={`tel:${tel}`}><Icon name="phone" />{tr(lang, "ov.call", { n: first })}</a> : null}
          {v.exited_at ? null : <ExitButton lang={lang} id={v.id} kind="visit" name={v.name} meta={meta} thumb={src}
            rowLabel={tr(lang, "in.exit")} variant={tel ? "row" : "primary"} />}
        </div>
      </section>
    </GateShell>
  );
}
