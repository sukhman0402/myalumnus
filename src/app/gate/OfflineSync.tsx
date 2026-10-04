"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { tr, type Lang, type TKey } from "@/lib/i18n";
import { allQueued, dropQueued, isNetworkError, putQueued, QUEUE_EVENT, type QueueItem } from "@/lib/offline";
import { syncOffline } from "./actions";

const KNOWN = ["outside_hours", "already_inside", "too_old", "no_shift", "not_found"];

/**
 * Sends decisions saved on this iPad while offline, oldest first, as soon as the network is back; shows what is
 * still waiting, and anything the server refused (with the reason) until the guard dismisses it.
 */
export function OfflineSync({ lang }: { lang: Lang }) {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [syncing, setSyncing] = useState(false);
  const running = useRef(false);

  const reload = useCallback(async () => {
    try { setItems((await allQueued()).sort((a, b) => a.at.localeCompare(b.at))); } catch { /* IndexedDB unavailable: nothing queued */ }
  }, []);

  const sync = useCallback(async () => {
    if (running.current || !navigator.onLine) return;
    running.current = true;
    try {
      const pending = (await allQueued()).filter((i) => i.status === "pending").sort((a, b) => a.at.localeCompare(b.at));
      if (pending.length) setSyncing(true);
      for (const item of pending) {
        try {
          const r = await syncOffline({ client: item.client, person: item.person, approve: item.approve, reason: item.reason, purpose: item.purpose, at: item.at, guard: item.guard });
          if (r.ok) await dropQueued(item.client);
          else if (r.final) await putQueued({ ...item, status: "failed", error: r.hint });
          else {
            // The server refused it for an unexpected reason: retry a few times, then show it to the guard.
            const attempts = (item.attempts ?? 0) + 1;
            await putQueued({ ...item, attempts, ...(attempts >= 5 ? { status: "failed" as const, error: "other" } : {}) });
          }
        } catch (e) {
          if (isNetworkError(e)) break;   // still offline: try again later
        }
      }
    } finally {
      running.current = false;
      setSyncing(false);
      reload();
    }
  }, [reload]);

  useEffect(() => {
    const kick = () => { reload(); sync(); };
    const t0 = setTimeout(kick, 0);
    const id = setInterval(sync, 20_000);
    window.addEventListener("online", sync);
    window.addEventListener(QUEUE_EVENT, reload);
    return () => { clearTimeout(t0); clearInterval(id); window.removeEventListener("online", sync); window.removeEventListener(QUEUE_EVENT, reload); };
  }, [reload, sync]);

  const pending = items.filter((i) => i.status === "pending");
  const failed = items.filter((i) => i.status === "failed");
  if (!pending.length && !failed.length) return null;
  return (
    <div className="ma-stack-sm">
      {pending.length ? (
        <div className="ma-banner ma-banner--escalation" role="status">
          <span className="ma-circle"><Icon name={syncing ? "loader-circle" : "cloud-off"} className={syncing ? "ma-spin" : undefined} /></span>
          <span className="ma-banner__text">{syncing ? tr(lang, "off.syncing", { n: pending.length }) : pending.length === 1 ? tr(lang, "off.queue1") : tr(lang, "off.queue", { n: pending.length })}</span>
        </div>
      ) : null}
      {failed.map((f) => (
        <div key={f.client} className="ma-banner ma-banner--danger" role="alert">
          <span className="ma-circle"><Icon name="circle-alert" /></span>
          <span className="ma-banner__text"><b>{tr(lang, "off.failed.b", { n: f.name })}</b> {tr(lang, `off.err.${KNOWN.includes(f.error ?? "") ? f.error : "other"}` as TKey)}{" "}
            <button type="button" className="ma-btn ma-btn--secondary" onClick={() => dropQueued(f.client)}>{tr(lang, "off.dismiss")}</button></span>
        </div>
      ))}
    </div>
  );
}
