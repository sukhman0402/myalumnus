"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

/** A guard taps their name: close any open shift on this device, then open theirs (planning/02 Q1). */
export async function startShift(form: FormData) {
  const me = await requireRole("gate");
  const guardId = z.uuid().parse(form.get("guard_id"));
  const supabase = await createClient();

  // The guard must belong to this gate (row-level security already limits reads to this university).
  const { data: guard } = await supabase.from("staff").select("id").eq("id", guardId).eq("role", "guard").eq("gate_id", me.gate_id!).eq("active", true).maybeSingle();
  if (!guard) throw new Error("That guard isn't on this gate's list.");

  await supabase.from("shifts").update({ ended_at: new Date().toISOString() }).eq("device_id", me.staff_id).is("ended_at", null);
  const { error } = await supabase.from("shifts").insert({ university_id: me.university_id, gate_id: me.gate_id, device_id: me.staff_id, guard_id: guardId });
  if (error) throw new Error("Couldn't start the shift. Try again.");
  revalidatePath("/gate");
}

/** "Change guard": ends the current shift so the next guard can tap their name. */
export async function endShift() {
  const me = await requireRole("gate");
  const supabase = await createClient();
  await supabase.from("shifts").update({ ended_at: new Date().toISOString() }).eq("device_id", me.staff_id).is("ended_at", null);
  revalidatePath("/gate");
}
