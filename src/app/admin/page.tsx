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
import { AdminShell } from "./AdminShell";

/** The tab title carries the number of visitors waiting, e.g. "(2) Dashboard", so it shows in a background tab. */
export async function generateMetadata(): Promise<Metadata> {
  const supabase = await createClient();
  const { count } = await supabase.from("cases").select("id", { count: "exact", head: true }).in("status", ["admin", "host"]);
  return { title: `${count ? `(${count}) ` : ""}Dashboard · Admin console` };
}

type Person = { full_name: string; kind: Kind; program: string | null; batch_year: number | null; photo_path: string | null } | null;
type CaseRow = { id: string; name_given: string; reason: string; status: "admin" | "host"; created_at: string;
  gate: { name: string } | null; held: { name: string } | null; person: Person };
type VisitRow = { id: string; outcome: "approved" | "denied"; reason: string | null; decided_at: string; walkin_name: string | null;
  person: Person; decider: { name: string; role: string } | null };
type InsideRow = { id: string; entered_at: string; walkin_name: string | null; gate_id: string; person: Person; gate: { name: string; campus_id: string } | null };

/**
 * The admin's live view (mockup a01): visitors held at the gates come first, because a guard and a visitor
 * are waiting on them. The page re-reads itself every 10 seconds and shows the waiting count in the tab title.
 */
export default async function AdminDashboard() {
  const me = await requireRole("admin");
  const supabase = await createClient();
  const today = dayStartIso();
  const [cases, decided, inside, family, approvedToday, familyToday, rules] = await Promise.all([
    supabase.from("cases").select("id, name_given, reason, status, created_at, gate:gates(name), held:staff!cases_held_by_fkey(name), person:people(full_name, kind, program, batch_year, photo_path)")
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
  const escalate = rules.data?.[0]?.escalate_minutes ?? 10;
  const overstays = insideRows
    .map((v) => ({ ...v, over: overMinutes(v.entered_at, closeBy.get(v.gate?.campus_id ?? "") ?? "18:00") }))
    .filter((v) => v.over > 0);
  const tiles: [number, string, string][] = [
    [(approvedToday.count ?? 0) + (familyToday.count ?? 0), "Today's visits", "#recent"],
    [insideRows.length + (family.count ?? 0), "Inside now", "#overstay"],
    [open.length, "Awaiting your decision", "#queue"],
    [overstays.length, "Overstay flagged", "#overstay"],
  ];
  const urls = await signPhotos([...open, ...recent, ...insideRows].map((x) => x.person?.photo_path));
  const name = (p: Person, walkin: string | null) => p?.full_name ?? walkin ?? "—";
  const thumb = (p: Person) => {
    const src = urls.get(p?.photo_path ?? "") ?? null;
    // eslint-disable-next-line @next/next/no-img-element
    return src ? <span className="ma-row__photo ma-row__photo--img"><img src={src} alt="" /></span> : <span className="ma-row__photo"><Icon name="user" /></span>;
  };

  return (
    <AdminShell me={me} title="Dashboard" current="/admin"
      aside={<>
        <PushToggle />
        <section className="ma-panel" aria-labelledby="overstay">
          <h2 className="ma-panel__title" id="overstay">Overstay {overstays.length ? <Chip kind="hold" icon="triangle-alert" text={`${overstays.length} flagged`} /> : null}</h2>
          {overstays.length ? (
            <>
              <ul className="ma-list">
                {overstays.map((v) => (
                  <li key={v.id}><div className="ma-row ma-row--static">{thumb(v.person)}
                    <span className="ma-row__text"><b>{name(v.person, v.walkin_name)}</b>
                      <span>{v.gate?.name} · in since {fmtTime(v.entered_at)} · {fmtMinutes(v.over)} after closing</span></span>
                    <span className="ma-row__end"><Chip icon="bell" text="Guard notified" /></span></div></li>
                ))}
              </ul>
              <p className="ma-note">The gate is following it up on its Inside now list. You don&apos;t need to act unless they ask.</p>
            </>
          ) : <p className="ma-note">No one is inside after visiting hours.</p>}
        </section>
      </>}>
      <AutoRefresh seconds={10} />
      <div className="ma-stats">
        {tiles.map(([v, label, href]) => (
          <a key={label} className="ma-card" href={href}>
            <span className="ma-card__value ma-tabular">{v}</span><span className="ma-card__label">{label}</span>
            <Icon name="arrow-up-right" className="ma-card__arrow" />
          </a>
        ))}
      </div>
      <section className="ma-panel" aria-labelledby="queue">
        <h2 className="ma-panel__title" id="queue">Escalation queue {open.length ? <Chip icon="hourglass" text={`${open.length} waiting`} /> : null}</h2>
        {open.length ? (
          <>
            <p className="ma-note">Guards are holding these visitors at the gate. If no admin decides within {escalate} minutes, the guard calls the visitor&apos;s host.</p>
            <ul className="ma-list">
              {open.map((c) => (
                <li key={c.id}>
                  <Link className="ma-row" href={`/admin/case/${c.id}`}>
                    {c.person ? thumb(c.person) : <span className="ma-row__photo"><Icon name="flag" /></span>}
                    <span className="ma-row__text"><b>{c.name_given}</b><span>{c.gate?.name} · {c.reason} · held by {c.held?.name ?? "—"}</span></span>
                    <span className="ma-row__end">
                      {c.status === "host"
                        ? <Chip kind="hold" icon="phone" text="Guard calling host" />
                        : <span className="ma-chip ma-chip--hold"><span className="ma-circle"><Icon name="hourglass" /></span><span className="ma-tabular">With you · <Timer since={c.created_at} /></span></span>}
                    </span>
                    <span className="ma-row__chev"><Icon name="chevron-right" /></span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : <div className="ma-list"><div className="ma-empty"><b>No one is waiting</b><span>When a guard holds a visitor, they appear here at once.</span></div></div>}
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
    </AdminShell>
  );
}

function Chip({ icon, text, kind }: { icon: string; text: string; kind?: "hold" | "success" | "danger" }) {
  return <span className={`ma-chip${kind ? ` ma-chip--${kind}` : ""}`}><span className="ma-circle"><Icon name={icon} /></span><span className="ma-tabular">{text}</span></span>;
}

