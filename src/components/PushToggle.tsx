"use client";

import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/app/admin/push-actions";

type Status = "checking" | "unsupported" | "ios-home" | "blocked" | "off" | "on" | "nokey";
const KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function keyBytes(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function detect(): Promise<Status> {
  if (!KEY) return "nokey";
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return ios && !standalone ? "ios-home" : "unsupported";
  if (Notification.permission === "denied") return "blocked";
  const reg = await navigator.serviceWorker.register("/sw.js");
  const sub = await reg.pushManager.getSubscription();
  if (sub && Notification.permission === "granted") {
    await savePushSubscription(sub.toJSON()).catch(() => undefined);   // keeps the server's copy current
    return "on";
  }
  return "off";
}

/** Stop alerts in this browser (used by Sign out, so a shared computer stops showing them). */
export async function unsubscribeThisBrowser() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration("/sw.js");
    const sub = await reg?.pushManager.getSubscription();
    if (sub) { await removePushSubscription(sub.endpoint).catch(() => undefined); await sub.unsubscribe(); }
  } catch { /* no service worker or push here: nothing to stop */ }
}

/**
 * Phone and computer alerts for held visitors (planning/02 D13, Q2). Each browser or Home Screen app is turned on
 * separately, with a tap, because browsers only ask for permission after one.
 */
export function PushToggle() {
  const [status, setStatus] = useState<Status>("checking");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    detect().then((s) => { if (alive) setStatus(s); }).catch(() => { if (alive) setStatus("unsupported"); });
    return () => { alive = false; };
  }, []);

  const turnOn = async () => {
    setBusy(true); setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { setStatus(perm === "denied" ? "blocked" : "off"); return; }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(KEY) });
      const r = await savePushSubscription(sub.toJSON());
      if (!r.ok) { await sub.unsubscribe(); setMsg("Couldn't turn alerts on. Check the connection and try again."); return; }
      setStatus("on");
      setMsg("Alerts are on for this device.");
    } catch {
      setMsg("This browser couldn't turn alerts on. Try again, or use Chrome, Edge or Safari.");
    } finally { setBusy(false); }
  };
  const turnOff = async () => {
    setBusy(true); setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
      setStatus("off");
    } finally { setBusy(false); }
  };
  const test = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await sendTestPush();
      setMsg(!r.configured ? "Alerts aren't set up on the server yet." : r.sent ? "Test alert sent. It should appear within a few seconds." : "No device received it. Turn alerts off and on again.");
    } finally { setBusy(false); }
  };

  if (status === "checking" || status === "nokey") return null;
  return (
    <section className="ma-panel" aria-labelledby="push-h">
      <h2 className="ma-panel__title" id="push-h">Alerts on this device</h2>
      {status === "on" ? <p className="ma-note">You&apos;ll get an alert when a guard holds a visitor, even when this page is closed.</p>
        : status === "off" ? <p className="ma-note">Get an alert the moment a guard holds a visitor, even when this page is closed. Without it, keep this dashboard open.</p>
        : status === "blocked" ? <p className="ma-note">Alerts are blocked for this site in the browser&apos;s settings. Allow notifications for this site, then reload the page.</p>
        : status === "ios-home" ? <p className="ma-note">On iPad or iPhone, alerts work from the Home Screen app: tap Share, then <b>Add to Home Screen</b>, open My Alumnus from there and turn alerts on here.</p>
        : <p className="ma-note">This browser can&apos;t show alerts. Keep this dashboard open, or use Chrome, Edge or Safari.</p>}
      <div className="ma-actions" aria-busy={busy || undefined}>
        {status === "off" ? <button type="button" className="ma-btn ma-btn--primary" onClick={turnOn} disabled={busy}><Icon name={busy ? "loader-circle" : "bell"} className={busy ? "ma-spin" : undefined} />Turn on alerts</button> : null}
        {status === "on" ? <>
          <button type="button" className="ma-btn ma-btn--secondary" onClick={test} disabled={busy}><Icon name="bell" />Send a test alert</button>
          <button type="button" className="ma-btn ma-btn--secondary" onClick={turnOff} disabled={busy}><Icon name="bell-off" />Turn off</button>
        </> : null}
      </div>
      {msg ? <p className="ma-note" role="status">{msg}</p> : null}
    </section>
  );
}
