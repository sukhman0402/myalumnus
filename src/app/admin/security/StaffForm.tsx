"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, FormError, Select, SubmitButton } from "@/components/Field";
import { saveStaff, type FormState } from "./actions";

export type StaffValues = { id: string; role: string; name: string; email: string; gate: string; shift: string; signedIn: boolean };
const ROLES: [string, string, string][] = [
  ["guard", "Guard", "Taps their name on the gate iPad at the start of a shift. No email or password."],
  ["gate", "Gate device", "The iPad at a gate. It stays signed in with this email; guards take turns on it."],
  ["admin", "Admin", "Uses this console. Signs in with a code sent to their email."],
];

/** Add or edit a console account. The role is fixed once created; a signed-in account's email is fixed too. */
export function StaffForm({ initial, gates }: { initial: StaffValues; gates: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveStaff, {});
  const err = state.fields ?? {};
  const count = Object.keys(err).length;
  const v = (k: keyof StaffValues) => state.values?.[k] ?? String(initial[k] ?? "");
  const [role, setRole] = useState(v("role"));
  const editing = Boolean(initial.id);

  return (
    <form className="ma-form" action={action} noValidate key={JSON.stringify(state.values ?? {})}>
      <FormError count={count} error={count ? undefined : state.error} />
      <input type="hidden" name="id" value={initial.id} />
      {editing ? <input type="hidden" name="role" value={initial.role} /> : (
        <fieldset className="ma-field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="ma-field__label">This account is for</legend>
          {ROLES.map(([r, l, d]) => (
            <label key={r} className="ma-form__check">
              <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} />
              <span><b>{l}</b><small>{d}</small></span>
            </label>
          ))}
          {err.role ? <p className="ma-field__help" role="alert">{err.role}</p> : null}
        </fieldset>
      )}
      <div className="ma-form__2">
        <Field id="s-name" name="name" label={role === "gate" ? "Device name" : "Name"} defaultValue={v("name")} maxLength={80} autoComplete="off" error={err.name}
          help={role === "guard" ? "As it should appear on the gate's name list, e.g. R. Sharma." : role === "gate" ? "e.g. Gate 1 iPad" : undefined} />
        {role !== "admin" ? (
          <Select id="s-gate" name="gate" label="Gate" options={[["", "Pick a gate"], ...gates.map((g): [string, string] => [g.id, g.name])]}
            defaultValue={v("gate")} error={err.gate} help={role === "guard" && editing ? "Moving a guard ends any shift they have open." : undefined} />
        ) : null}
      </div>
      {role === "guard" ? (
        <Field id="s-shift" name="shift" label="Usual shift (optional)" defaultValue={v("shift")} maxLength={40} autoComplete="off"
          help="Shown next to their name, e.g. 08:00 AM–04:00 PM." />
      ) : (
        <Field id="s-email" name="email" label="Email" type="email" defaultValue={v("email")} maxLength={200} autoComplete="off" error={err.email}
          readOnly={initial.signedIn} aria-readonly={initial.signedIn || undefined}
          help={initial.signedIn ? "This account has signed in, so its email can't change." : role === "gate"
            ? "Sign the iPad in with this email; the code arrives in its inbox. A Gmail alias like name+gate1@gmail.com works."
            : "They sign in at this site with a code sent here."} />
      )}
      <div className="ma-actions">
        <Link className="ma-btn ma-btn--secondary" href="/admin/security">Cancel</Link>
        <SubmitButton pending={pending} icon="check">{editing ? "Save changes" : "Add account"}</SubmitButton>
      </div>
    </form>
  );
}
