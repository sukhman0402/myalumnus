"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Icon } from "@/components/Icon";
import { tr, type Lang, type TKey } from "@/lib/i18n";
import { holdVisitor, type FormState } from "../actions";

type Host = { id: string; name: string; department: string | null; phone: string | null };

/**
 * The Put on hold form (Iteration 3, F10 + NEW-3). Up front only what the guard needs to start the call: the name the
 * visitor gave, why they're held, and the host picked from the university's list (the phone comes with it). The rest
 * is under "More details". Field errors show under each field and open that section; nothing is lost on an error.
 */
export function HoldForm({ lang, clientId, back, personId, name, says, why, purpose, host, hosts }: {
  lang: Lang; clientId: string; back: string; personId: string; name: string; says: string; why: number; purpose: string; host: string;
  hosts: Host[];
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(holdVisitor, {});
  const err = state.fields ?? {};
  const v = (k: string, initial: string) => state.values?.[k] ?? initial;
  // An expected visit already names a host: pick it when it is on the list, else "someone else" with the name typed.
  const guess = host ? hosts.find((h) => host.toLowerCase().startsWith(h.name.toLowerCase()))?.id ?? "other" : "";
  const [hostId, setHostId] = useState(v("host_id", guess));
  const picked = hosts.find((h) => h.id === hostId);
  const other = hostId === "other" || hosts.length === 0;
  const moreOpen = Boolean(err.says || err.purpose || err.visitor_phone);

  const field = (id: string, label: TKey, value: string, o: { help?: TKey; type?: string; autoFocus?: boolean; max: number } ) => (
    <div className={`ma-field${err[id] ? " is-error" : ""}`}>
      <label className="ma-field__label" htmlFor={`f-${id}`}>{tr(lang, label)}</label>
      <div className="ma-field__box">
        <input id={`f-${id}`} name={id} defaultValue={v(id, value)} placeholder=" " maxLength={o.max} autoFocus={o.autoFocus}
          type={o.type ?? "text"} inputMode={o.type === "tel" ? "tel" : undefined} autoComplete="off"
          aria-describedby={o.help || err[id] ? `f-${id}-h` : undefined} aria-invalid={err[id] ? true : undefined} />
      </div>
      {o.help || err[id] ? (
        <p className="ma-field__help" id={`f-${id}-h`}>
          <Icon name={err[id] ? "circle-alert" : "info"} size={16} />{err[id] ?? tr(lang, o.help!)}
        </p>
      ) : null}
    </div>
  );
  return (
    <form className="ma-form" action={action} noValidate>
      <input type="hidden" name="client" value={clientId} />
      <input type="hidden" name="person" value={personId} />
      <div className="ma-form__2">
        {field("name", "fh.name", name, { autoFocus: !name, max: 120 })}
        <div className="ma-field">
          <label className="ma-field__label" htmlFor="f-why">{tr(lang, "fh.why")}</label>
          <div className="ma-field__box">
            <select id="f-why" name="why" defaultValue={v("why", String(why))}>
              {[1, 2, 3, 4, 5].map((i) => <option key={i} value={i}>{tr(lang, `fh.why.${i}` as TKey)}</option>)}
            </select>
            <Icon name="chevron-down" className="ma-field__icon" />
          </div>
        </div>
      </div>

      {hosts.length ? (
        <div className={`ma-field${err.host_id ? " is-error" : ""}`}>
          <label className="ma-field__label" htmlFor="f-host_id">{tr(lang, "fh.host")}</label>
          <div className="ma-field__box">
            <select id="f-host_id" name="host_id" value={hostId} onChange={(e) => setHostId(e.target.value)}
              aria-describedby="f-host_id-h" aria-invalid={err.host_id ? true : undefined} autoFocus={Boolean(name) && !hostId}>
              <option value="" disabled>{tr(lang, "fh.host.pick")}</option>
              {hosts.map((h) => <option key={h.id} value={h.id}>{h.department ? `${h.name} · ${h.department}` : h.name}</option>)}
              <option value="other">{tr(lang, "fh.host.other")}</option>
            </select>
            <Icon name="chevron-down" className="ma-field__icon" />
          </div>
          <p className="ma-field__help" id="f-host_id-h">
            <Icon name={err.host_id ? "circle-alert" : picked?.phone ? "phone" : "info"} size={16} />
            {err.host_id ?? (picked ? (picked.phone ? <span className="ma-tabular">{picked.phone}</span> : tr(lang, "fh.host.nophone")) : tr(lang, "fh.host.help"))}
          </p>
        </div>
      ) : <input type="hidden" name="host_id" value="other" />}
      {other ? (
        <div className="ma-form__2">
          {field("host", "fh.host.name", hosts.length ? "" : host, { autoFocus: hostId === "other", max: 120 })}
          {field("host_phone", "fh.hostphone", "", { type: "tel", max: 24 })}
        </div>
      ) : null}

      <details className="ma-more" open={moreOpen || undefined}>
        <summary>{tr(lang, "fh.more")}</summary>
        <div className="ma-form">
          {field("says", "fh.says", says, { help: "fh.says.help", max: 160 })}
          {field("purpose", "purpose", purpose, { max: 200 })}
          {field("visitor_phone", "fh.visitorphone", "", { type: "tel", max: 24 })}
        </div>
      </details>

      {state.error ? (
        <div className="ma-banner ma-banner--danger" role="alert">
          <span className="ma-circle"><Icon name="circle-alert" /></span><span className="ma-banner__text">{state.error}</span>
        </div>
      ) : null}
      <div className="ma-actions">
        <Link className="ma-btn ma-btn--secondary" href={back}>{tr(lang, "cancel")}</Link>
        <button type="submit" className="ma-decision ma-decision--hold" aria-disabled={pending ? "true" : undefined}
          onClick={(e) => { if (pending) e.preventDefault(); }}>
          <Icon name={pending ? "loader-circle" : "flag"} className={`ma-ic${pending ? " ma-spin" : ""}`} />{tr(lang, "dec.hold")}
        </button>
      </div>
    </form>
  );
}
