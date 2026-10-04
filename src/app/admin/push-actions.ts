"use server";

import { z } from "zod";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { alertMe, pushConfigured } from "@/lib/push";

const Sub = z.object({ endpoint: z.url().startsWith("https://").max(1000), keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }) });

/** This browser starts receiving alerts for held visitors. */
export async function savePushSubscription(sub: unknown): Promise<{ ok: boolean }> {
  await requireRole("admin");
  const s = Sub.safeParse(sub);
  if (!s.success) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_push_subscription", { p_endpoint: s.data.endpoint, p_p256dh: s.data.keys.p256dh, p_auth: s.data.keys.auth });
  return { ok: !error };
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  await requireRole("admin");
  if (typeof endpoint !== "string" || endpoint.length > 1000) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_push_subscription", { p_endpoint: endpoint });
  return { ok: !error };
}

export async function sendTestPush(): Promise<{ sent: number; configured: boolean }> {
  await requireRole("admin");
  if (!pushConfigured) return { sent: 0, configured: false };
  const sent = await alertMe({ title: "My Alumnus: test alert", body: "Alerts are on. A visitor held at a gate will appear like this.", url: "/admin", tag: "ma-test" });
  return { sent, configured: true };
}
