"use client";

import { useActionState, useState } from "react";
import { Icon } from "@/components/Icon";
import { decideHeldCase, type AdminFormState } from "../../actions";

/** Note + Approve / Deny for an admin. The note is optional to approve and required to deny. */
export function AdminDecide({ caseId, name }: { caseId: string; name: string }) {
  const [note, setNote] = useState("");
  const [state, action, pending] = useActionState<AdminFormState, FormData>(decideHeldCase, {});
  const noteErr = state.field === "note" ? state.error : undefined;
  return (
    <form action={action}>
      <input type="hidden" name="case" value={caseId} />
      <div className={`ma-field${noteErr ? " is-error" : ""}`}>
        <label className="ma-field__label" htmlFor="an">Note for the audit trail</label>
        <div className="ma-field__box">
          <input id="an" name="note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300}
            placeholder="e.g. Matched to the record above; spelling differed" aria-describedby="an-h" aria-invalid={noteErr ? true : undefined} />
        </div>
        <p className="ma-field__help" id="an-h"><Icon name={noteErr ? "circle-alert" : "info"} size={16} />{noteErr ?? "Optional when approving. Required when denying."}</p>
      </div>
      {state.error && !noteErr ? <div className="ma-banner ma-banner--danger" role="alert"><span className="ma-circle"><Icon name="circle-alert" /></span><span className="ma-banner__text">{state.error}</span></div> : null}
      <div className="ma-decide" role="group" aria-label={`Decision for ${name}`} aria-busy={pending || undefined}>
        <button type="submit" name="approve" value="1" className="ma-decision ma-decision--approve" aria-disabled={pending ? "true" : undefined}
          onClick={(e) => { if (pending) e.preventDefault(); }}><Icon name="check" className="ma-ic" />Approve</button>
        <button type="submit" name="approve" value="0" className="ma-decision ma-decision--deny" aria-disabled={pending ? "true" : undefined}
          onClick={(e) => { if (pending) e.preventDefault(); }}><Icon name="ban" className="ma-ic" />Deny</button>
      </div>
    </form>
  );
}
