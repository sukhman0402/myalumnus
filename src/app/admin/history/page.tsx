import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos";
import { fmtDate, fmtDay, fmtTime, KIND_LABEL } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { AdminShell } from "../AdminShell";
import { FilterForm } from "../FilterForm";
import { Chip, Empty, FilterSelect, Pager, PanelHead, PersonCell, RowLink, Table, withParams } from "../ui";
import { historyQuery, OUTCOMES, RANGES, TYPES, type HistoryRow, type HistorySP } from "./query";

export const metadata: Metadata = { title: "History · Admin console" };

/** Every gate decision and family visit (mockups a10, a11). Read-only: the log can't be edited. */
export default async function HistoryPage({ searchParams }: { searchParams: Promise<HistorySP> }) {
  const me = await requireRole("admin");
  const h = historyQuery(await searchParams);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_visits", { ...h.args, p_limit: 50, p_offset: (h.page - 1) * 50 });
  const res = (data ?? { total: 0, rows: [], gates: [] }) as { total: number; rows: HistoryRow[]; gates: { id: string; name: string }[] };
  const urls = await signPhotos(res.rows.map((r) => r.photo_path));
  const title = h.range === "today" ? "Visits · today" : h.multiDay ? `Visits · ${fmtDay(h.from)} – ${fmtDay(h.to)}` : `Visits · ${fmtDay(h.from)}`;
  const filtered = h.outcome !== "all" || h.kind !== "all" || h.gate || h.q;

  return (
    <AdminShell me={me} title="History" current="/admin/history">
      <section className="ma-panel" aria-labelledby="ph">
        <PanelHead id="ph" title={<>{title} <span className="ma-note ma-tabular">({res.total.toLocaleString("en-IN")})</span></>}
          actions={res.total ? <a className="ma-btn ma-btn--secondary" href={withParams("/admin/history/export", h.echo, {})} download><Icon name="download" />Export CSV</a> : null} />
        <p className="ma-note">Every decision, hold, exit and family visit is logged and can&apos;t be edited. Exports never include photos.</p>
        <FilterForm action="/admin/history" label="Filter visits">
          <div className="ma-field">
            <label className="ma-field__label" htmlFor="hq">Visitor name</label>
            <div className="ma-field__box"><span className="ma-field__icon"><Icon name="search" /></span>
              <input id="hq" name="q" type="search" defaultValue={h.q} maxLength={80} autoComplete="off" placeholder=" " /></div>
          </div>
          <FilterSelect id="hr" name="range" label="Date" value={h.range} options={RANGES} />
          {h.range === "custom" ? <>
            <div className="ma-field"><label className="ma-field__label" htmlFor="hf">From</label><div className="ma-field__box"><input id="hf" name="from" type="date" defaultValue={h.from} /></div></div>
            <div className="ma-field"><label className="ma-field__label" htmlFor="ht2">To</label><div className="ma-field__box"><input id="ht2" name="to" type="date" defaultValue={h.to} /></div></div>
          </> : null}
          <FilterSelect id="hd" name="outcome" label="Decision" value={h.outcome} options={OUTCOMES} />
          <FilterSelect id="ht" name="kind" label="Visitor type" value={h.kind} options={TYPES} />
          {res.gates.length > 1 ? <FilterSelect id="hg" name="gate" label="Gate" value={h.gate} options={[["", "All gates"], ...res.gates.map((g): [string, string] => [g.id, g.name])]} /> : null}
          <div className="ma-filters__go"><button className="ma-btn ma-btn--secondary" type="submit"><Icon name="search" />Show</button></div>
        </FilterForm>
        {error ? <Empty title="Couldn't load the history">Refresh the page. If it keeps happening, check the connection.</Empty>
          : res.rows.length ? (
          <>
            <Table label="Visit history" heads={["Time", "Visitor", "Type", "Decision", "By", "Gate", ""]}>
              {res.rows.map((r) => (
                <tr key={r.id}>
                  <td className="ma-tabular">{h.multiDay ? <>{fmtDate(r.at)}<br /></> : null}{fmtTime(r.at)}</td>
                  <td><PersonCell name={r.type === "family" ? `Family of ${r.name}` : r.name} src={urls.get(r.photo_path ?? "")} /></td>
                  <td>{r.type === "family" ? `Student family · ${r.guests}` : KIND_LABEL[r.kind]}</td>
                  <td>
                    {r.outcome === "approved" ? <Chip icon="check" text={r.held ? "Approved after hold" : "Approved"} kind="success" />
                      : r.outcome === "denied" ? <Chip icon="ban" text={r.held ? "Denied after hold" : "Denied"} kind="danger" />
                      : <Chip icon="users" text="Logged" />}
                    {r.offline ? <> <Chip icon="cloud-off" text="Recorded offline" /></> : null}
                  </td>
                  <td>{r.by_name ? `${r.by_name}${r.by_role === "admin" ? " (admin)" : ""}` : "—"}</td>
                  <td>{r.gate}</td>
                  <td style={{ textAlign: "right" }}><RowLink href={`/admin/history/${r.id}`} label="View" who={r.name} /></td>
                </tr>
              ))}
            </Table>
            <Pager page={h.page} total={res.total} href={(p) => withParams("/admin/history", h.echo, { page: p })} />
          </>
        ) : (
          <Empty title={filtered ? "No visits match these filters" : h.range === "today" ? "No visits yet today" : "No visits in these dates"}>
            {filtered ? "Change the date range or clear a filter." : <>Decisions made at the gate appear here at once. <Link className="ma-link" href="/admin/history?range=30">Last 30 days</Link></>}
          </Empty>
        )}
      </section>
    </AdminShell>
  );
}
