"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { tr, type Lang } from "@/lib/i18n";
import { decideCase, type FormState } from "../../actions";

/** Approve / Deny after the host call (mockup g15). Deny opens a dialog with the usual reason filled in. */
export function CaseDecide({ lang, caseId, name, unreachable }: { lang: Lang; caseId: string; name: string; unreachable: string }) {
  // Controlled, so a typed reason survives an error (React resets uncontrolled form fields after an action).
  const [reason, setReason] = useState(unreachable);
  const [approveState, approve, approving] = useActionState<FormState, FormData>(decideCase, {});
  const [denyState, deny, denying] = useActionState<FormState, FormData>(decideCase, {});
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const busy = approving || denying;
  const reasonErr = denyState.fields?.reason;
  useEffect(() => { if (denyState.error) dialog.current?.close(); }, [denyState]);
  const error = approveState.error ?? denyState.error;

  return (
    <>
      {error ? (
        <div className="ma-banner ma-banner--danger" role="alert">
          <span className="ma-circle"><Icon name="circle-alert" /></span><span className="ma-banner__text">{error}</span>
        </div>
      ) : null}
      <form id="f-case-approve" action={approve} hidden>
        <input type="hidden" name="case" value={caseId} /><input type="hidden" name="approve" value="1" />
      </form>
      <div className="ma-decide" role="group" aria-label={tr(lang, "dec.group")} aria-busy={busy || undefined}>
        <button type="submit" form="f-case-approve" className="ma-decision ma-decision--approve" aria-disabled={busy ? "true" : undefined}
          onClick={(e) => { if (busy) e.preventDefault(); }}>
          <Icon name={approving ? "loader-circle" : "check"} className={`ma-ic${approving ? " ma-spin" : ""}`} />{tr(lang, "dec.approve")}
        </button>
        <button ref={opener} type="button" className="ma-decision ma-decision--deny" aria-disabled={busy ? "true" : undefined}
          onClick={() => { if (!busy) dialog.current?.showModal(); }}>
          <Icon name="ban" className="ma-ic" />{tr(lang, "dec.deny")}
        </button>
      </div>
      <dialog ref={dialog} className={`ma-dialog${denying ? " is-saving" : ""}`} aria-labelledby="cd-t"
        onCancel={(e) => { if (denying) e.preventDefault(); }} onClose={() => opener.current?.focus()}>
        <form action={deny} style={{ display: "contents" }}>
          <div className="ma-dialog__head">
            <h2 className="ma-dialog__title" id="cd-t">{tr(lang, "deny.title", { n: name })}</h2>
            <button type="button" className="ma-dialog__close" aria-label={tr(lang, "close")} onClick={() => { if (!denying) dialog.current?.close(); }}><Icon name="x" /></button>
          </div>
          <input type="hidden" name="case" value={caseId} /><input type="hidden" name="approve" value="0" />
          <div className={`ma-field${reasonErr ? " is-error" : ""}`}>
            <label className="ma-field__label" htmlFor="cr">{tr(lang, "deny.reason")}</label>
            <div className="ma-field__box">
              <input id="cr" name="reason" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} placeholder={tr(lang, "deny.ph")} autoFocus
                aria-describedby="cr-h" aria-invalid={reasonErr ? true : undefined} />
            </div>
            <p className="ma-field__help" id="cr-h"><Icon name={reasonErr ? "circle-alert" : "info"} size={16} />{reasonErr ?? tr(lang, "deny.help")}</p>
          </div>
          <div className="ma-dialog__actions">
            <button type="button" className="ma-btn ma-btn--secondary" onClick={() => { if (!denying) dialog.current?.close(); }}>{tr(lang, "cancel")}</button>
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
