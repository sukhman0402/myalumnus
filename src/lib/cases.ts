// A held case's stage, host first (migration 0017; owner, 2026-10-06).
//   "host":  stage 1, the guard is calling the host; the guard decides on the host's answer.
//   "admin": stage 2, the host couldn't be reached or didn't confirm in time; an admin decides.
// The minute job moves a case to "admin" at the deadline; these helpers also cover the minute before it runs.
// Cases held before 0017 (passed_to_host_at set) keep their old order: admin first, then the host.

export type CaseTimes = { status: string; created_at: string; passed_to_host_at?: string | null; passed_to_admin_at?: string | null };

export const handoffAt = (c: CaseTimes, minutes: number) => new Date(new Date(c.created_at).getTime() + minutes * 60000).toISOString();
export const isLegacy = (c: CaseTimes) => Boolean(c.passed_to_host_at);

export function stageOf(c: CaseTimes, minutes: number, now = Date.now()): "host" | "admin" | "approved" | "denied" | "left" {
  if (c.status === "host" && !c.passed_to_host_at && !c.passed_to_admin_at && now >= new Date(handoffAt(c, minutes)).getTime()) return "admin";
  return c.status as "host" | "admin" | "approved" | "denied" | "left";
}

/** When the case reached the admins, or null if it never did. */
export function adminSince(c: CaseTimes, minutes: number, now = Date.now()): string | null {
  if (c.passed_to_admin_at) return c.passed_to_admin_at;
  if (c.passed_to_host_at) return c.created_at;              // old order: admins first
  if (c.status === "admin") return c.created_at;
  if (c.status === "host" && now >= new Date(handoffAt(c, minutes)).getTime()) return handoffAt(c, minutes);
  return null;
}
/** True when the guard passed it on before the deadline (host not reached), false when the time ran out. */
export const passedByGuard = (c: CaseTimes, minutes: number) =>
  Boolean(c.passed_to_admin_at) && new Date(c.passed_to_admin_at!).getTime() < new Date(handoffAt(c, minutes)).getTime() - 1000;
