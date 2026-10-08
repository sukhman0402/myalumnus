import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos";
import { addDays, fmtDay, fmtTime, localIso, ymd } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { AdminShell } from "../AdminShell";
import { Banner, Empty, PanelHead, PersonCell, RowLink, Table } from "../ui";

export const metadata: Metadata = { title: "Expected visits · Admin console" };

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

  return (
    <AdminShell me={me} title="Expected visits" current="/admin/visitors"
      banner={sp.added ? <Banner kind="success" icon="check"><b>Visitor added.</b> {tab === "today" ? "The gate sees them under Expected today now." : "The gate sees them on the day."}</Banner>
        : sp.cancelled ? <Banner kind="success" icon="check"><b>Visit cancelled.</b> It no longer shows at the gate.</Banner>
        : error ? <Banner kind="danger" icon="circle-alert" alert>Couldn&apos;t load the visitors. Refresh the page.</Banner> : null}>
      <section className="ma-panel" aria-labelledby="ph">
        <PanelHead id="ph" title="Expected visitors" actions={<Link className="ma-btn ma-btn--primary" href="/admin/visitors/new"><Icon name="plus" />Add visitor</Link>} />
        <nav className="ma-tabs" aria-label="When">
          {TABS.map(([t, l]) => <Link key={t} className="ma-tab" href={`/admin/visitors?tab=${t}`} aria-current={tab === t ? "page" : undefined}>{l}</Link>)}
        </nav>
        {rows.length ? (
          // Only when, who and whom they're visiting (owner, 2026-10-06); everything else is one click away on the visit page.
          <Table label="Expected visitors" heads={["When", "Visitor", "Visiting", ""]}>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="ma-tabular">{tab === "today" ? "" : `${fmtDay(ymd(new Date(r.expected_at)))}, `}{fmtTime(r.expected_at)}</td>
                <td><PersonCell name={r.person.full_name} src={urls.get(r.person.photo_path ?? "")} /></td>
                <td>{r.host_name ?? "—"}</td>
                <td style={{ textAlign: "right" }}><RowLink href={`/admin/visitors/${r.id}`} label="View" who={`${r.person.full_name}'s visit`} /></td>
              </tr>
            ))}
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
