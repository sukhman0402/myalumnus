"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Icon } from "@/components/Icon";
import { tr, type Lang, type TKey } from "@/lib/i18n";
import { holdVisitor, type FormState } from "../actions";

/** The Flag & Hold form. Field errors show under each field; nothing is lost on an error. */
export function HoldForm({ lang, clientId, back, personId, name, says, why, purpose, host }: {
  lang: Lang; clientId: string; back: string; personId: string; name: string; says: string; why: number; purpose: string; host: string;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(holdVisitor, {});
  const err = state.fields ?? {};
  const v = (k: string, initial: string) => state.values?.[k] ?? initial;
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
        {field("says", "fh.says", says, { help: "fh.says.help", max: 160 })}
      </div>
      <div className="ma-field">
        <label className="ma-field__label" htmlFor="f-why">{tr(lang, "fh.why")}</label>
        <div className="ma-field__box">
          <select id="f-why" name="why" defaultValue={v("why", String(why))}>
            {[1, 2, 3, 4, 5].map((i) => <option key={i} value={i}>{tr(lang, `fh.why.${i}` as TKey)}</option>)}
          </select>
          <Icon name="chevron-down" className="ma-field__icon" />
        </div>
      </div>
      {field("purpose", "purpose", purpose, { max: 200 })}
      <div className="ma-form__2">
        {field("host", "fh.host", host, { autoFocus: Boolean(name) && !host, max: 120 })}
        {field("host_phone", "fh.hostphone", "", { type: "tel", max: 24 })}
      </div>
      {field("visitor_phone", "fh.visitorphone", "", { type: "tel", max: 24 })}
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
