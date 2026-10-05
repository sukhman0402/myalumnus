import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { signPhotos } from "@/lib/photos";
import { Icon } from "@/components/Icon";
import { AdminShell } from "../AdminShell";
import { FilterForm } from "../FilterForm";
import { Banner, Chip, Empty, FilterSelect, KindChip, Pager, PanelHead, PersonCell, RowLink, Table, withParams } from "../ui";

export const metadata: Metadata = { title: "Alumni · Admin console" };

type Row = { id: string; kind: string; full_name: string; program: string | null; batch_year: number | null; roll_no: string | null; photo_path: string | null; active: boolean };
type Res = { total: number; rows: Row[]; all: number; no_photo: number; batches: number[] };
type SP = { q?: string; kind?: string; batch?: string; status?: string; page?: string; ins?: string; upd?: string };

const KINDS: [string, string][] = [["all", "All types"], ["alumnus", "Alumni"], ["student", "Current students"], ["faculty", "Visiting faculty"], ["placement", "Placement visitors"]];

/** The records the gate searches (mockups a06, a07): alumni, current students and known visitors. */
export default async function AlumniPage({ searchParams }: { searchParams: Promise<SP> }) {
  const me = await requireRole("admin");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().slice(0, 80);
  const kind = KINDS.some(([k]) => k === sp.kind) ? sp.kind! : "all";
  const batch = /^\d{4}$/.test(sp.batch ?? "") ? Number(sp.batch) : null;
  const status = sp.status === "hidden" ? "hidden" : "active";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_people", { p_q: q, p_kind: kind, p_batch: batch, p_status: status, p_page: page });
  const res = (data ?? { total: 0, rows: [], all: 0, no_photo: 0, batches: [] }) as Res;
  const urls = await signPhotos(res.rows.map((r) => r.photo_path));
  const base = { q, kind: kind === "all" ? undefined : kind, batch: batch ? String(batch) : undefined, status: status === "active" ? undefined : status };
  const filtered = Boolean(q || kind !== "all" || batch || status !== "active");
  const ins = Number(sp.ins ?? "NaN"), upd = Number(sp.upd ?? "NaN");

  return (
    <AdminShell me={me} title="Alumni" current="/admin/alumni"
      banner={Number.isFinite(ins) && Number.isFinite(upd)
        ? <Banner kind="success" icon="check"><b>Upload saved.</b> {ins.toLocaleString("en-IN")} new {ins === 1 ? "record" : "records"}, {upd.toLocaleString("en-IN")} updated. The gate can search them now.</Banner>
        : error ? <Banner kind="danger" icon="circle-alert" alert>Couldn&apos;t load the records. Refresh the page.</Banner> : null}>
      <section className="ma-panel" aria-labelledby="ph">
        <PanelHead id="ph" title={`${res.all.toLocaleString("en-IN")} records`} actions={<>
          <Link className="ma-btn ma-btn--secondary" href="/admin/alumni/upload"><Icon name="upload" />Bulk upload</Link>
          <Link className="ma-btn ma-btn--primary" href="/admin/alumni/new"><Icon name="plus" />Add record</Link>
        </>} />
        <p className="ma-note">
          {res.no_photo ? <>{res.no_photo.toLocaleString("en-IN")} alumni and student records have no photo yet.</> : "Every alumni and student record has a photo."}
        </p>
        <FilterForm action="/admin/alumni" label="Filter records">
          <div className="ma-field">
            <label className="ma-field__label" htmlFor="aq">Search name or roll number</label>
            <div className="ma-field__box"><span className="ma-field__icon"><Icon name="search" /></span>
              <input id="aq" name="q" type="search" defaultValue={q} maxLength={80} autoComplete="off" placeholder=" " /></div>
          </div>
          <FilterSelect id="ak" name="kind" label="Type" value={kind} options={KINDS} />
          <FilterSelect id="ab" name="batch" label="Batch" value={batch ? String(batch) : ""} options={[["", "All batches"], ...res.batches.map((b): [string, string] => [String(b), String(b)])]} />
          <FilterSelect id="as" name="status" label="Status" value={status} options={[["active", "Shown at the gate"], ["hidden", "Hidden from the gate"]]} />
          <div className="ma-filters__go"><button className="ma-btn ma-btn--secondary" type="submit"><Icon name="search" />Search</button></div>
        </FilterForm>
        {res.rows.length ? (
          <>
            <Table label="Records" heads={["Name", "Roll no.", "Batch", "Programme or detail", "Type", "Photo", ""]}>
              {res.rows.map((r) => (
                <tr key={r.id}>
                  <td><PersonCell name={r.full_name} src={urls.get(r.photo_path ?? "")} /></td>
                  <td className="ma-tabular">{r.roll_no ?? "—"}</td>
                  <td className="ma-tabular">{r.batch_year ?? "—"}</td>
                  <td>{r.program ?? "—"}</td>
                  <td><KindChip kind={r.kind} /></td>
                  <td>{r.photo_path ? "On file" : <Chip icon="user" text="Missing" kind="hold" />}</td>
                  <td style={{ textAlign: "right" }}><RowLink href={`/admin/alumni/${r.id}`} label="Edit" who={r.full_name} /></td>
                </tr>
              ))}
            </Table>
            <Pager page={page} total={res.total} href={(p) => withParams("/admin/alumni", base, { page: p })} />
          </>
        ) : filtered ? (
          <Empty title={`No records match${q ? ` “${q}”` : ""}${batch ? `, batch ${batch}` : ""}`}>
            Try another spelling or clear a filter. If the person is missing, <Link className="ma-link" href="/admin/alumni/new">add a record</Link>.
          </Empty>
        ) : (
          <Empty title="No records yet">Add one, or upload a batch from a spreadsheet.</Empty>
        )}
      </section>
    </AdminShell>
  );
}

