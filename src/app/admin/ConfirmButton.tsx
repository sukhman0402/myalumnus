"use client";

import { useRef } from "react";
import { useFormStatus } from "react-dom";
import { Icon } from "@/components/Icon";

/**
 * A button that asks first (mockup a14): the safe choice has focus, and only the confirm button is red.
 * The confirm button submits a small form to a server action.
 */
export function ConfirmButton({ action, fields, label, icon, title, body, confirmLabel, keepLabel = "Cancel", destructive = true, small }: {
  action: (form: FormData) => Promise<void>; fields: Record<string, string>; label: string; icon: string;
  title: string; body: React.ReactNode; confirmLabel: string; keepLabel?: string; destructive?: boolean; small?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const keep = useRef<HTMLButtonElement>(null);
  // The safe choice gets focus when the dialog opens (autoFocus doesn't apply to a dialog opened later).
  const openDialog = () => { dialog.current?.showModal(); keep.current?.focus(); };
  return (
    <>
      {/* Not the table's stretched "View" link style: inside a table row that would cover the whole row. */}
      <button ref={opener} type="button" className="ma-btn ma-btn--secondary" onClick={openDialog} aria-label={small ? `${label}: ${title.replace(/\?$/, "")}` : undefined}>
        <Icon name={icon} />{label}
      </button>
      <dialog ref={dialog} className="ma-dialog" aria-labelledby={`${fields.id}-t`} onClose={() => opener.current?.focus()}>
        <form action={action} style={{ display: "contents" }}>
          {Object.entries(fields).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
          <div className="ma-dialog__head">
            <h2 className="ma-dialog__title" id={`${fields.id}-t`}>{title}</h2>
            <button type="button" className="ma-dialog__close" aria-label="Close" onClick={() => dialog.current?.close()}><Icon name="x" /></button>
          </div>
          <div className="ma-dialog__body">{body}</div>
          <div className="ma-dialog__actions">
            <button ref={keep} type="button" className="ma-btn ma-btn--secondary" onClick={() => dialog.current?.close()}>{keepLabel}</button>
            <Confirm destructive={destructive} icon={icon}>{confirmLabel}</Confirm>
          </div>
        </form>
      </dialog>
    </>
  );
}

function Confirm({ destructive, icon, children }: { destructive: boolean; icon: string; children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`ma-btn ma-btn--${destructive ? "destructive" : "primary"}`} aria-disabled={pending ? "true" : undefined}
      onClick={(e) => { if (pending) e.preventDefault(); }}>
      <Icon name={pending ? "loader-circle" : icon} className={pending ? "ma-spin" : undefined} />{children}
    </button>
  );
}
