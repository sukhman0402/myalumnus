"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Field, FormError, Select, SubmitButton } from "@/components/Field";
import { savePerson, type FormState } from "./actions";

export type PersonValues = {
  id: string; kind: string; name: string; roll: string; batch: string; program: string; phone: string; email: string; active: boolean;
};

const TYPES: [string, string][] = [["alumnus", "Alumnus"], ["student", "Current student"], ["faculty", "Visiting faculty"], ["placement", "Placement visitor"]];

/** Add or edit a record (mockups a08, a09). Errors appear under each field and in a summary; nothing typed is lost. */
export function PersonForm({ initial }: { initial: PersonValues }) {
  const [state, action, pending] = useActionState<FormState, FormData>(savePerson, {});
  const v = (k: keyof PersonValues) => state.values?.[k] ?? String(initial[k] ?? "");
  const [kind, setKind] = useState(initial.kind);
  const err = state.fields ?? {};
  const count = Object.keys(err).length;
  const active = state.values ? state.values.active === "on" : initial.active;
  // React resets an uncontrolled form after its action runs; the key makes it re-read the returned values.
  const key = JSON.stringify(state.values ?? {});
  const isPerson = kind === "alumnus" || kind === "student";

  return (
    <form className="ma-form" action={action} noValidate key={key}>
      <FormError count={count} error={count ? undefined : state.error} />
      <input type="hidden" name="id" value={initial.id} />
      <div className="ma-form__2">
        <Select id="f-kind" name="kind" label="Type" options={TYPES} defaultValue={v("kind")} error={err.kind}
          onChange={(e) => setKind(e.target.value)}
          help={kind === "student" ? "Current students are found by roll number when their family visits." : "Shown to the guard next to the name."} />
        <Field id="f-name" name="name" label="Full name" defaultValue={v("name")} maxLength={120} autoComplete="off" error={err.name}
          help="As it appears on university records." />
      </div>
      <div className="ma-form__2">
        <Field id="f-roll" name="roll" label={kind === "student" ? "Roll number" : "Roll number (optional)"} defaultValue={v("roll")} maxLength={40}
          autoComplete="off" error={err.roll} help={isPerson ? "Bulk uploads match records by roll number." : undefined} />
        <Field id="f-batch" name="batch" label={kind === "alumnus" ? "Batch (graduation year)" : kind === "student" ? "Expected graduation year (optional)" : "Batch (optional)"}
          defaultValue={v("batch")} inputMode="numeric" maxLength={4} autoComplete="off" error={err.batch} help={kind === "alumnus" ? "4 digits, e.g. 2019." : undefined} />
      </div>
      <Field id="f-program" name="program" label={isPerson ? "Programme and department" : "Detail shown to the guard"} defaultValue={v("program")} maxLength={120}
        autoComplete="off" error={err.program} help={isPerson ? "e.g. B.Tech Mechanical Engineering" : "e.g. Department of Physics, or TechNova Ltd"} />
      <div className="ma-form__2">
        <Field id="f-phone" name="phone" label="Phone (optional)" type="tel" inputMode="tel" defaultValue={v("phone")} maxLength={24} error={err.phone}
          help="Shown to the gate only while this person is inside after visiting hours." />
        <Field id="f-email" name="email" label="Email (optional)" type="email" defaultValue={v("email")} maxLength={200} error={err.email} />
      </div>
      <label className="ma-form__check">
        <input type="checkbox" name="active" defaultChecked={active} />
        <span><b>Show at the gate</b><small>Turn off to hide this record from gate search. Past visits stay in History; records are never deleted.</small></span>
      </label>
      <div className="ma-actions">
        <Link className="ma-btn ma-btn--secondary" href="/admin/alumni">Cancel</Link>
        <SubmitButton pending={pending} icon="check">{initial.id ? "Save changes" : "Add record"}</SubmitButton>
      </div>
    </form>
  );
}
