"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DEMO_MODE, DEMO_PROFILES } from "@/lib/demo";

export type DemoState = { error?: string };

const ACCOUNTS = {
  guard: { email: "guard.demo@example.com", passwordEnv: "DEMO_GUARD_PASSWORD" },
  admin: { email: "admin.demo@example.com", passwordEnv: "DEMO_ADMIN_PASSWORD" },
} as const;

/**
 * Demo sign-in: whatever the viewer typed in the User ID and Password boxes never reaches the server (those
 * inputs have no name). Only the chosen profile does. The guard profile also starts P. Singh's shift, so the
 * viewer lands on Search.
 */
export async function demoSignIn(_prev: DemoState, form: FormData): Promise<DemoState> {
  if (!DEMO_MODE) return { error: "The demo is switched off." };
  const role = form.get("role");
  if (role !== "guard" && role !== "admin") return { error: "Choose Guard or Admin." };
  const account = ACCOUNTS[role];
  const password = process.env[account.passwordEnv];
  if (!password) return { error: "The demo isn't ready yet. Try again later." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: account.email, password });
  if (error) return { error: "Couldn't open the demo. Try again in a moment." };

  if (role === "guard") {
    const { data: duty } = await supabase.rpc("gate_duty");
    if (!(duty as unknown[] | null)?.length) {
      const { data } = await supabase.rpc("gate_guards");
      const guards = (data ?? []) as { id: string; name: string }[];
      const guard = guards.find((g) => g.name === DEMO_PROFILES.guard.name) ?? guards[0];
      if (guard) await supabase.rpc("gate_start_shift", { p_guard: guard.id });
    }
    redirect("/gate");
  }
  redirect("/admin");
}
