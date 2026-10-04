"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { isYmd, localIso, ymd } from "@/lib/format";
import { signPhotos } from "@/lib/photos";
import { fromHint, GENERIC } from "../errors";

export type FormState = { error?: string; fields?: Record<string, string>; values?: Record<string, string> };
export type PersonHit = { id: string; full_name: string; kind: string; program: string | null; batch_year: number | null; photo: string | null };

/** Existing records to pick from while typing a visitor's name (not students). */
export async function lookupPeople(q: string): Promise<PersonHit[]> {
  await requireRole("admin");
  const query = z.string().trim().max(80).safeParse(q);
  if (!query.success || query.data.length < 3) return [];
  const supabase = await createClient();
  const { data } = await supabase.rpc("admin_lookup_people", { p_q: query.data });
  const rows = (data ?? []) as (Omit<PersonHit, "photo"> & { photo_path: string | null })[];
  const urls = await signPhotos(rows.map((r) => r.photo_path));
  return rows.map(({ photo_path, ...r }) => ({ ...r, photo: urls.get(photo_path ?? "") ?? null }));
}

/** Add an expected visitor (mockup a19). Guards see them under "Expected today" on the day. */
export async function addExpected(_prev: FormState, form: FormData): Promise<FormState> {
  await requireRole("admin");
  const raw = Object.fromEntries(["person", "person_label", "name", "kind", "program", "date", "time", "gate", "host", "host_phone", "purpose"]
    .map((k) => [k, String(form.get(k) ?? "").trim()]));
  const fields: Record<string, string> = {};
  const person = z.uuid().safeParse(raw.person);
  if (!person.success) {
    if (!raw.name) fields.name = "Enter the visitor's full name, or pick an existing record.";
    if (!["alumnus", "faculty", "placement"].includes(raw.kind)) fields.kind = "Pick a type.";
  }
  if (!isYmd(raw.date)) fields.date = "Pick a date.";
  else if (raw.date < ymd()) fields.date = "Pick today or a later date.";
  if (!/^\d{2}:\d{2}$/.test(raw.time)) fields.time = "Enter the expected time, e.g. 10:30 AM.";
  if (!raw.host) fields.host = "Enter who they are visiting: the guard calls this person if needed.";
  if (raw.host_phone && !/^[+0-9 ()-]{7,24}$/.test(raw.host_phone)) fields.host_phone = "Check the number: digits, spaces, brackets, - and + only.";
  if (Object.keys(fields).length) return { fields, values: raw };
  const gate = z.uuid().safeParse(raw.gate);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_add_expected", {
    p_person: person.success ? person.data : null, p_name: raw.name || null, p_kind: raw.kind || null, p_program: raw.program || null,
    p_at: localIso(raw.date, raw.time), p_gate: gate.success ? gate.data : null, p_purpose: raw.purpose || null,
    p_host: raw.host, p_host_phone: raw.host_phone || null,
  });
  if (error) return { ...fromHint(error), values: raw };
  revalidatePath("/admin/visitors");
  redirect(`/admin/visitors?tab=${raw.date === ymd() ? "today" : "upcoming"}&added=1`);
}

/** Remove an expected visit (the visitor's record stays). */
export async function cancelExpected(form: FormData) {
  await requireRole("admin");
  const id = z.uuid().safeParse(form.get("id"));
  const tab = String(form.get("tab") ?? "today");
  if (!id.success) throw new Error(GENERIC);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_cancel_expected", { p_id: id.data });
  if (error && error.hint !== "not_found") throw new Error(GENERIC);
  revalidatePath("/admin/visitors");
  redirect(`/admin/visitors?tab=${tab === "upcoming" ? "upcoming" : "today"}&cancelled=1`);
}
