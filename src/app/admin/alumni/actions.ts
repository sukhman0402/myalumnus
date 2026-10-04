"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { fromHint, GENERIC } from "../errors";

export type FormState = { error?: string; fields?: Record<string, string>; values?: Record<string, string> };

const KINDS = ["alumnus", "student", "faculty", "placement"] as const;
const PHONE = /^[+0-9 ()-]{7,24}$/;

/** Add or edit one record (mockups a08, a09). Checked here for quick feedback, and again by admin_save_person(). */
export async function savePerson(_prev: FormState, form: FormData): Promise<FormState> {
  await requireRole("admin");
  const raw = Object.fromEntries(["id", "kind", "name", "roll", "batch", "program", "phone", "email"]
    .map((k) => [k, String(form.get(k) ?? "").trim()]));
  raw.active = form.get("active") === "on" ? "on" : "";
  const fields: Record<string, string> = {};
  if (!raw.name) fields.name = "Enter the full name, as on university records.";
  if (!KINDS.includes(raw.kind as (typeof KINDS)[number])) fields.kind = "Pick a type.";
  if (raw.batch && !/^\d{4}$/.test(raw.batch)) fields.batch = "Enter a 4-digit year, e.g. 2019.";
  else if (raw.kind === "alumnus" && !raw.batch) fields.batch = "Alumni need a batch (graduation year), e.g. 2019.";
  if (raw.kind === "student" && !raw.roll) fields.roll = "Current students need a roll number: the gate finds them by it.";
  if (raw.phone && !PHONE.test(raw.phone)) fields.phone = "Check the number: digits, spaces, brackets, - and + only.";
  if (raw.email && !z.email().safeParse(raw.email).success) fields.email = "Check the email address, e.g. name@example.com.";
  if (Object.keys(fields).length) return { fields, values: raw };

  const id = z.uuid().safeParse(raw.id);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_save_person", {
    p_id: id.success ? id.data : null, p_kind: raw.kind, p_name: raw.name, p_program: raw.program || null,
    p_batch: raw.batch ? Number(raw.batch) : null, p_roll: raw.roll || null, p_phone: raw.phone || null,
    p_email: raw.email || null, p_active: raw.active === "on",
  });
  if (error) return { ...fromHint(error), values: raw };
  revalidatePath("/admin/alumni");
  redirect(`/admin/alumni/${data as string}?saved=1`);
}

export type PhotoResult = { ok: true } | { ok: false; error: string };

/**
 * Store a record's photo. The browser has already cropped it to 3:4 and resized it to 480 × 640 JPEG
 * (planning/02 D8), so it is small. The previous photo file is deleted once the record points at the new one.
 */
export async function uploadPhoto(personId: string, form: FormData): Promise<PhotoResult> {
  const me = await requireRole("admin");
  const id = z.uuid().safeParse(personId);
  const file = form.get("photo");
  if (!id.success || !(file instanceof File)) return { ok: false, error: GENERIC };
  const bytes = new Uint8Array(await file.arrayBuffer());
  const isJpeg = bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (!isJpeg || bytes.length > 900_000) return { ok: false, error: "That file isn't a photo the console can use. Choose a JPEG, PNG or WebP image." };

  const supabase = await createClient();
  const path = `${me.university_id}/${id.data}-${Date.now()}.jpg`;
  const up = await supabase.storage.from("photos").upload(path, bytes, { contentType: "image/jpeg", upsert: false });
  if (up.error) return { ok: false, error: "Couldn't upload the photo. Check the connection and try again." };
  const { data: old, error } = await supabase.rpc("admin_set_photo", { p_person: id.data, p_path: path });
  if (error) {
    await supabase.storage.from("photos").remove([path]);
    return { ok: false, error: fromHint(error).error ?? GENERIC };
  }
  if (old) await supabase.storage.from("photos").remove([old as string]);
  revalidatePath("/admin/alumni");
  return { ok: true };
}

export async function removePhoto(personId: string): Promise<PhotoResult> {
  await requireRole("admin");
  const id = z.uuid().safeParse(personId);
  if (!id.success) return { ok: false, error: GENERIC };
  const supabase = await createClient();
  const { data: old, error } = await supabase.rpc("admin_set_photo", { p_person: id.data, p_path: null });
  if (error) return { ok: false, error: fromHint(error).error ?? GENERIC };
  if (old) await supabase.storage.from("photos").remove([old as string]);
  revalidatePath("/admin/alumni");
  return { ok: true };
}

// ---------- bulk upload (Q9) ----------
export type Existing = { roll_no: string; id: string; kind: string; full_name: string; has_photo: boolean };

/** Which roll numbers in the file already have records (shown as "update" in the preview). */
export async function rollLookup(rolls: string[]): Promise<{ ok: true; rows: Existing[] } | { ok: false }> {
  await requireRole("admin");
  const list = z.array(z.string().trim().min(1).max(40)).max(5000).safeParse(rolls);
  if (!list.success) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_roll_lookup", { p_rolls: list.data });
  if (error) return { ok: false };
  return { ok: true, rows: ((data ?? []) as (Omit<Existing, "has_photo"> & { photo_path: string | null })[])
    .map(({ photo_path, ...r }) => ({ ...r, has_photo: Boolean(photo_path) })) };
}

const Row = z.object({
  full_name: z.string().trim().min(1).max(120), roll_no: z.string().trim().min(1).max(40), program: z.string().trim().min(1).max(120),
  batch_year: z.string().regex(/^\d{4}$/), email: z.string().max(200).optional(), phone: z.string().max(30).optional(),
});

/** Save up to 1,000 rows. The browser sends a file in chunks; each chunk saves completely or not at all. */
export async function bulkSave(kind: string, rows: unknown): Promise<{ ok: true; inserted: number; updated: number } | { ok: false; error: string }> {
  await requireRole("admin");
  const parsed = z.array(Row).min(1).max(1000).safeParse(rows);
  if (!parsed.success || (kind !== "alumnus" && kind !== "student")) return { ok: false, error: GENERIC };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_bulk_people", { p_kind: kind, p_rows: parsed.data });
  if (error) return { ok: false, error: error.hint === "row_invalid" ? `Not saved: ${error.message}.` : (fromHint(error).error ?? GENERIC) };
  revalidatePath("/admin/alumni");
  const r = data as { inserted: number; updated: number };
  return { ok: true, inserted: r.inserted, updated: r.updated };
}
