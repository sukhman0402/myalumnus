import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/Icon";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Timer } from "@/components/Timer";
import { dayStartIso, fmtMinutes, fmtTime, overMinutes, type Kind } from "@/lib/format";
import { signPhotos } from "@/lib/photos";
import { PushToggle } from "@/components/PushToggle";
import { DEMO_MODE } from "@/lib/demo";
import { AdminShell } from "./AdminShell";
import { adminSince, handoffAt, stageOf } from "@/lib/cases";

/** The tab title carries the number of visitors waiting, e.g. "(2) Dashboard", so it shows in a background tab. */
export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  // Host first (0017): only cases with the admins are "waiting on you".
  const { count } = await supabase.from("cases").select("id", { count: "exact", head: true }).eq("status", "admin");
  return { title: `${count ? `(${count}) ` : ""}Dashboard · Admin console` };
}

type Person = { full_name: string; kind: Kind; program: string | null; batch_year: number | null; photo_path: string | null } | null;
type CaseRow = { id: string; name_given: string; reason: string; status: "admin" | "host"; created_at: string;
  passed_to_host_at: string | null; passed_to_admin_at: string | null; gate_id: string;
  gate: { name: string; campus_id: string } | null; held: { name: string } | null; person: Person };
type VisitRow = { id: string; outcome: "approved" | "denied"; reason: string | null; decided_at: string; walkin_name: string | null;
  person: Person; decider: { name: string; role: string } | null };
type InsideRow = { id: string; entered_at: string; walkin_name: string | null; gate_id: string; person: Person; gate: { name: string; campus_id: string } | null };

/**
 * The admin's live view. Layout chosen by the owner (2026-10-06/07): Escalation queue, Awaiting your decision,
 * Decided today, Inside now on the left; Today's visits, then Overstay, on the right.
 * Re-reads itself every 10 seconds; the tab title shows how many are waiting on the admin.
 * Owner, 2026-10-08: counts sit next to their titles; Inside now and Overstay rows open the visit page.
 */
