// Formatting shared by server pages and client components (no server-only imports here).
import { tr, type Lang, type TKey } from "@/lib/i18n";

export const TZ = "Asia/Kolkata"; // the sample university's timezone (universities.timezone)

/** 11:42 AM, in the university's timezone. */
export function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();
}
/** "10:00" (from campus_rules) to "10:00 AM". */
export function fmtClock(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; // as in the mockups: "6:00 PM"
}
/** "Jun 2019" (Hindi: "जून 2019") */
export function fmtMonth(date: string, lang: Lang = "en") {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { timeZone: "UTC", month: "short", year: "numeric" });
}

export type Kind = "alumnus" | "faculty" | "placement" | "student";
/** "Alumnus · B.Tech Mechanical · Batch 2019". Faculty and placement visitors: kind plus any detail. */
export function personMeta(lang: Lang, p: { kind: Kind; program: string | null; batch_year: number | null }) {
  const kind = tr(lang, `kind.${p.kind}` as TKey);
  if (p.kind !== "alumnus") {
    // The sample data repeats the kind in the program ("Placement visitor · TechNova"): show it once.
    const extra = (p.program ?? "").replace(/^(Visiting faculty|Placement visitor)( · )?/, "");
    return extra ? `${kind} · ${extra}` : kind;
  }
  return [kind, p.program, p.batch_year ? tr(lang, "batch", { y: p.batch_year }) : null].filter(Boolean).join(" · ");
}

/** The fictional sample people use drawn SAMPLE faces shipped with the app (public/sample-photos). */
export function samplePhoto(path: string | null): string | null {
  const m = path ? /^sample\/([a-z0-9]+)\.webp$/.exec(path) : null;
  return m ? `/sample-photos/${m[1]}.svg` : null;
}

/** Start of today in the university's timezone, as an ISO instant (for "today" filters). */
export function dayStartIso(now: Date = new Date()) {
  const ymd = now.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD
  return new Date(`${ymd}T00:00:00+05:30`).toISOString();
}
/** Minutes past visiting-hours close on the day the visit started (0 if not yet). Q4 overstay rule. */
export function overMinutes(enteredIso: string, closeHHMM: string, now: Date = new Date()) {
  const ymd = new Date(enteredIso).toLocaleDateString("en-CA", { timeZone: TZ });
  const close = new Date(`${ymd}T${closeHHMM.slice(0, 5)}:00+05:30`).getTime();
  return Math.max(0, Math.floor((now.getTime() - close) / 60000));
}
