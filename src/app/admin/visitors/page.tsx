import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos";
import { addDays, fmtDay, fmtTime, KIND_LABEL, localIso, nowMs, ymd } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { AdminShell } from "../AdminShell";
import { ConfirmButton } from "../ConfirmButton";
import { Banner, Chip, Empty, PanelHead, PersonCell, Table } from "../ui";
import { cancelExpected } from "./actions";

export const metadata: Metadata = { title: "Visitors · Admin console" };

type Row = {
  id: string; expected_at: string; purpose: string | null; host_name: string | null; host_phone: string | null; gate: string | null; arrived_at: string | null;
  person: { id: string; full_name: string; kind: string; program: string | null; batch_year: number | null; photo_path: string | null };
};
const TABS = [["today", "Today"], ["upcoming", "Next 30 days"], ["past", "Past 7 days"]] as const;

/** Expected visitors (mockups a18, a19). Guards see today's list under "Expected today". */
export default async function VisitorsPage({ searchParams }: { searchParams: Promise<{ tab?: string; added?: string; cancelled?: string }> }) {
  const me = await requireRole("admin");
  const sp = await searchParams;
  const tab = TABS.some(([t]) => t === sp.tab) ? sp.tab! : "today";
  const today = ymd();
  const [from, to] = tab === "today" ? [today, addDays(today, 1)] : tab === "upcoming" ? [addDays(today, 1), addDays(today, 31)] : [addDays(today, -7), today];
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_expected", { p_from: localIso(from), p_to: localIso(to) });
  let rows = (data ?? []) as Row[];
  if (tab === "past") rows = [...rows].reverse();
  const urls = await signPhotos(rows.map((r) => r.person.photo_path));
  const now = nowMs();

  return (
    <AdminShell me={me} title="Visitors" current="/admin/visitors"
      banner={sp.added ? <Banner kind="success" icon="check"><b>Visitor added.</b> {tab === "today" ? "The gate sees them under Expected today now." : "The gate sees them on the day."}</Banner>
        : sp.cancelled ? <Banner kind="success" icon="check"><b>Visit cancelled.</b> It no longer shows at the gate.</Banner>
        : error ? <Banner kind="danger" icon="circle-alert" alert>Couldn&apos;t load the visitors. Refresh the page.</Banner> : null}>
      <section className="ma-panel" aria-labelledby="ph">
        <PanelHead id="ph" title="Expected visitors" actions={<Link className="ma-btn ma-btn--primary" href="/admin/visitors/new"><Icon name="plus" />Add visitor</Link>} />
        <nav className="ma-tabs" aria-label="When">
          {TABS.map(([t, l]) => <Link key={t} className="ma-tab" href={`/admin/visitors?tab=${t}`} aria-current={tab === t ? "page" : undefined}>{l}</Link>)}
        </nav>
        {rows.length ? (
          <Table label="Expected visitors" heads={["When", "Visitor", "Type", "Visiting", "Gate", "Status", ""]}>
            {rows.map((r) => {
              const past = new Date(r.expected_at).getTime() < now;
              return (
                <tr key={r.id} style={{ cursor: "default" }}>
                  <td className="ma-tabular">{tab === "today" ? "" : `${fmtDay(ymd(new Date(r.expected_at)))}, `}{fmtTime(r.expected_at)}</td>
                  <td><Link className="ma-link" href={`/admin/alumni/${r.person.id}`}><PersonCell name={r.person.full_name} src={urls.get(r.person.photo_path ?? "")} /></Link></td>
                  <td>{KIND_LABEL[r.person.kind]}{r.person.batch_year ? ` · ${r.person.batch_year}` : ""}</td>
                  <td>{r.host_name ?? "—"}{r.host_phone ? <><br /><span className="ma-tabular ma-note">{r.host_phone}</span></> : null}{r.purpose ? <><br /><span className="ma-note">{r.purpose}</span></> : null}</td>
                  <td>{r.gate ?? "Any gate"}</td>
                  <td>{r.arrived_at ? <Chip icon="check" text={`Arrived ${fmtTime(r.arrived_at)}`} kind="success" />
                    : tab === "past" || (past && tab === "today") ? <Chip icon="clock" text={tab === "past" ? "Didn't arrive" : "Not arrived yet"} kind={tab === "past" ? undefined : "hold"} />
                    : <Chip icon="calendar-clock" text="Expected" />}</td>
                  <td style={{ textAlign: "right" }}>
                    {tab !== "past" && !r.arrived_at ? (
                      <ConfirmButton action={cancelExpected} fields={{ id: r.id, tab }} small label="Cancel" icon="x"
                        title={`Cancel ${r.person.full_name}'s visit?`} confirmLabel="Cancel visit" keepLabel="Keep visit"
                        body={<p>The visit is removed from the gate&apos;s Expected list. {r.person.full_name}&apos;s record stays, and they can still be checked in as a normal visitor.</p>} />
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </Table>
        ) : (
          <Empty title={tab === "today" ? "No visitors expected today" : tab === "upcoming" ? "No visitors expected in the next 30 days" : "No expected visitors in the past 7 days"}>
            Add a visitor so the gate knows they&apos;re coming.
          </Empty>
        )}
      </section>
    </AdminShell>
  );
}
