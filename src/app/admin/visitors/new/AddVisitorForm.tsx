"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Icon } from "@/components/Icon";
import { Field, FormError, Select, SubmitButton } from "@/components/Field";
import { KIND_LABEL } from "@/lib/format";
import { addExpected, lookupPeople, type FormState, type PersonHit } from "../actions";

const TYPES: [string, string][] = [["faculty", "Visiting faculty or guest speaker"], ["placement", "Placement visitor"], ["alumnus", "Alumnus"]];

/**
 * Add an expected visitor (mockup a19). Typing a name shows existing records to pick, so the guard sees one
 * record with its photo; otherwise a new record is made from the name and type.
 */
export type HostOption = { id: string; name: string; department: string | null; phone: string | null };

export function AddVisitorForm({ gates, today, hosts }: { gates: { id: string; name: string }[]; today: string; hosts: HostOption[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addExpected, {});
  const err = state.fields ?? {};
  const count = Object.keys(err).length;
  const v = (k: string, d = "") => state.values?.[k] ?? d;
  const [name, setName] = useState(v("name"));
  const [picked, setPicked] = useState<{ id: string; label: string } | null>(v("person") ? { id: v("person"), label: v("person_label") } : null);
  const [hits, setHits] = useState<{ q: string; rows: PersonHit[] }>({ q: "", rows: [] });
  const [hostId, setHostId] = useState(v("host_id"));
  const host = hosts.find((h) => h.id === hostId);
  const q = name.trim();

  useEffect(() => {
    if (picked || q.length < 3) return;
    let stale = false;
    const t = setTimeout(async () => {
      const rows = await lookupPeople(q).catch(() => []);
      if (!stale) setHits({ q, rows });
    }, 250);
    return () => { stale = true; clearTimeout(t); };
  }, [q, picked]);
  const shown = !picked && q.length >= 3 && hits.q === q ? hits.rows : [];

  return (
    <form className="ma-form" action={action} noValidate key={JSON.stringify(state.values ?? {})}>
      <FormError count={count} error={count ? undefined : state.error} />
      <input type="hidden" name="person" value={picked?.id ?? ""} />
      <input type="hidden" name="person_label" value={picked?.label ?? ""} />
      {picked ? (
        <div className="ma-field">
          <span className="ma-field__label">Visitor</span>
          <div className="ma-picked"><span className="ma-chip ma-chip--success"><span className="ma-circle"><Icon name="check" /></span><span>{picked.label}</span></span>
            <button type="button" className="ma-btn ma-btn--secondary" onClick={() => { setPicked(null); setName(""); }}>Change</button></div>
        </div>
      ) : (
        <>
          <div className="ma-form__2">
            <Field id="v-name" name="name" label="Visitor's full name" value={name} onChange={(e) => setName(e.target.value)} maxLength={120}
              autoComplete="off" error={err.name} help="Type 3 letters to see matching records." />
            <Select id="v-kind" name="kind" label="Type" options={TYPES} defaultValue={v("kind", "faculty")} error={err.kind} />
          </div>
          {shown.length ? (
            <div className="ma-sub" role="group" aria-labelledby="v-match">
              <h3 className="ma-sub__title" id="v-match">Already on record? Pick one</h3>
              <ul className="ma-lookup">
                {shown.map((h) => {
                  const label = `${h.full_name} · ${KIND_LABEL[h.kind]}${h.batch_year ? ` ${h.batch_year}` : ""}`;
                  return (
                    <li key={h.id}><button type="button" className="ma-row" onClick={() => setPicked({ id: h.id, label })}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {h.photo ? <span className="ma-row__photo ma-row__photo--img"><img src={h.photo} alt="" /></span> : <span className="ma-row__photo"><Icon name="user" /></span>}
                      <span className="ma-row__text"><b>{h.full_name}</b><span>{KIND_LABEL[h.kind]}{h.program ? ` · ${h.program}` : ""}{h.batch_year ? ` · ${h.batch_year}` : ""}</span></span>
                      <span className="ma-row__chev"><Icon name="chevron-right" /></span>
                    </button></li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          <Field id="v-program" name="program" label="Department or organisation (optional)" defaultValue={v("program")} maxLength={120} autoComplete="off"
            help="e.g. Department of Physics, or TechNova Ltd." />
        </>
      )}
      <div className="ma-form__2">
        <Field id="v-date" name="date" label="Date" type="date" min={today} defaultValue={v("date", today)} error={err.date} />
        <Field id="v-time" name="time" label="Expected time" type="time" defaultValue={v("time")} error={err.time} help="Campus time." />
      </div>
      <Select id="v-gate" name="gate" label="Gate" options={[["", "Any gate"], ...gates.map((g): [string, string] => [g.id, g.name])]} defaultValue={v("gate")} />
      {/* Host from the hosts list (owner, 2026-10-08); the phone comes with them. The list lives in the database only:
          set up once, people added or removed there by hand, no screen in the console. */}
      <div className="ma-form__2">
        <Select id="v-host" name="host_id" label="Host on campus" value={hostId} onChange={(e) => setHostId(e.target.value)} error={err.host}
          options={[["", "Pick a host"], ...hosts.map((h): [string, string] => [h.id, h.department ? `${h.name} · ${h.department}` : h.name])]}
          help={hosts.length ? undefined : "The hosts list is empty. Ask the system administrator to add the faculty."} />
        <Field id="v-hostp" label="Host's phone" type="tel" value={host?.phone ?? ""} readOnly aria-readonly placeholder="Filled in from the host"
          help={host ? "From the hosts list." : undefined} />
      </div>
      <Field id="v-purpose" name="purpose" label="Purpose (optional)" defaultValue={v("purpose")} maxLength={200} autoComplete="off" help="e.g. Guest lecture, Room 204" />
      <div className="ma-actions">
        <Link className="ma-btn ma-btn--secondary" href="/admin/visitors">Cancel</Link>
        <SubmitButton pending={pending} icon="check">Add visitor</SubmitButton>
      </div>
    </form>
  );
}
