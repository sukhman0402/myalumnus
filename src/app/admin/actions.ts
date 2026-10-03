"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export type AdminFormState = { error?: string; field?: string; values?: Record<string, string> };

/** An admin decides a held case. decide_case() makes the first decision win and records the visit. */
export async function decideHeldCase(_prev: AdminFormState, form: FormData): Promise<AdminFormState> {
  await requireRole("admin");
  const id = z.uuid().safeParse(form.get("case"));
  const approve = form.get("approve") === "1";
  const note = String(form.get("note") ?? "").trim().slice(0, 300);
  const values = { note };
  if (!id.success) return { error: "Couldn't save. Refresh the page and try again.", values };
  if (!approve && !note) return { error: "Add a note before denying: it's what the guard tells the visitor.", field: "note", values };
  const supabase = await createClient();
  const { error } = await supabase.rpc("decide_case", { p_case: id.data, p_approve: approve, p_note: note || null });
  if (error) {
    const msg = error.hint === "already_inside"
      ? "This person is already recorded inside. Check with the gate before approving again."
      : error.hint === "reason_required" ? "Add a note before denying." : "Couldn't save. Check the connection and try again. Nothing was recorded.";
    return { error: msg, field: error.hint === "reason_required" ? "note" : undefined, values };
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/case/${id.data}`);
}
