import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireRole, type Profile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { asLang, LANG_COOKIE, tr, type Lang } from "@/lib/i18n";
import type { NavItem } from "@/components/Shell";
import { signPhotos } from "@/lib/photos";
import { fmtClock, fmtTime } from "@/lib/format";

export async function getLang(): Promise<Lang> {
  return asLang((await cookies()).get(LANG_COOKIE)?.value);
}

/** This device's display choices (guard Settings, owner 2026-10-08): text size and 12/24-hour time. Cookies, so they
 *  survive reloads; the text size is applied in the root layout. */
export const TEXT_COOKIE = "ma-text";
export const HOURS_COOKIE = "ma-hours";
export type TextSize = "default" | "large" | "larger";
export const asTextSize = (v: unknown): TextSize => (v === "large" || v === "larger" ? v : "default");

/** Time formatters bound to this device's 12/24-hour choice, for server components. */
export const timeFns = cache(async function timeFns() {
  const h24 = (await cookies()).get(HOURS_COOKIE)?.value === "24";
  return { h24, t: (iso: string) => fmtTime(iso, h24), c: (hhmm: string) => fmtClock(hhmm, h24) };
});

export type Duty = { me: Profile; lang: Lang; guard: { id: string; name: string; shift_label: string | null }; since: string };

/** The gate's post at this device. One gate, one device, no guard names (owner, 2026-10-08): the device keeps one
 *  shift open for the gate's post record, opened automatically the first time it is needed (`gate_auto_duty`), so no
 *  one taps a name and nothing ends a shift. The database still records every decision against that post, so History
 *  reads "Gate 1" rather than a person. Null only when the device can't be set up (no gate). Once per request. */
export const getDuty = cache(async function getDuty() {
  const supabase = await createClient();
  const read = async () => {
    const { data } = await supabase.rpc("gate_duty");
    return (data as { guard_id: string; name: string; shift_label: string | null; started_at: string }[] | null)?.[0];
  };
  let row = await read();
  if (!row) { await supabase.rpc("gate_auto_duty"); row = await read(); }
  return row ? { guard: { id: row.guard_id, name: row.name, shift_label: row.shift_label }, since: row.started_at } : null;
});

/** For every gate screen: a gate device whose post is open. If it can't be opened, Home explains (device not set up). */
export async function requireOnDuty(): Promise<Duty> {
  // The role check and the duty look-up run side by side (one round trip instead of two); a wrong role still redirects.
  const [me, duty, lang] = await Promise.all([requireRole("gate"), getDuty(), getLang()]);
  if (!duty) redirect("/gate");
  return { me, lang, ...duty };
}

export type GateSection = "search" | "expected" | "inside";
/** The guard console's side bar (owner, 2026-10-06: Home · Insights · Settings; the lists live on Home).
 *  The current item follows the address (components/Rail): records, holds and lists all sit under Home. */
export function gateNav(lang: Lang): NavItem[] {
  return [
    { href: "/gate", label: tr(lang, "nav.home"), icon: "house" },
    { href: "/gate/insights", label: tr(lang, "nav.insights"), icon: "chart-column" },
    { href: "/gate/settings", label: tr(lang, "nav.settings"), icon: "settings" },
  ];
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
