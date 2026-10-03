"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { asLang, LANG_COOKIE, tr, type TKey } from "@/lib/i18n";
import { getLang } from "@/lib/gate";
import { samplePhoto } from "@/lib/format";

/** A guard taps their name: the database ends any open shift on this device and opens theirs (planning/02 Q1). */
export async function startShift(form: FormData) {
  await requireRole("gate");
  const guardId = z.uuid().parse(form.get("guard_id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("gate_start_shift", { p_guard: guardId });
  if (error) throw new Error("Couldn't start the shift. Try again.");
  revalidatePath("/gate");
}

/** "Change guard": ends the current shift so the next guard can tap their name. */
export async function endShift() {
  await requireRole("gate");
  const supabase = await createClient();
  await supabase.rpc("gate_end_shift");
  revalidatePath("/gate");
}

/** English ⇄ Hindi for this device (a cookie, so it survives reloads and guard changes). */
export async function setLang(form: FormData) {
  await requireRole("gate");
  const lang = asLang(String(form.get("lang") ?? ""));
  (await cookies()).set(LANG_COOKIE, lang, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax", secure: true, httpOnly: true });
  revalidatePath("/gate", "layout");
}

export type SearchHit = {
  id: string; full_name: string; kind: "alumnus" | "faculty" | "placement" | "student";
  program: string | null; batch_year: number | null; has_photo: boolean; expected_at: string | null;
  photo: string | null; // thumbnail address (sample faces only for now; real photos arrive with slice 4)
};

/** Live search as the guard types (planning/02 D10). The database applies the 3-letter rule and the gate checks. */
export async function searchPeople(q: string): Promise<{ ok: true; hits: SearchHit[] } | { ok: false }> {
  await requireRole("gate");
  const query = z.string().trim().max(80).safeParse(q);
  if (!query.success || query.data.length < 3) return { ok: true, hits: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gate_search", { p_q: query.data });
  if (error) return { ok: false };
  const hits = (data ?? []) as Omit<SearchHit, "photo">[];
  const withPhoto = hits.filter((h) => h.has_photo).map((h) => h.id);
  const paths = new Map<string, string | null>();
  if (withPhoto.length) {
    const { data: rows } = await supabase.rpc("gate_photos", { p_ids: withPhoto });
    (rows as { id: string; photo_path: string | null }[] | null)?.forEach((r) => paths.set(r.id, r.photo_path));
  }
  return { ok: true, hits: hits.map((h) => ({ ...h, photo: samplePhoto(paths.get(h.id) ?? null) })) };
}

export type DecideState = { error?: string; field?: string };

const Decision = z.object({
  person: z.uuid(),
  client: z.uuid(),
  purpose: z.string().trim().max(200).optional().default(""),
  reason: z.string().trim().max(300).optional().default(""),
});

const KNOWN = new Set(["no_shift", "outside_hours", "already_inside", "not_found", "reason_required"]);

async function decide(approve: boolean, form: FormData): Promise<DecideState> {
  await requireRole("gate");
  const lang = await getLang();
  const parsed = Decision.safeParse({
    person: form.get("person"), client: form.get("client"),
    purpose: form.get("purpose") ?? "", reason: form.get("reason") ?? "",
  });
  if (!parsed.success) return { error: tr(lang, "err.generic") };
  const d = parsed.data;
  if (!approve && !d.reason) return { error: tr(lang, "deny.err"), field: "reason" };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gate_decide", {
    p_person: d.person, p_approve: approve, p_purpose: d.purpose || null,
    p_reason: approve ? null : d.reason, p_client: d.client,
  });
  if (error) {
    const hint = error.hint && KNOWN.has(error.hint) ? error.hint : null;
    if (hint === "reason_required") return { error: tr(lang, "deny.err"), field: "reason" };
    return { error: tr(lang, (hint ? `err.${hint}` : "err.generic") as TKey) };
  }
  const visit = data as { id: string };
  revalidatePath("/gate");
  redirect(`/gate?done=${visit.id}`);
}

export async function approveVisit(_prev: DecideState, form: FormData) { return decide(true, form); }
export async function denyVisit(_prev: DecideState, form: FormData) { return decide(false, form); }

// ---------------------------------------------------------------------------------------------------------
// Slices 2–3: Flag & Hold, deciding at the host stage, exits, family visits. Every write goes through a
// gate_* database function that checks this gate, its guard on shift and the university.

const HINTS = new Set(["no_shift", "outside_hours", "already_inside", "not_found", "reason_required", "name_required",
  "host_required", "student_required", "not_allowed"]);
async function errorText(hint: string | undefined) {
  const lang = await getLang();
  return tr(lang, (hint && HINTS.has(hint) ? `err.${hint}` : "err.generic") as TKey);
}

// values: what was typed, so a form shows it again after an error (React resets a form after its action runs).
export type FormState = { error?: string; fields?: Record<string, string>; values?: Record<string, string> };

/** The reason labels are stored in English, so the admin console reads the same words whatever the guard's language. */
const WHY_EN = ["Name not found", "Photo doesn't match", "No photo, details don't match", "Outside visiting hours", "Something else"];

const Phone = z.string().trim().max(24).regex(/^$|^[+0-9 ()-]{7,24}$/);
const Hold = z.object({
  client: z.uuid(),
  person: z.union([z.uuid(), z.literal("")]),
  name: z.string().trim().max(120),
  says: z.string().trim().max(160),
  why: z.coerce.number().int().min(1).max(5),
  purpose: z.string().trim().max(200),
  host: z.string().trim().max(120),
  host_phone: Phone,
  visitor_phone: Phone,
});

export async function holdVisitor(_prev: FormState, form: FormData): Promise<FormState> {
  await requireRole("gate");
  const lang = await getLang();
  const raw = Object.fromEntries(["client", "person", "name", "says", "why", "purpose", "host", "host_phone", "visitor_phone"]
    .map((k) => [k, String(form.get(k) ?? "")]));
  const fields: Record<string, string> = {};
  if (!raw.name.trim()) fields.name = tr(lang, "fh.err.name");
  if (!raw.host.trim()) fields.host = tr(lang, "fh.err.host");
  if (!Phone.safeParse(raw.host_phone).success) fields.host_phone = tr(lang, "fh.err.phone");
  if (!Phone.safeParse(raw.visitor_phone).success) fields.visitor_phone = tr(lang, "fh.err.phone");
  if (Object.keys(fields).length) return { fields, values: raw };
  const parsed = Hold.safeParse(raw);
  if (!parsed.success) return { error: tr(lang, "err.generic"), values: raw };
  const h = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gate_hold", {
    p_person: h.person || null, p_name: h.name, p_says: h.says || null, p_reason: WHY_EN[h.why - 1],
    p_purpose: h.purpose || null, p_host: h.host, p_host_phone: h.host_phone || null,
    p_visitor_phone: h.visitor_phone || null, p_client: h.client,
  });
  if (error) return { error: await errorText(error.hint), values: raw };
  revalidatePath("/gate", "layout");
  redirect(`/gate/case/${(data as { id: string }).id}`);
}

