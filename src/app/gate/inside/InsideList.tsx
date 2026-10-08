import Link from "next/link";
import { Icon } from "@/components/Icon";
import { tr, type Lang } from "@/lib/i18n";
import { type Kind } from "@/lib/format";

export type InsideRow = { kind: "visit" | "family"; id: string; person_id: string | null; name: string; person_kind: Kind | null; program: string | null;
  batch_year: number | null; photo_path: string | null; entered_at: string; purpose: string | null; guests: number | null; over_minutes: number };

/** Everyone inside, on Home and on the Inside now page alike (owner, 2026-10-08): status on the right, the whole row
 *  opens the detail (Mark exit, follow-up, close a family visit). */
export function InsideList({ lang, rows, urls }: { lang: Lang; rows: InsideRow[]; urls: Map<string, string> }) {
  return <InsideMini lang={lang} rows={rows} urls={urls} />;
}

/** Home version (owner, 2026-10-08): who, and their status; the whole row opens the detail, where Mark exit and
 *  follow-up happen. No times here. Overstay (also for family visits) shows the alert status. */
function InsideMini({ lang, rows, urls }: { lang: Lang; rows: InsideRow[]; urls: Map<string, string> }) {
  return (
    <ul className="ma-mini">
      {rows.map((r) => {
        const photo = r.kind === "visit" ? urls.get(r.photo_path ?? "") ?? null : null;
        const over = r.over_minutes > 0;
        const title = r.kind === "family" ? tr(lang, "fam.close.title", { s: r.name }) : r.name;
        const href = r.kind === "family" ? `/gate/family/visit/${r.id}` : `/gate/inside/${r.id}`;
        return (
          <li key={r.id}>
            <Link className="ma-mini__row ma-mini__row--link" href={href}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {photo ? <span className="ma-mini__photo"><img src={photo} alt="" /></span> : <span className="ma-mini__photo"><Icon name={r.kind === "family" ? "users" : "user"} size={18} /></span>}
              <span className="ma-mini__text"><b>{title}</b></span>
              {over ? (
                <span className="ma-chip ma-chip--hold"><span className="ma-circle"><Icon name="triangle-alert" /></span><span>{tr(lang, "mini.overstay")}</span></span>
              ) : r.kind === "family" ? (
                <span className="ma-chip"><span className="ma-circle"><Icon name="users" /></span><span>{tr(lang, "mini.family", { g: r.guests ?? 0 })}</span></span>
              ) : (
                <span className="ma-chip ma-chip--success"><span className="ma-circle"><Icon name="check" /></span><span>{tr(lang, "mini.inside")}</span></span>
              )}
            </Link>
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
