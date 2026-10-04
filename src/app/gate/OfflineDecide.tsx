"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { tr, type Lang } from "@/lib/i18n";
import { personMeta } from "@/lib/format";
import { putQueued, type RosterRow } from "@/lib/offline";

/** Campus time now as "HH:MM" (the iPad's clock; the server re-checks the hours when it records the entry). */
function nowHHMM() {
  return new Date().toLocaleTimeString("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });
}
const clock = (hhmm: string) => { const [h, m] = hhmm.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`; };

/**
 * Deciding with no internet (planning/02 D11): no photo, so the guard checks ID. The decision is saved on the iPad
 * with its time and guard, and recorded when the network returns. Flag & Hold isn't possible offline.
 */
export function OfflineDecide({ lang, row, guard, hours, onBack, onSaved }: {
  lang: Lang; row: RosterRow; guard: string; hours: { open: string; close: string };
  onBack: () => void; onSaved: (name: string, at: string) => void;
}) {
  const [purpose, setPurpose] = useState("");
  const [reason, setReason] = useState("");
  const [denying, setDenying] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const t = nowHHMM();
  const outside = !(t >= hours.open && t < hours.close);

  const save = async (approve: boolean) => {
    if (saving) return;                                   // a double tap saves once
    if (!approve && !reason.trim()) { setErr(tr(lang, "deny.err")); return; }
    setSaving(true);
    const at = new Date().toISOString();
    try {
      await putQueued({ client: crypto.randomUUID(), person: row.id, name: row.full_name, approve, reason: reason.trim(), purpose: purpose.trim(), at, guard, status: "pending" });
      onSaved(row.full_name, at);
    } catch {
      setSaving(false);
      setErr(tr(lang, "off.nostore"));
    }
  };

  return (
    <section className="ma-panel" aria-labelledby="off-h">
      <button type="button" className="ma-link ma-linkbtn" onClick={onBack}><Icon name="arrow-left" />{tr(lang, "off.back")}</button>
      <div className="ma-record">
        <figure className="ma-photo ma-photo--record is-none"><div className="ma-photo__frame"><Icon name="cloud-off" /></div></figure>
        <div className="ma-record__info">
          <h2 className="ma-record__name" id="off-h">{row.full_name}</h2>
          <p className="ma-record__meta">{personMeta(lang, row)}</p>
          <div className="ma-banner ma-banner--escalation" role="status"><span className="ma-circle"><Icon name="id-card" /></span><span className="ma-banner__text">{tr(lang, "off.check")}</span></div>
          <div className="ma-field">
            <label className="ma-field__label" htmlFor="off-p">{tr(lang, "purpose")}</label>
            <div className="ma-field__box"><input id="off-p" value={purpose} onChange={(e) => setPurpose(e.target.value)} maxLength={200} placeholder={tr(lang, "purpose.ph")} /></div>
          </div>
        </div>
      </div>
      {outside ? <div className="ma-banner ma-banner--escalation" role="status" id="off-why"><span className="ma-circle"><Icon name="clock" /></span>
        <span className="ma-banner__text">{tr(lang, "off.hours", { o: clock(hours.open), c: clock(hours.close) })}</span></div> : null}
      {err && !denying ? <div className="ma-banner ma-banner--danger" role="alert"><span className="ma-circle"><Icon name="circle-alert" /></span><span className="ma-banner__text">{err}</span></div> : null}
      {denying ? (
        <div className={`ma-field${err ? " is-error" : ""}`}>
          <label className="ma-field__label" htmlFor="off-r">{tr(lang, "deny.reason")}</label>
          <div className="ma-field__box"><input id="off-r" value={reason} onChange={(e) => { setReason(e.target.value); setErr(null); }} maxLength={300} autoFocus
            placeholder={tr(lang, "deny.ph")} aria-invalid={err ? true : undefined} aria-describedby="off-r-h" /></div>
          <p className="ma-field__help" id="off-r-h"><Icon name={err ? "circle-alert" : "info"} size={16} />{err ?? tr(lang, "deny.help")}</p>
        </div>
      ) : null}
      <div className="ma-decide" role="group" aria-label={tr(lang, "dec.group")}>
        <button type="button" className="ma-decision ma-decision--approve" aria-disabled={outside || saving ? "true" : undefined} aria-describedby={outside ? "off-why" : undefined}
          onClick={() => { if (!outside) save(true); }}><Icon name={outside ? "lock" : "check"} className="ma-ic" />{tr(lang, "off.approve")}</button>
        <button type="button" className="ma-decision ma-decision--deny" aria-disabled={saving ? "true" : undefined} onClick={() => (denying ? save(false) : setDenying(true))}>
          <Icon name="ban" className="ma-ic" />{tr(lang, "off.deny")}</button>
      </div>
      <p className="ma-note"><Icon name="info" size={16} /> {tr(lang, "off.hold")}</p>
    </section>
  );
}
