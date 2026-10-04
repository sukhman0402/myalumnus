import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { addDays, isYmd, KIND_LABEL, mondayOf, ymd } from "@/lib/format";
import type { Report } from "../types";

/** The weekly review as CSV: the per-type table, then visits per day. No names, no photos. */
export async function GET(request: Request) {
  await requireRole("admin");
  const p = new URL(request.url).searchParams.get("from");
  const from = isYmd(p) ? mondayOf(p) : mondayOf(ymd());
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_report", { p_from: from, p_days: 7 });
  if (error || !data) return new Response("Couldn't export. Try again.", { status: 500 });
  const r = data as Report;
  const lines = [
    `Weekly review,${from} to ${addDays(from, 6)}`, "",
    "Visitor type,Visits,Flag & Hold,Denied,Overstays",
    ...r.by_type.map((t) => [KIND_LABEL[t.type] ?? t.type, t.visits, t.held, t.denied, t.overstays].join(",")),
    `Student family (groups),${r.family_groups},,,${r.family_overstays}`,
    `Student family (guests),${r.family_guests},,,`, "",
    "Day,Visits", ...r.by_day.map((d) => `${d.d},${d.n}`), "",
    `Median admin decision (seconds),${r.median_admin_seconds ?? ""}`, `Cases passed to host,${r.passed_to_host}`,
  ];
  return new Response("﻿" + lines.join("\r\n"), {
    headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="my-alumnus-week-${from}.csv"`, "cache-control": "no-store" },
  });
}
