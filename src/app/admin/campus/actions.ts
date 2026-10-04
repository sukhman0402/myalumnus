"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { fromHint } from "../errors";

export type FormState = { error?: string; fields?: Record<string, string>; values?: Record<string, string> };

/** The two campus rules (mockups a15, a16): visiting hours and the escalation time. */
export async function saveRules(_prev: FormState, form: FormData): Promise<FormState> {
  await requireRole("admin");
  const raw = Object.fromEntries(["campus", "open", "close", "minutes"].map((k) => [k, String(form.get(k) ?? "").trim()]));
  const fields: Record<string, string> = {};
  const hhmm = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!hhmm.test(raw.open)) fields.open = "Enter a time, e.g. 10:00 AM.";
  if (!hhmm.test(raw.close)) fields.close = "Enter a time, e.g. 06:00 PM.";
  else if (!fields.open && raw.close <= raw.open) fields.close = "Visiting hours must end after they start, on the same day.";
  if (!/^\d{1,2}$/.test(raw.minutes) || +raw.minutes < 1 || +raw.minutes > 60) fields.minutes = "Enter a whole number of minutes from 1 to 60.";
  if (Object.keys(fields).length) return { fields, values: raw };
  const campus = z.uuid().safeParse(raw.campus);
  if (!campus.success) return { error: "Refresh the page and try again.", values: raw };
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_save_rules", { p_campus: campus.data, p_open: raw.open, p_close: raw.close, p_minutes: Number(raw.minutes) });
  if (error) return { ...fromHint(error), values: raw };
  revalidatePath("/admin", "layout");
  revalidatePath("/gate", "layout");
  redirect(`/admin/campus?saved=${Date.now()}`);
}
