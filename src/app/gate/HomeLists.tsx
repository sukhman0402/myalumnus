import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/Icon";
import { tr, type Lang } from "@/lib/i18n";
import { timeFns } from "@/lib/gate";
import { type Kind } from "@/lib/format";
import { signPhotos } from "@/lib/photos";
import { InsideList, MiniTime, type InsideRow } from "./inside/InsideList";

type ExpRow = { person_id: string; full_name: string; kind: Kind; program: string | null; photo_path: string | null;
  expected_at: string; purpose: string | null; host_name: string | null; arrived_at: string | null };
type CaseRow = { id: string; name_given: string; person_id: string | null; photo_path: string | null; status: "admin" | "host"; created_at: string };
type DeniedRow = { id: string; name_given: string; person_id: string | null; photo_path: string | null; decided_at: string; by_admin: boolean };

async function load() {
  const supabase = await createClient();
  const [exp, ins, cases, denied] = await Promise.all([supabase.rpc("gate_expected"), supabase.rpc("gate_inside"), supabase.rpc("gate_on_hold"),
    supabase.rpc("gate_denied_today")]);
  return { expected: (exp.data ?? []) as ExpRow[], inside: (ins.data ?? []) as InsideRow[], open: (cases.data ?? []) as CaseRow[],
    denied: (denied.data ?? []) as DeniedRow[] };
}

/**
 * The gate lists on Home (owner, 2026-10-07): Inside now and Flagged & hold as two equal panels side by side under the
 * search; Expected today in the right column under the clock. One round trip for all three lists.
 */
export async function homeLists(lang: Lang) {
  const { t: fmtTime } = await timeFns();   // this device's 12/24-hour choice
  const { expected, inside, open, denied } = await load();
  const urls = await signPhotos([...expected.map((r) => r.photo_path), ...inside.map((r) => (r.kind === "visit" ? r.photo_path : null)),
    ...open.map((r) => r.photo_path), ...denied.map((r) => r.photo_path)]);
  const empty = (t: string, d?: string) => <div className="ma-list"><div className="ma-empty"><b>{t}</b>{d ? <span>{d}</span> : null}</div></div>;

  // Home rows keep only what the guard acts on (owner, 2026-10-07): name, one time, and the status or action.
  const expectedPanel = expected.length ? (
    <ul className="ma-mini">
      {expected.map((r) => {
        const photo = urls.get(r.photo_path ?? "") ?? null;
        return (
          <li key={`${r.person_id}-${r.expected_at}`}>
            <Link className="ma-mini__row ma-mini__row--link" href={`/gate/person/${r.person_id}?picked=1`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {photo ? <span className="ma-mini__photo"><img src={photo} alt="" /></span> : <span className="ma-mini__photo"><Icon name="user" size={18} /></span>}
              {/* Not here yet: when they're due. Arrived: when they arrived, in green. */}
              <span className="ma-mini__text"><b>{r.full_name}</b>{r.arrived_at
                ? <MiniTime label={tr(lang, "mini.arrived")} time={fmtTime(r.arrived_at)} ok />
                : <MiniTime label={tr(lang, "mini.due")} time={fmtTime(r.expected_at)} />}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  ) : empty(tr(lang, "exp.none"));

  // On hold (owner, 2026-10-08): people still on hold first, then those denied today, by the gate or an admin (an
  // admin's deny used to never reach the gate). No times, no group label: the status chip says it all.
  const casesPanel = open.length || denied.length ? (
    <ul className="ma-mini">
      {open.map((c) => {
        const photo = urls.get(c.photo_path ?? "") ?? null;
        return (
        <li key={c.id}>
          <Link className="ma-mini__row ma-mini__row--link" href={`/gate/case/${c.id}`}>
            {/* No flag icon: the chip on the right already says it is a hold (owner, 2026-10-08). Photo when on record. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photo ? <span className="ma-mini__photo"><img src={photo} alt="" /></span> : <span className="ma-mini__photo"><Icon name="user" size={18} /></span>}
            <span className="ma-mini__text"><b>{c.name_given}</b></span>
            <span className="ma-chip ma-chip--hold"><span className="ma-circle"><Icon name={c.status === "host" ? "phone" : "hourglass"} /></span>
              <span>{tr(lang, c.status === "host" ? "mini.callhost" : "mini.withadmin")}</span></span>
          </Link>
        </li>
        );
      })}
      {denied.map((c) => {
        const photo = urls.get(c.photo_path ?? "") ?? null;
        return (
          <li key={c.id}>
            <Link className="ma-mini__row ma-mini__row--link" href={`/gate/case/${c.id}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              {photo ? <span className="ma-mini__photo"><img src={photo} alt="" /></span> : <span className="ma-mini__photo"><Icon name="user" size={18} /></span>}
              <span className="ma-mini__text"><b>{c.name_given}</b></span>
              <span className="ma-chip ma-chip--danger"><span className="ma-circle"><Icon name="ban" /></span><span>{tr(lang, "mini.denied")}</span></span>
            </Link>
          </li>
        );
      })}
    </ul>
  ) : empty(tr(lang, "cases.none"));

  const count = (n: number, urgent?: boolean) => <span className={`ma-tab__count${urgent && n > 0 ? " is-urgent" : ""}`}>{n}</span>;
  return {
    main: (
      <div className="ma-home-pair">
        <section className="ma-panel" aria-labelledby="h-inside">
          <h2 className="ma-panel__title" id="h-inside"><span>{tr(lang, "tile.inside")} {count(inside.length)}</span></h2>
          {inside.length ? <InsideList lang={lang} rows={inside} urls={urls} /> : empty(tr(lang, "in.none"))}
        </section>
        <section className="ma-panel" aria-labelledby="h-flag">
          <h2 className="ma-panel__title" id="h-flag"><span>{tr(lang, "tile.flagged")} {count(open.length, true)}</span></h2>
          {casesPanel}
        </section>
      </div>
    ),
    aside: (
      <section className="ma-panel" aria-labelledby="h-exp">
        <h2 className="ma-panel__title" id="h-exp"><span>{tr(lang, "tile.expected")} {count(new Set(expected.map((r) => r.person_id)).size)}</span></h2>
        {expectedPanel}
      </section>
    ),
  };
}
