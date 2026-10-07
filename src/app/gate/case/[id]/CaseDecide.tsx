"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { tr, type Lang } from "@/lib/i18n";
import { decideCase, passToAdmin, type FormState } from "../../actions";

/**
 * A held case's decision bar (host first, owner 2026-10-06).
 * - stage "host": Approve / Deny on the host's answer, or pass the case to the admin when the host can't be reached.
 * - stage "admin": only an admin can approve; the guard can close it as denied if the visitor leaves.
 * - stage "legacy": a case held before the order changed; Approve / Deny after the call, as before.
 * Deny opens a dialog with the usual reason filled in.
 */
export function CaseDecide({ lang, caseId, name, stage, defaultReason }: {
  lang: Lang; caseId: string; name: string; stage: "host" | "admin" | "legacy"; defaultReason: string;
}) {
  // Controlled, so a typed reason survives an error (React resets uncontrolled form fields after an action).
  const [reason, setReason] = useState(defaultReason);
  const [passState, pass, passing] = useActionState<FormState, FormData>(passToAdmin, {});
  const [approveState, approve, approving] = useActionState<FormState, FormData>(decideCase, {});
  const [denyState, deny, denying] = useActionState<FormState, FormData>(decideCase, {});
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const busy = approving || denying || passing;
  const reasonErr = denyState.fields?.reason;
  useEffect(() => { if (denyState.error) dialog.current?.close(); }, [denyState]);
  const error = approveState.error ?? denyState.error ?? passState.error;
  const canApprove = stage !== "admin";

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
      <form id="f-case-pass" action={pass} hidden><input type="hidden" name="case" value={caseId} /></form>
      <div className="ma-decide" role="group" aria-label={tr(lang, "dec.group")} aria-busy={busy || undefined}>
        {canApprove ? (
          <>
            <button type="submit" form="f-case-approve" className="ma-decision ma-decision--approve" aria-disabled={busy ? "true" : undefined}
              onClick={(e) => { if (busy) e.preventDefault(); }}>
              <Icon name={approving ? "loader-circle" : "check"} className={`ma-ic${approving ? " ma-spin" : ""}`} />{tr(lang, "dec.approve")}
            </button>
            <button ref={opener} type="button" className="ma-decision ma-decision--deny" aria-disabled={busy ? "true" : undefined}
              onClick={() => { if (!busy) dialog.current?.showModal(); }}>
              <Icon name="ban" className="ma-ic" />{tr(lang, "dec.deny")}
            </button>
            {stage === "host" ? (
              <button type="submit" form="f-case-pass" className="ma-btn ma-btn--secondary ma-decide__pass" aria-disabled={busy ? "true" : undefined}
                onClick={(e) => { if (busy) e.preventDefault(); }}>
                <Icon name={passing ? "loader-circle" : "arrow-right"} className={passing ? "ma-spin" : undefined} />{tr(lang, "case.pass")}
              </button>
            ) : null}
          </>
        ) : (
          <button ref={opener} type="button" className="ma-btn ma-btn--secondary" aria-disabled={busy ? "true" : undefined}
            onClick={() => { if (!busy) dialog.current?.showModal(); }}>
            <Icon name="door-open" />{tr(lang, "case.left")}
          </button>
        )}
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
                aria-describedby={reasonErr ? "cr-h" : undefined} aria-invalid={reasonErr ? true : undefined} />
            </div>
            {reasonErr ? <p className="ma-field__help" id="cr-h"><Icon name="circle-alert" size={16} />{reasonErr}</p> : null}
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