export default async function AdminDashboard() {
  const me = await requireRole("admin");
  const supabase = await createClient();
  const today = dayStartIso();
  const [cases, decided, inside, family, approvedToday, familyToday, rules] = await Promise.all([
    supabase.from("cases").select("id, name_given, reason, status, created_at, passed_to_host_at, passed_to_admin_at, gate_id, gate:gates(name, campus_id), held:staff!cases_held_by_fkey(name), person:people(full_name, kind, program, batch_year, photo_path)")
      .in("status", ["admin", "host"]).order("created_at"),
    supabase.from("visits").select("id, outcome, reason, decided_at, walkin_name, person:people(full_name, kind, program, batch_year, photo_path), decider:staff!visits_decided_by_fkey(name, role)")
      .gte("decided_at", today).order("decided_at", { ascending: false }).limit(8),
    supabase.from("visits").select("id, entered_at, walkin_name, gate_id, person:people(full_name, kind, program, batch_year, photo_path), gate:gates(name, campus_id)")
      .not("entered_at", "is", null).is("exited_at", null).order("entered_at"),
    supabase.from("family_visits").select("id", { count: "exact", head: true }).is("exited_at", null),
    supabase.from("visits").select("id", { count: "exact", head: true }).eq("outcome", "approved").gte("decided_at", today),
    supabase.from("family_visits").select("id", { count: "exact", head: true }).gte("entered_at", today),
    supabase.from("campus_rules").select("campus_id, close_time, escalate_minutes"),
  ]);
  const open = (cases.data ?? []) as unknown as CaseRow[];
  const recent = (decided.data ?? []) as unknown as VisitRow[];
  const insideRows = (inside.data ?? []) as unknown as InsideRow[];
  const closeBy = new Map((rules.data ?? []).map((r) => [r.campus_id as string, r.close_time as string]));
  const limitBy = new Map((rules.data ?? []).map((r) => [r.campus_id as string, (r.escalate_minutes as number) ?? 10]));
  const overstays = insideRows
    .map((v) => ({ ...v, over: overMinutes(v.entered_at, closeBy.get(v.gate?.campus_id ?? "") ?? "18:00") }))
    .filter((v) => v.over > 0);
  // Host first (0017): the guard calls the host (stage 1); the case reaches the admins when the host can't confirm (stage 2).
  const staged = open.map((c) => {
    const m = limitBy.get(c.gate?.campus_id ?? "") ?? 10;
    return { ...c, stage: stageOf(c, m), since: adminSince(c, m), handoff: handoffAt(c, m) };
  });
  const awaiting = staged.filter((c) => c.stage === "admin");
  const atGate = staged.filter((c) => c.stage === "host");
  const visitsToday = (approvedToday.count ?? 0) + (familyToday.count ?? 0);
  const urls = await signPhotos([...open, ...recent, ...insideRows].map((x) => x.person?.photo_path));
  const name = (p: Person, walkin: string | null) => p?.full_name ?? walkin ?? "—";
  const thumb = (p: Person) => {
    const src = urls.get(p?.photo_path ?? "") ?? null;
    // eslint-disable-next-line @next/next/no-img-element
    return src ? <span className="ma-row__photo ma-row__photo--img"><img src={src} alt="" /></span> : <span className="ma-row__photo"><Icon name="user" /></span>;
  };
  const caseRow = (c: (typeof staged)[number]) => (
    <li key={c.id}>
      <Link className="ma-row" href={`/admin/case/${c.id}`}>
        {thumb(c.person)}   {/* no flag icon: the chip says it is a hold (as on the gate, owner 2026-10-08) */}
        <span className="ma-row__text"><b>{c.name_given}</b><span>{c.gate?.name} · {c.reason}</span></span>
        <span className="ma-row__end">
          {c.stage === "admin"
            ? <span className="ma-chip ma-chip--hold"><span className="ma-circle"><Icon name="hourglass" /></span><span className="ma-tabular">Waiting · <Timer since={c.since ?? c.created_at} /></span></span>
            : <span className="ma-chip"><span className="ma-circle"><Icon name="phone" /></span><span className="ma-tabular">Guard calling host · <Timer since={c.created_at} /></span></span>}
        </span>
        <span className="ma-row__chev"><Icon name="chevron-right" /></span>
      </Link>
    </li>
  );

  return (
    <AdminShell me={me} title="Dashboard" current="/admin"
      aside={<>
        {DEMO_MODE ? null : <PushToggle />}
        <section className="ma-panel" aria-label="Today">
          <Link className="ma-card ma-card--hero" href="/admin/history">
            <span className="ma-card__value ma-tabular">{visitsToday}</span>
            <span className="ma-card__label">Today&apos;s visits{familyToday.count ? ` · ${familyToday.count} family` : ""}</span>
            <Icon name="arrow-up-right" className="ma-card__arrow" />
          </Link>
        </section>
        <section className="ma-panel" aria-labelledby="overstay">
          <h2 className="ma-panel__title" id="overstay"><span>Overstay <Count n={overstays.length} urgent /></span></h2>
          {overstays.length ? (
            // Photos, and each row opens the visit page (owner, 2026-10-08).
            <ul className="ma-list">
              {overstays.map((v) => (
                <li key={v.id}><Link className="ma-row ma-row--compact" href={`/admin/history/${v.id}`}>{thumb(v.person)}
                  <span className="ma-row__text"><b>{name(v.person, v.walkin_name)}</b><span>{v.gate?.name} · {fmtMinutes(v.over)} over</span></span>
                  <span className="ma-row__chev"><Icon name="chevron-right" /></span>
                </Link></li>
              ))}
            </ul>
          ) : <p className="ma-note">No one is inside after visiting hours.</p>}
        </section>
      </>}>
      <AutoRefresh seconds={10} />
      <section className="ma-panel" aria-labelledby="queue">
        <h2 className="ma-panel__title" id="queue"><span>Escalation queue <Count n={atGate.length} /></span></h2>
        {atGate.length ? (
          <>
            <p className="ma-note">Held at a gate. The guard is calling the host; each comes to you if the host can&apos;t confirm.</p>
            <ul className="ma-list">{atGate.map(caseRow)}</ul>
          </>
        ) : <p className="ma-note">No one is held at the gates.</p>}
      </section>
      <section className="ma-panel" aria-labelledby="awaiting">
        <h2 className="ma-panel__title" id="awaiting"><span>Awaiting your decision <Count n={awaiting.length} urgent /></span></h2>
        {awaiting.length ? <ul className="ma-list">{awaiting.map(caseRow)}</ul> : <p className="ma-note">Nothing needs your decision.</p>}
      </section>
      <section className="ma-panel" aria-labelledby="recent">
        <h2 className="ma-panel__title" id="recent">Decided today</h2>
        {recent.length ? (
          <ul className="ma-list">
            {recent.map((v) => {
              const ok = v.outcome === "approved";
              const by = v.decider ? (v.decider.role === "admin" ? (v.decider.name === me.name ? "you" : v.decider.name) : "guard") : "—";
              return (
                <li key={v.id}><Link className="ma-row" href={`/admin/history/${v.id}`}>{thumb(v.person)}
                  <span className="ma-row__text"><b>{name(v.person, v.walkin_name)}</b>
                    <span>{ok ? "Approved" : "Denied"} by {by} · {fmtTime(v.decided_at)}{v.reason ? ` · ${v.reason}` : ""}</span></span>
                  <span className="ma-row__end"><Chip kind={ok ? "success" : "danger"} icon={ok ? "check" : "ban"} text={ok ? "Approved" : "Denied"} /></span>
                  <span className="ma-row__chev"><Icon name="chevron-right" /></span>
                </Link></li>
              );
            })}
          </ul>
        ) : <p className="ma-note">No decisions yet today.</p>}
        {recent.length ? <p><Link className="ma-link" href="/admin/history">All of today in History<Icon name="arrow-right" size={16} /></Link></p> : null}
      </section>
      <section className="ma-panel" aria-labelledby="inside">
        <h2 className="ma-panel__title" id="inside"><span>Inside now <Count n={insideRows.length + (family.count ?? 0)} /></span></h2>
        {insideRows.length ? (
          <ul className="ma-list ma-rows-scroll">
            {insideRows.map((v) => (
              <li key={v.id}><Link className="ma-row" href={`/admin/history/${v.id}`}>{thumb(v.person)}
                <span className="ma-row__text"><b>{name(v.person, v.walkin_name)}</b><span>{v.gate?.name} · since {fmtTime(v.entered_at)}</span></span>
                <span className="ma-row__chev"><Icon name="chevron-right" /></span>
              </Link></li>
            ))}
          </ul>
        ) : <p className="ma-note">No visitors inside right now.</p>}
        {family.count ? <p className="ma-note">Plus {family.count} family {family.count === 1 ? "group" : "groups"} visiting students.</p> : null}
      </section>
    </AdminShell>
  );
}

/** The count next to a panel title, the same pill as the guard console (owner, 2026-10-08: it sat far right here). */
function Count({ n, urgent }: { n: number; urgent?: boolean }) {
  return <span className={`ma-tab__count${urgent && n > 0 ? " is-urgent" : ""}`}>{n}</span>;
}

function Chip({ icon, text, kind }: { icon: string; text: string; kind?: "hold" | "success" | "danger" }) {
  return <span className={`ma-chip${kind ? ` ma-chip--${kind}` : ""}`}><span className="ma-circle"><Icon name={icon} /></span><span className="ma-tabular">{text}</span></span>;
}
