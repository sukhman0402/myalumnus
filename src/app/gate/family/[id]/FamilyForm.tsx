"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Icon } from "@/components/Icon";
import { tr, type Lang } from "@/lib/i18n";
import { logFamily, type FormState } from "../../actions";

/** Headcount stepper (1–20) + purpose. Guests aren't named (planning decision). */
export function FamilyForm({ lang, studentId, clientId, photo, heading }: {
  lang: Lang; studentId: string; clientId: string; photo: React.ReactNode; heading: React.ReactNode;
}) {
  const [guests, setGuests] = useState(2);
  const [purpose, setPurpose] = useState("");
  const [state, action, pending] = useActionState<FormState, FormData>(logFamily, {});
  return (
    <form action={action} className="ma-form">
      <input type="hidden" name="student" value={studentId} />
      <input type="hidden" name="client" value={clientId} />
      <input type="hidden" name="guests" value={guests} />
      <div className="ma-record">
        {photo}
        <div className="ma-record__info">
          {heading}
          <div className="ma-field">
            <span className="ma-field__label" id="hc-l">{tr(lang, "fam.guests")}</span>
            <div className="ma-stepper" role="group" aria-labelledby="hc-l">
              <button type="button" className="ma-btn ma-btn--secondary ma-btn--icon" aria-label={tr(lang, "fam.less")}
                aria-disabled={guests <= 1 ? "true" : undefined} onClick={() => setGuests((g) => Math.max(1, g - 1))}><Icon name="minus" /></button>
              <output id="hc" aria-live="polite" className="ma-tabular">{guests}</output>
              <button type="button" className="ma-btn ma-btn--secondary ma-btn--icon" aria-label={tr(lang, "fam.more")}
                aria-disabled={guests >= 20 ? "true" : undefined} onClick={() => setGuests((g) => Math.min(20, g + 1))}><Icon name="plus" /></button>
            </div>
            <p className="ma-field__help"><Icon name="info" size={16} />{tr(lang, "fam.guests.help")}</p>
          </div>
          <div className="ma-field">
            <label className="ma-field__label" htmlFor="fp2">{tr(lang, "fam.purpose")}</label>
            <div className="ma-field__box"><input id="fp2" name="purpose" maxLength={200} placeholder=" " value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div>
          </div>
        </div>
      </div>
      <p className="ma-say"><Icon name="message-circle" /><span><small>{tr(lang, "fam.read.small")}</small><q>{tr(lang, "fam.read")}</q></span></p>
      {state.error ? <div className="ma-banner ma-banner--danger" role="alert"><span className="ma-circle"><Icon name="circle-alert" /></span><span className="ma-banner__text">{state.error}</span></div> : null}
      <div className="ma-actions">
        <Link className="ma-btn ma-btn--secondary" href="/gate">{tr(lang, "cancel")}</Link>
        <button type="submit" className="ma-btn ma-btn--primary" aria-disabled={pending ? "true" : undefined} onClick={(e) => { if (pending) e.preventDefault(); }}>
          <Icon name={pending ? "loader-circle" : "user-plus"} className={pending ? "ma-spin" : undefined} />{tr(lang, "fam.log")}
        </button>
      </div>
    </form>
  );
}
