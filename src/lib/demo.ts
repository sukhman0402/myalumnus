// Demo mode for the public case-study prototype (owner, 2026-10-05).
// With NEXT_PUBLIC_DEMO_MODE=1 the sign-in page shows two profiles, Guard and Admin, instead of the email code.
// Each signs in to a fixed demo account (migration 0015). The passwords live only in the server-only
// environment variables DEMO_GUARD_PASSWORD and DEMO_ADMIN_PASSWORD, never in the repo.
// In demo mode viewers can't change photos and Flag & Hold sends no push alerts; the database resets nightly.

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";

export type DemoRole = "guard" | "admin";

export const DEMO_PROFILES: Record<DemoRole, { name: string; detail: string; icon: string; userId: string }> = {
  guard: { name: "Gate 1", detail: "Guard device", icon: "university", userId: "guard.demo" },
  admin: { name: "Campus Admin", detail: "Admin", icon: "user-check", userId: "admin.demo" },
};
