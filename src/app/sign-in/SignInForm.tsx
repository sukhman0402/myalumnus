"use client";

import { useActionState, useEffect, useRef } from "react";
import { sendCode, verifyCode, type SignInState } from "./actions";
import { Icon } from "@/components/Icon";

const start: SignInState = { step: "email", email: "" };

export function SignInForm() {
  const [sent, send, sending] = useActionState(sendCode, start);
  const [checked, verify, verifying] = useActionState(verifyCode, start);
  const state = checked.error ? checked : sent;
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (sent.step === "code") codeRef.current?.focus(); }, [sent.step]);

  if (sent.step === "email") {
    return (
      <form action={send} className="ma-form" noValidate>
        <div className={`ma-field${sent.error ? " is-error" : ""}`}>
          <label className="ma-field__label" htmlFor="email">Work email</label>
          <div className="ma-field__box">
            <input id="email" name="email" type="email" autoComplete="email" inputMode="email" defaultValue={sent.email}
              aria-invalid={sent.error ? true : undefined} aria-describedby="email-h" required autoFocus />
          </div>
          <p className="ma-field__help" id="email-h">
            <Icon name={sent.error ? "circle-alert" : "info"} size={16} />
            {sent.error ?? "We'll email you a 6-digit code. No password needed."}
          </p>
        </div>
        <button type="submit" className="ma-btn ma-btn--primary ma-btn--block" disabled={sending}>
          <Icon name="arrow-right" />{sending ? "Sending…" : "Send code"}
        </button>
      </form>
    );
  }

  return (
    <form action={verify} className="ma-form" noValidate>
      <p className="ma-note" role="status">{sent.notice}</p>
      <input type="hidden" name="email" value={sent.email} />
      <div className={`ma-field${state.error ? " is-error" : ""}`}>
        <label className="ma-field__label" htmlFor="code">6-digit code</label>
        <div className="ma-field__box">
          <input ref={codeRef} id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6}
            aria-invalid={checked.error ? true : undefined} aria-describedby="code-h" required />
        </div>
        <p className="ma-field__help" id="code-h">
          <Icon name={checked.error ? "circle-alert" : "info"} size={16} />
          {checked.error ?? "Check your inbox (and spam). The code works once."}
        </p>
      </div>
      <button type="submit" className="ma-btn ma-btn--primary ma-btn--block" disabled={verifying}>
        <Icon name="check" />{verifying ? "Checking…" : "Sign in"}
      </button>
      <a className="ma-link" href="/sign-in"><Icon name="arrow-left" size={16} />Use a different email</a>
    </form>
  );
}
