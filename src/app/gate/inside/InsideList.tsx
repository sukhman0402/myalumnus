import Link from "next/link";
import { Icon } from "@/components/Icon";
import { tr, type Lang, type TKey } from "@/lib/i18n";
import { fmtMinutes, fmtTime, type Kind } from "@/lib/format";
import { ExitButton } from "./ExitButton";

export type InsideRow = { kind: "visit" | "family"; id: string; person_id: string | null; name: string; person_kind: Kind | null; program: string | null;
  batch_year: number | null; photo_path: string | null; entered_at: string; purpose: string | null; guests: number | null; over_minutes: number };

/** Everyone inside: Mark exit, close a family visit, or follow up an overstay. Used on Home (compact) and on Inside now. */
export function InsideList({ lang, rows, urls, compact }: { lang: Lang; rows: InsideRow[]; urls: Map<string, string>; compact?: boolean }) {
  if (compact) return <InsideMini lang={lang} rows={rows} urls={urls} />;
  return (
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
  );
}

/** Home version (owner, 2026-10-07): only who, since when, and the action. No type, no purpose. */
function InsideMini({ lang, rows, urls }: { lang: Lang; rows: InsideRow[]; urls: Map<string, string> }) {
  return (
    <ul className="ma-mini">
      {rows.map((r) => {
        const photo = r.kind === "visit" ? urls.get(r.photo_path ?? "") ?? null : null;
        const over = r.kind === "visit" && r.over_minutes > 0;
        const title = r.kind === "family" ? tr(lang, "fam.close.title", { s: r.name }) : r.name;
        return (
          <li key={r.id} className="ma-mini__row">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photo ? <span className="ma-mini__photo"><img src={photo} alt="" /></span> : <span className="ma-mini__photo"><Icon name={r.kind === "family" ? "users" : "user"} size={18} /></span>}
            <span className="ma-mini__text">
              <b>{title}</b>
              <MiniTime label={tr(lang, "mini.in")} time={fmtTime(r.entered_at)} warn={over ? fmtMinutes(r.over_minutes, lang) : undefined} />
            </span>
            {over ? (
              <Link className="ma-btn ma-btn--row" href={`/gate/inside/${r.id}`}>{tr(lang, "in.follow")}<span className="ma-visually-hidden"> · {r.name}</span></Link>
            ) : r.kind === "family" ? (
              <Link className="ma-btn ma-btn--row" href={`/gate/family/visit/${r.id}`}>{tr(lang, "in.close")}<span className="ma-visually-hidden"> · {title}</span></Link>
            ) : (
              <ExitButton lang={lang} id={r.id} kind="visit" name={r.name} thumb={photo}
                meta={`${tr(lang, "mini.in")} ${fmtTime(r.entered_at)}`} rowLabel={tr(lang, "in.exit")} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** The one detail a Home row keeps: a time, with its meaning as a short word (In / Held / Due). */
export function MiniTime({ label, time, warn, ok }: { label: string; time: string; warn?: string; ok?: boolean }) {
  return (
    <span className={`ma-mini__time${warn ? " is-warn" : ok ? " is-ok" : ""}`}>
      <Icon name={warn ? "triangle-alert" : ok ? "circle-check" : "clock"} size={14} /><span>{label}</span><b className="ma-tabular">{time}</b>{warn ? <span>· +{warn}</span> : null}
    </span>
  );
}
