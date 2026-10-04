import "server-only";
import webpush from "web-push";
import { createClient } from "@/lib/supabase/server";

// Web push to admin browsers (planning/02 D13, Q2). The VAPID private key lives only in the hosting settings
// (Vercel environment variables); the public key is shared with browsers when they subscribe.
const PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const PRIVATE = process.env.VAPID_PRIVATE_KEY;
const SUBJECT = process.env.VAPID_SUBJECT || "https://myalumnus.vercel.app";

export const pushConfigured = Boolean(PUBLIC && PRIVATE);

export type Alert = { title: string; body: string; url: string; tag: string; requireInteraction?: boolean };
type Target = { endpoint: string; p256dh: string; auth: string };

async function send(targets: Target[], alert: Alert) {
  if (!pushConfigured || !targets.length) return { sent: 0, gone: [] as string[] };
  const payload = JSON.stringify(alert);
  const gone: string[] = [];
  let sent = 0;
  await Promise.all(targets.map(async (t) => {
    try {
      await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload,
        { vapidDetails: { subject: SUBJECT, publicKey: PUBLIC!, privateKey: PRIVATE! }, TTL: 600, urgency: "high", timeout: 5000 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) gone.push(t.endpoint);       // the browser unsubscribed or the app was removed
    }
  }));
  return { sent, gone };
}

/** Called by the gate right after a hold is saved: alert every admin who turned alerts on. */
export async function alertAdminsOfHold(caseId: string, alert: Alert) {
  if (!pushConfigured) return;
  const supabase = await createClient();
  const { data } = await supabase.rpc("push_targets", { p_case: caseId });
  // Subscriptions the push service reports as gone are skipped here; each admin's own browser removes them
  // (an account may delete only its own subscriptions, so a gate can't switch off admins' alerts).
  await send((data ?? []) as Target[], alert);
}

/** An admin's own subscriptions (row-level security returns only theirs), for "Send a test alert". */
export async function alertMe(alert: Alert) {
  const supabase = await createClient();
  const { data } = await supabase.from("push_subscriptions").select("endpoint, p256dh, auth");
  const r = await send((data ?? []) as Target[], alert);
  for (const endpoint of r.gone) await supabase.rpc("delete_push_subscription", { p_endpoint: endpoint });
  return r.sent;
}