/** The guard decides a held case once it has passed to the host (after the call). */
export async function decideCase(_prev: FormState, form: FormData): Promise<FormState> {
  await requireRole("gate");
  const lang = await getLang();
  const id = z.uuid().safeParse(form.get("case"));
  const approve = form.get("approve") === "1";
  const note = z.string().trim().max(300).safeParse(String(form.get("reason") ?? ""));
  if (!id.success || !note.success) return { error: tr(lang, "err.generic") };
  if (!approve && !note.data) return { fields: { reason: tr(lang, "deny.err") } };
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_case", { p_case: id.data, p_approve: approve, p_note: note.data || null });
  if (error) {
    if (error.hint === "reason_required") return { fields: { reason: tr(lang, "deny.err") } };
    return { error: await errorText(error.hint) };
  }
  revalidatePath("/gate", "layout");
  redirect(`/gate/case/${id.data}`);
}

/** Mark exit (a visit) or close a family visit. Repeating it changes nothing. */
export async function markExit(_prev: FormState, form: FormData): Promise<FormState> {
  await requireRole("gate");
  const id = z.uuid().safeParse(form.get("id"));
  const family = form.get("kind") === "family";
  if (!id.success) return { error: await errorText(undefined) };
  const supabase = await createClient();
  const { error } = family
    ? await supabase.rpc("gate_family_close", { p_id: id.data })
    : await supabase.rpc("gate_exit", { p_visit: id.data });
  if (error) return { error: await errorText(error.hint) };
  revalidatePath("/gate", "layout");
  redirect(`/gate/inside?${family ? "closed" : "exited"}=${id.data}`);
}

export type StudentHit = { id: string; full_name: string; program: string | null; roll_no: string | null; photo: string | null };

export async function searchStudents(q: string): Promise<{ ok: true; hits: StudentHit[] } | { ok: false }> {
  await requireRole("gate");
  const query = z.string().trim().max(80).safeParse(q);
  if (!query.success || query.data.length < 3) return { ok: true, hits: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gate_students", { p_q: query.data });
  if (error) return { ok: false };
  return { ok: true, hits: ((data ?? []) as (Omit<StudentHit, "photo"> & { photo_path: string | null })[])
    .map(({ photo_path, ...s }) => ({ ...s, photo: samplePhoto(photo_path) })) };
}

export async function logFamily(_prev: FormState, form: FormData): Promise<FormState> {
  await requireRole("gate");
  const parsed = z.object({
    student: z.uuid(), client: z.uuid(), guests: z.coerce.number().int().min(1).max(20), purpose: z.string().trim().max(200),
  }).safeParse({ student: form.get("student"), client: form.get("client"), guests: form.get("guests"), purpose: form.get("purpose") ?? "" });
  if (!parsed.success) return { error: await errorText(undefined) };
  const f = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gate_family_log", { p_student: f.student, p_guests: f.guests, p_purpose: f.purpose || null, p_client: f.client });
  if (error) return { error: await errorText(error.hint) };
  revalidatePath("/gate", "layout");
  redirect(`/gate?family=${(data as { id: string }).id}`);
}
