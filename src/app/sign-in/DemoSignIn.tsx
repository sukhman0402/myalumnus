"use client";

import { useActionState, useState } from "react";
import { Icon } from "@/components/Icon";
import { DEMO_PROFILES, type DemoRole } from "@/lib/demo";
import { demoSignIn, type DemoState } from "./demo-actions";

const start: DemoState = {};

/** Two demo profiles. The User ID and Password boxes accept anything and are never sent (no name attribute). */
export function DemoSignIn() {
  const [role, setRole] = useState<DemoRole>("guard");
  const [state, action, pending] = useActionState(demoSignIn, start);
  const profile = DEMO_PROFILES[role];
  return (
    <form action={action} className="ma-form" noValidate>
      <fieldset className="ma-demo__roles">
        <legend className="ma-field__label">Sign in as</legend>
        <div className="ma-demo__grid">
        {(Object.keys(DEMO_PROFILES) as DemoRole[]).map((r) => (
          <label key={r} className="ma-role">
            <input type="radio" name="role" value={r} checked={role === r} onChange={() => setRole(r)} className="ma-visually-hidden" />
            <span className="ma-role__icon"><Icon name={DEMO_PROFILES[r].icon} /></span>
            <b>{DEMO_PROFILES[r].name}</b>
            <span className="ma-role__detail">{DEMO_PROFILES[r].detail}</span>
          </label>
        ))}
        </div>
      </fieldset>
      <div className="ma-field">
        <label className="ma-field__label" htmlFor="demo-user">User ID</label>
        <div className="ma-field__box"><input key={`u-${role}`} id="demo-user" defaultValue={profile.userId} autoComplete="off" spellCheck={false} /></div>
      </div>
      <div className="ma-field">
        <label className="ma-field__label" htmlFor="demo-pass">Password</label>
        <div className="ma-field__box"><input key={`p-${role}`} id="demo-pass" type="password" defaultValue="demo-password" autoComplete="off" /></div>
      </div>
      {state.error ? (
        <div className="ma-banner ma-banner--danger" role="alert">
          <span className="ma-circle"><Icon name="circle-alert" /></span><span className="ma-banner__text">{state.error}</span>
        </div>
      ) : null}
      <button type="submit" className="ma-btn ma-btn--primary ma-btn--block" disabled={pending}>
        <Icon name="arrow-right" />{pending ? "Signing in…" : `Sign in as ${role === "guard" ? "Guard" : "Admin"}`}
      </button>
    </form>
  );
}
