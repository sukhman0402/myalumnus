"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { fromHint, GENERIC } from "../errors";

export type FormState = { error?: string; fields?: Record<string, string>; values?: Record<string, string> };

/** Add or edit a guard, gate device or admin (mockup a13). */
export async function saveStaff(_prev: FormState, form: FormData): Promise<FormState> {
  await requireRole("admin");
  const raw = Object.fromEntries(["id", "role", "name", "email", "gate", "shift"].map((k) => [k, String(form.get(k) ?? "").trim()]));
  const fields: Record<string, string> = {};
  if (!["guard", "gate", "admin"].includes(raw.role)) fields.role = "Pick what this account is for.";
  if (!raw.name) fields.name = raw.role === "gate" ? "Name the device, e.g. Gate 1 iPad." : "Enter the person's name as the guards know it.";
  if (raw.role !== "guard" && !z.email().safeParse(raw.email).success) fields.email = raw.email ? "Check the email address, e.g. name@university.edu." : "Enter an email address: this account signs in with a code sent there.";
  if (raw.role !== "admin" && !z.uuid().safeParse(raw.gate).success) fields.gate = "Pick a gate.";
  if (Object.keys(fields).length) return { fields, values: raw };
  const id = z.uuid().safeParse(raw.id);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_save_staff", {
    p_id: id.success ? id.data : null, p_role: raw.role, p_name: raw.name, p_email: raw.role === "guard" ? null : raw.email,
    p_gate: raw.role === "admin" ? null : raw.gate, p_shift: raw.role === "guard" ? raw.shift || null : null,
  });
  if (error) return { ...fromHint(error), values: raw };
  revalidatePath("/admin/security");
  redirect(`/admin/security?saved=${data as string}`);
}

/** Deactivate (signed out of the console at once; history kept) or reactivate. */
export async function setStaffActive(form: FormData) {
  await requireRole("admin");
  const id = z.uuid().safeParse(form.get("id"));
  const active = form.get("active") === "1";
  if (!id.success) throw new Error(GENERIC);
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_staff_active", { p_id: id.data, p_active: active });
  if (error) redirect(`/admin/security/${id.data}?error=${encodeURIComponent(error.hint ?? "generic")}`);
  revalidatePath("/admin/security");
  redirect(`/admin/security?${active ? "reactivated" : "deactivated"}=${id.data}`);
}
