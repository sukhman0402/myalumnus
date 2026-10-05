import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireRole, type Profile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { asLang, LANG_COOKIE, tr, type Lang } from "@/lib/i18n";
import type { NavItem } from "@/components/Shell";
import { signPhotos } from "@/lib/photos";

export async function getLang(): Promise<Lang> {
  return asLang((await cookies()).get(LANG_COOKIE)?.value);
}

export type Duty = { me: Profile; lang: Lang; guard: { id: string; name: string; shift_label: string | null }; since: string };

/** The guard on shift at this gate device, or null when nobody has tapped their name yet. */
export async function getDuty() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("gate_duty");
  const row = (data as { guard_id: string; name: string; shift_label: string | null; started_at: string }[] | null)?.[0];
  return row ? { guard: { id: row.guard_id, name: row.name, shift_label: row.shift_label }, since: row.started_at } : null;
}

/** For every gate screen except the name picker: a gate device with a guard on shift. */
/** The pages a guard can be sent on to after tapping their name (owner, 2026-10-05: side-bar items must work). */
export const AFTER_DUTY = ["expected", "inside"] as const;
export type AfterDuty = (typeof AFTER_DUTY)[number];
export const isAfterDuty = (v: unknown): v is AfterDuty => typeof v === "string" && (AFTER_DUTY as readonly string[]).includes(v);

/** No guard on shift yet: back to the name list; `next` says which page to open once a name is tapped. */
export async function requireOnDuty(next?: AfterDuty): Promise<Duty> {
  const me = await requireRole("gate");
  const [duty, lang] = await Promise.all([getDuty(), getLang()]);
  if (!duty) redirect(next ? `/gate?next=${next}` : "/gate");
  return { me, lang, ...duty };
}

export type GateSection = "search" | "expected" | "inside";
export function gateNav(lang: Lang, current: GateSection): NavItem[] {
  return [
    { href: "/gate", label: tr(lang, "nav.search"), icon: "search", current: current === "search" },
    { href: "/gate/expected", label: tr(lang, "nav.expected"), icon: "calendar-clock", current: current === "expected" },
    { href: "/gate/inside", label: tr(lang, "nav.inside"), icon: "users", current: current === "inside" },
  ];
}

export function identity(d: Duty) {
  const shift = d.guard.shift_label ? ` · ${tr(d.lang, "duty.shift", { s: d.guard.shift_label })}` : "";
  return `${d.guard.name}${shift} · ${d.me.gate_name}`;
}

/** One photo's address (sample face, or a 5-minute signed link to the private bucket). */
export async function photoSrc(path: string | null): Promise<string | null> {
  if (!path) return null;
  return (await signPhotos([path])).get(path) ?? null;
}

export async function getToday() {
  const supabase = await createClient();
  const { data } = await supabase.rpc("gate_today");
  const row = (data as { expected: number; inside: number; flagged: number; visits: number }[] | null)?.[0];
  return row ?? null;
}

/** True for a decision made in the last 10 minutes (the confirmation banner isn't shown again later). */
export function decidedRecently(iso: string) {
  return Date.now() - new Date(iso).getTime() < 10 * 60 * 1000;
}

/** This gate's campus rules: visiting hours and the escalation hand-off minutes (readable by the gate). */
export async function getRules(gateId: string) {
  const supabase = await createClient();
  const { data: gate } = await supabase.from("gates").select("campus_id").eq("id", gateId).maybeSingle();
  if (!gate) return { open: "10:00", close: "18:00", escalate: 10 };
  const { data: r } = await supabase.from("campus_rules").select("open_time, close_time, escalate_minutes").eq("campus_id", gate.campus_id).maybeSingle();
  return { open: (r?.open_time ?? "10:00").slice(0, 5), close: (r?.close_time ?? "18:00").slice(0, 5), escalate: r?.escalate_minutes ?? 10 };
}
