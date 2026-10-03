"use client";

import { useActionState, useRef } from "react";
import { Icon } from "@/components/Icon";
import { tr, type Lang } from "@/lib/i18n";
import { markExit, type FormState } from "../actions";

/** "Mark exit" with a confirm dialog (mockup g22), or a direct "Close the family visit" (g28). */
export function ExitButton({ lang, id, kind, name, meta, thumb, rowLabel, variant = "row" }: {
  lang: Lang; id: string; kind: "visit" | "family"; name: string; meta?: string; thumb?: string | null;
  rowLabel: string; variant?: "row" | "primary";
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(markExit, {});
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const cls = variant === "row" ? "ma-btn ma-btn--row" : "ma-btn ma-btn--primary";
  const hidden = <><input type="hidden" name="id" value={id} /><input type="hidden" name="kind" value={kind} /></>;
  const error = state.error ? <p className="ma-note" role="alert"><Icon name="circle-alert" size={16} /> {state.error}</p> : null;

  if (kind === "family") {
    return (
      <form action={action} className="ma-inline-form">
        {hidden}
        <button className={cls} aria-disabled={pending ? "true" : undefined} onClick={(e) => { if (pending) e.preventDefault(); }}>
          <Icon name="door-open" />{rowLabel}{variant === "row" ? <span className="ma-visually-hidden"> · {name}</span> : null}
        </button>
        {error}
      </form>
    );
  }
  return (
    <>
      <button ref={opener} type="button" className={cls} onClick={() => dialog.current?.showModal()}>
        <Icon name="door-open" />{rowLabel}{variant === "row" ? <span className="ma-visually-hidden"> · {name}</span> : null}
      </button>
      {error}
      <dialog ref={dialog} className={`ma-dialog${pending ? " is-saving" : ""}`} aria-labelledby={`x-${id}`}
        onCancel={(e) => { if (pending) e.preventDefault(); }} onClose={() => opener.current?.focus()}>
        <form action={action} style={{ display: "contents" }}>
          {hidden}
          <div className="ma-dialog__head">
            <h2 className="ma-dialog__title" id={`x-${id}`}>{tr(lang, "exit.title", { n: name })}</h2>
            <button type="button" className="ma-dialog__close" aria-label={tr(lang, "close")} onClick={() => { if (!pending) dialog.current?.close(); }}><Icon name="x" /></button>
          </div>
          <div className="ma-dialog__who">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {thumb ? <span className="ma-row__photo ma-row__photo--img"><img src={thumb} alt="" /></span> : <span className="ma-row__photo"><Icon name="user" /></span>}
            <div><b>{name}</b><span>{meta}</span></div>
          </div>
          <p className="ma-dialog__body">{tr(lang, "exit.body", { t: new Date().toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase() })}</p>
          <div className="ma-dialog__actions">
            <button type="button" className="ma-btn ma-btn--secondary" onClick={() => { if (!pending) dialog.current?.close(); }}>{tr(lang, "cancel")}</button>
            <button type="submit" className="ma-btn ma-btn--primary" autoFocus aria-disabled={pending ? "true" : undefined} onClick={(e) => { if (pending) e.preventDefault(); }}>
              <Icon name={pending ? "loader-circle" : "door-open"} className={pending ? "ma-spin" : undefined} />{tr(lang, "in.exit")}
            </button>
          </div>
        </form>
      </dialog>
    </>
  );
}
