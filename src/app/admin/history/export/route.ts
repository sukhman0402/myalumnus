import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtTime, KIND_LABEL } from "@/lib/format";
import { historyQuery, type HistoryRow } from "../query";

// A spreadsheet cell that starts with = + - @ could run as a formula when opened; prefix those with '.
const cell = (v: unknown) => {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** History as CSV, same filters as the page, up to 10,000 rows. Never photos (decided). */
export async function GET(request: Request) {
  await requireRole("admin");
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const h = historyQuery(sp);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_visits", { ...h.args, p_limit: 10000, p_offset: 0 });
  if (error) return new Response("Couldn't export. Try again.", { status: 500 });
  const { rows, total } = data as { rows: HistoryRow[]; total: number };
  const head = ["Date", "Time", "Visitor", "Type", "Programme", "Batch", "Decision", "After on hold", "Recorded offline", "Decided by",
    "Role", "Gate", "Purpose", "Reason", "Entered", "Exited", "Family guests"];
  const lines = rows.map((r) => [
    fmtDate(r.at), fmtTime(r.at), r.name, r.type === "family" ? "Student family" : KIND_LABEL[r.kind], r.program, r.batch_year,
    r.outcome, r.held ? "yes" : "no", r.offline ? "yes" : "no", r.by_role === "admin" ? r.by_name : r.by_role ? r.gate : "", r.by_role === "admin" ? "admin" : r.by_role ? "gate" : "",
    r.gate, r.purpose, r.reason, r.entered_at ? fmtTime(r.entered_at) : "", r.exited_at ? fmtTime(r.exited_at) : "", r.guests,
  ].map(cell).join(","));
  const note = total > rows.length
    ? [cell(`Note: only the newest ${rows.length.toLocaleString("en-IN")} of ${total.toLocaleString("en-IN")} visits are in this file. Export a shorter date range for the rest.`)]
    : [];
  const body = "\uFEFF" + [head.join(","), ...lines, ...note].join("\r\n");
  return new Response(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="my-alumnus-visits-${h.from}-to-${h.to}.csv"`,
      "cache-control": "no-store",
    },
  });
}
