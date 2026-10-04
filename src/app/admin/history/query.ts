import { addDays, isYmd, localIso, ymd } from "@/lib/format";

export type HistorySP = { range?: string; from?: string; to?: string; outcome?: string; kind?: string; gate?: string; q?: string; page?: string };
export type HistoryRow = {
  type: "visit" | "family"; id: string; at: string; name: string; kind: string; program: string | null; batch_year: number | null;
  photo_path: string | null; outcome: "approved" | "denied" | "logged"; held: boolean; gate: string; reason: string | null;
  purpose: string | null; entered_at: string | null; exited_at: string | null; guests: number | null; by_name: string | null;
  by_role: string | null; offline: boolean;
};

export const RANGES: [string, string][] = [["today", "Today"], ["7", "Last 7 days"], ["30", "Last 30 days"], ["90", "Last 90 days"], ["custom", "Custom dates"]];
export const OUTCOMES: [string, string][] = [["all", "All decisions"], ["approved", "Approved"], ["denied", "Denied"], ["held", "Flag & Hold"]];
export const TYPES: [string, string][] = [["all", "All visitors"], ["alumnus", "Alumni"], ["faculty", "Visiting faculty"], ["placement", "Placement visitors"],
  ["walkin", "Walk-ins, no record"], ["family", "Student families"]];

/** Turn the page's search parameters into the database call's arguments (and a tidy echo for links). */
export function historyQuery(sp: HistorySP) {
  const today = ymd();
  const range = RANGES.some(([r]) => r === sp.range) ? sp.range! : "today";
  let from = today, to = today;
  if (range === "custom") {
    from = isYmd(sp.from) ? sp.from : today;
    to = isYmd(sp.to) ? sp.to : today;
    if (to < from) [from, to] = [to, from];
  } else if (range !== "today") from = addDays(today, -(Number(range) - 1));
  const outcome = OUTCOMES.some(([o]) => o === sp.outcome) ? sp.outcome! : "all";
  const kind = TYPES.some(([k]) => k === sp.kind) ? sp.kind! : "all";
  const gate = /^[0-9a-f-]{36}$/i.test(sp.gate ?? "") ? sp.gate! : "";
  const q = (sp.q ?? "").trim().slice(0, 80);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  return {
    range, from, to, outcome, kind, gate, q, page, multiDay: from !== to,
    args: { p_from: localIso(from), p_to: localIso(addDays(to, 1)), p_outcome: outcome, p_kind: kind, p_gate: gate || null, p_q: q },
    echo: { range: range === "today" ? undefined : range, from: range === "custom" ? from : undefined, to: range === "custom" ? to : undefined,
      outcome: outcome === "all" ? undefined : outcome, kind: kind === "all" ? undefined : kind, gate: gate || undefined, q: q || undefined },
  };
}
