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

// ---------- dates in campus time (admin console, slice 4) ----------
/** YYYY-MM-DD in campus time. */
export function ymd(d: Date = new Date()) {
  return d.toLocaleDateString("en-CA", { timeZone: TZ });
}
/** A campus-local date (and optional HH:MM) as an ISO instant. */
export function localIso(day: string, hhmm = "00:00") {
  return new Date(`${day}T${hhmm.slice(0, 5)}:00+05:30`).toISOString();
}
/** YYYY-MM-DD plus n days. */
export function addDays(day: string, n: number) {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** The Monday of the week that contains this date. */
export function mondayOf(day: string) {
  const dow = new Date(`${day}T00:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(day, -((dow + 6) % 7));
}
export function isYmd(s: unknown): s is string {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
}
/** "4 Oct 2026", in campus time. */
export function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" });
}
/** "Sun 4 Oct" for a YYYY-MM-DD. */
export function fmtDay(day: string) {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short" });
}
/** "2 h 18 min" / "45 min" / "4 min 40 s". */
export function fmtDuration(ms: number, withSeconds = false) {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  if (h) return `${h} h ${m} min`;
  if (withSeconds && m < 10) return s ? `${m} min ${s} s` : `${m} min`;
  return `${m} min`;
}
/** Words for a person's type in the admin console. */
export const KIND_LABEL: Record<string, string> = {
  alumnus: "Alumnus", student: "Current student", faculty: "Visiting faculty", placement: "Placement visitor",
  walkin: "Walk-in, no record", family: "Student family",
};
/** The current time, for server-rendered pages (each request renders once, so "now" is stable for that page). */
export function nowMs() {
  return Date.now();
}
/** Minutes in words for overstays: "45 min", "16 h 44 min" (Hindi: "45 मिनट", "16 घंटे 44 मिनट"). */
export function fmtMinutes(min: number, lang: Lang = "en") {
  const h = Math.floor(min / 60), m = min % 60;
  if (lang === "hi") return h ? `${h} घंटे${m ? ` ${m} मिनट` : ""}` : `${m} मिनट`;
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}
