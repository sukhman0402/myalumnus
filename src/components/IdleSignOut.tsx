"use client";

import { useEffect } from "react";

const KEY = "ma-last-activity";
const LIMIT_MS = 8 * 60 * 60 * 1000; // planning/02 Q7: admins are signed out after 8 hours idle

/** Signs the admin out after 8 hours without activity, including a laptop left closed overnight. */
export function IdleSignOut({ signOut }: { signOut: () => Promise<void> }) {
  useEffect(() => {
    const read = () => { try { return Number(localStorage.getItem(KEY)) || Date.now(); } catch { return Date.now(); } };
    const touch = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* storage blocked: rely on server session */ } };
    const check = () => { if (Date.now() - read() > LIMIT_MS) { try { localStorage.removeItem(KEY); } catch {} void signOut(); } };
    check(); touch();
    const events = ["pointerdown", "keydown"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    document.addEventListener("visibilitychange", onVisible);
    const timer = window.setInterval(check, 60_000);
    return () => { events.forEach((e) => window.removeEventListener(e, touch)); document.removeEventListener("visibilitychange", onVisible); window.clearInterval(timer); };
  }, [signOut]);
  return null;
}
