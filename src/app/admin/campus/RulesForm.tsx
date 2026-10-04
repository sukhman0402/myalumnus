"use client";

import { useActionState } from "react";
import { Field, FormError, SubmitButton } from "@/components/Field";
import { saveRules, type FormState } from "./actions";

export function RulesForm({ campus, open, close, minutes }: { campus: string; open: string; close: string; minutes: number }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveRules, {});
  const err = state.fields ?? {};
  const count = Object.keys(err).length;
  const v = (k: string, d: string) => state.values?.[k] ?? d;
  return (
    <form className="ma-form" action={action} noValidate key={JSON.stringify(state.values ?? {})}>
      <FormError count={count} error={count ? undefined : state.error} />
      <input type="hidden" name="campus" value={campus} />
      <div className="ma-form__2">
        <Field id={`o-${campus}`} name="open" label="Visiting hours start" type="time" defaultValue={v("open", open)} error={err.open}
          help="Guards can approve from this time." />
        <Field id={`c-${campus}`} name="close" label="Visiting hours end" type="time" defaultValue={v("close", close)} error={err.close}
          help="After this, Approve is locked and anyone still inside shows as an overstay." />
      </div>
      <Field id={`m-${campus}`} name="minutes" label="Admin escalation time, in minutes" inputMode="numeric" maxLength={2} defaultValue={v("minutes", String(minutes))}
        error={err.minutes} help="If no admin decides a held visitor in this time, the guard calls the visitor's host." />
      <div className="ma-actions"><SubmitButton pending={pending} icon="check">Save rules</SubmitButton></div>
    </form>
  );
}
