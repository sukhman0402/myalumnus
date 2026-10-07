"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { HoldLink } from "@/components/HoldLink";
import { tr, type Lang } from "@/lib/i18n";
import { approveVisit, denyVisit, type DecideState } from "../../actions";

/**
 * Purpose field + Approve / Deny / Flag & Hold (mockups g05–g09, g12). The database makes the final call
 * (hours, already inside, guard on shift); this component only mirrors those rules so the guard sees them first.
 * clientId is fixed for this screen, so a double tap or a retry after a dropped connection records once.
 */
export function Decide({ lang, personId, clientId, name, meta, thumb, purpose, locked, photo, heading, holdHref }: {
  lang: Lang; personId: string; clientId: string; name: string; meta: string; thumb: string | null;
  purpose: string; locked: boolean;
  photo: React.ReactNode; heading: React.ReactNode; holdHref: string;
}) {
  const [value, setValue] = useState(purpose);
  const [reasonText, setReasonText] = useState(""); // controlled: survives an error and a re-open
  const [approveState, approve, approving] = useActionState<DecideState, FormData>(approveVisit, {});
  const [denyState, deny, denying] = useActionState<DecideState, FormData>(denyVisit, {});
  const dialog = useRef<HTMLDialogElement>(null);
  const denyBtn = useRef<HTMLButtonElement>(null);
  const reason = useRef<HTMLInputElement>(null);
  const busy = approving || denying;

  // A deny that failed for a non-reason problem closes the dialog so the message under the buttons is seen.
  useEffect(() => {
    if (denyState.error && denyState.field !== "reason") dialog.current?.close();
    if (denyState.field === "reason") reason.current?.focus();
  }, [denyState]);

  const error = approveState.error ?? (denyState.field === "reason" ? undefined : denyState.error);

  return (
    <>
      <div className="ma-record">
        {photo}
        <div className="ma-record__info">
          {heading}
      <div className="ma-field">
        <label className="ma-field__label" htmlFor="pv">{tr(lang, "purpose")}</label>
        <div className="ma-field__box">
          <input id="pv" value={value} maxLength={200} placeholder={tr(lang, "purpose.ph")}
            onChange={(e) => setValue(e.target.value)} />
        </div>
      </div>
        </div>
      </div>

        {error ? (
          <div className="ma-banner ma-banner--danger" role="alert">
            <span className="ma-circle"><Icon name="circle-alert" /></span><span className="ma-banner__text">{error}</span>
          </div>
        ) : null}

        <form id="f-approve" action={approve} hidden>
          <input type="hidden" name="person" value={personId} />
          <input type="hidden" name="client" value={clientId} />
          <input type="hidden" name="purpose" value={value} />
        </form>

        <div className="ma-decide" role="group" aria-label={tr(lang, "dec.group")} aria-busy={busy || undefined}>
          <button type="submit" form="f-approve" className="ma-decision ma-decision--approve"
            aria-disabled={locked || busy ? "true" : undefined} aria-describedby={locked ? "who-chips" : undefined}
            onClick={(e) => { if (locked || busy) e.preventDefault(); }}>
            <Icon name={locked ? "lock" : approving ? "loader-circle" : "check"} className={`ma-ic${approving ? " ma-spin" : ""}`} />{tr(lang, "dec.approve")}
          </button>
          <button ref={denyBtn} type="button" className="ma-decision ma-decision--deny" aria-disabled={busy ? "true" : undefined}
            onClick={() => { if (!busy) dialog.current?.showModal(); }}>
            <Icon name="ban" className="ma-ic" />{tr(lang, "dec.deny")}
          </button>
          <HoldLink lang={lang} href={`${holdHref}&purpose=${encodeURIComponent(value)}`} />
        </div>

      <dialog ref={dialog} className={`ma-dialog${denying ? " is-saving" : ""}`} aria-labelledby="deny-t"
        onCancel={(e) => { if (denying) e.preventDefault(); }} onClose={() => denyBtn.current?.focus()}>
        <form action={deny} style={{ display: "contents" }}>
          <div className="ma-dialog__head">
            <h2 className="ma-dialog__title" id="deny-t">{tr(lang, "deny.title", { n: name })}</h2>
            <button type="button" className="ma-dialog__close" aria-label={tr(lang, "close")} aria-disabled={denying ? "true" : undefined}
              onClick={() => { if (!denying) dialog.current?.close(); }}><Icon name="x" /></button>
          </div>
          <div className="ma-dialog__who">
            {thumb
              // eslint-disable-next-line @next/next/no-img-element
              ? <span className="ma-row__photo ma-row__photo--img"><img src={thumb} alt="" /></span>
              : <span className="ma-row__photo"><Icon name="user" /></span>}
            <div><b>{name}</b><span>{meta}</span></div>
          </div>
          <input type="hidden" name="person" value={personId} />
          <input type="hidden" name="client" value={clientId} />
          <input type="hidden" name="purpose" value={value} />
          <div className={`ma-field${denyState.field === "reason" ? " is-error" : ""}`}>
            <label className="ma-field__label" htmlFor="r">{tr(lang, "deny.reason")}</label>
            <div className="ma-field__box">
              <input ref={reason} id="r" name="reason" value={reasonText} onChange={(e) => setReasonText(e.target.value)} maxLength={300} placeholder={tr(lang, "deny.ph")} autoFocus
                aria-describedby={denyState.field === "reason" ? "r-help" : undefined} aria-invalid={denyState.field === "reason" || undefined} />
            </div>
            {denyState.field === "reason" ? (
              <p className="ma-field__help" id="r-help"><Icon name="circle-alert" size={16} />{denyState.error}</p>
            ) : null}
          </div>
          <div className="ma-dialog__actions">
            <button type="button" className="ma-btn ma-btn--secondary" aria-disabled={denying ? "true" : undefined}
              onClick={() => { if (!denying) dialog.current?.close(); }}>{tr(lang, "cancel")}</button>
            <button type="submit" className="ma-decision ma-decision--deny" aria-disabled={denying ? "true" : undefined}
              onClick={(e) => { if (denying) e.preventDefault(); }}>
              <Icon name={denying ? "loader-circle" : "ban"} className={`ma-ic${denying ? " ma-spin" : ""}`} />{tr(lang, "dec.deny")}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
