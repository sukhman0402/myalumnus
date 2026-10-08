"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { Icon } from "@/components/Icon";
import { DEMO_MODE } from "@/lib/demo";
import { toGatePhoto } from "@/lib/resize";
import { bulkSave, rollLookup, uploadPhoto, type Existing } from "../actions";
import { COL_LABEL, matchColumns, parseCsv, readRows, REQUIRED, type ColKey, type Parsed } from "./csv";

type Read = { file: string; header: string[]; cols: Partial<Record<ColKey, number>>; rows: Parsed[]; existing: Map<string, Existing> };
const MAX = 5000;
const CHUNK = 500;

function Note({ kind, icon, children }: { kind: "success" | "danger" | "escalation"; icon: string; children: React.ReactNode }) {
  return (
    <div className={`ma-banner ma-banner--${kind}`} role={kind === "danger" ? "alert" : "status"}>
      <span className="ma-circle"><Icon name={icon} /></span><span className="ma-banner__text">{children}</span>
    </div>
  );
}

/**
 * Bulk upload (mockup a17, Q9): choose the file, check every row, then save. Nothing is saved before "Save".
 * Rows with problems are listed and skipped; matching roll numbers update the existing record.
 */
export function BulkUpload() {
  const router = useRouter();
  const uid = useId();
  const [kind, setKind] = useState<"alumnus" | "student">("alumnus");
  const [read, setRead] = useState<Read | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState<{ inserted: number; updated: number; skipped: number } | null>(null);

  const onFile = async (file: File | undefined) => {
    setRead(null); setError(null); setDone(null);
    if (!file) return;
    if (/\.(xlsx?|ods|numbers)$/i.test(file.name)) {
      setError("This is a spreadsheet file, not CSV. In Excel: File › Save As › “CSV UTF-8”. In Google Sheets: File › Download › CSV. Then choose that file.");
      return;
    }
    if (file.size > 5_000_000) { setError("The file is larger than 5 MB. Split it into smaller files of up to 5,000 rows."); return; }
    setBusy("Reading the file…");
    try {
      const table = parseCsv(await file.text());
      if (table.length < 2) { setError("The file has no rows under the header line."); return; }
      if (table.length - 1 > MAX) { setError(`The file has ${(table.length - 1).toLocaleString("en-IN")} rows. Upload at most ${MAX.toLocaleString("en-IN")} at a time.`); return; }
      const cols = matchColumns(table[0]);
      const rows = readRows(table, cols);
      const rolls = [...new Set(rows.filter((r) => r.roll_no).map((r) => r.roll_no))];
      const existing = new Map<string, Existing>();
      if (REQUIRED.every((k) => cols[k] !== undefined) && rolls.length) {
        setBusy("Checking roll numbers against existing records…");
        const res = await rollLookup(rolls);
        if (!res.ok) { setError("Couldn't check the roll numbers. Check the connection and try again."); return; }
        res.rows.forEach((r) => existing.set(r.roll_no.toUpperCase(), r));   // roll numbers match whatever their case
      }
      setRead({ file: file.name, header: table[0], cols, rows, existing });
    } catch {
      setError("That file couldn't be read. Save it as CSV (UTF-8) and try again.");
    } finally {
      setBusy(null);
    }
  };

  const good = read ? read.rows.filter((r) => !r.problems.length) : [];
  const bad = read ? read.rows.filter((r) => r.problems.length) : [];
  const ex = (r: Parsed) => read?.existing.get(r.roll_no.toUpperCase());
  const updates = good.filter((r) => ex(r));
  const becomeAlumni = kind === "alumnus" ? updates.filter((r) => ex(r)?.kind === "student").length : 0;
  const otherTypeChanges = updates.filter((r) => ex(r)?.kind !== kind && !(kind === "alumnus" && ex(r)?.kind === "student")).length;
  const missing = read ? REQUIRED.filter((k) => read.cols[k] === undefined) : [];

  const save = async () => {
    if (!read || !good.length || busy) return;   // one save at a time, however many taps
    setBusy("Saving…"); setError(null); setProgress(0);
    let inserted = 0, updated = 0;
    for (let i = 0; i < good.length; i += CHUNK) {
      const part = good.slice(i, i + CHUNK).map(({ full_name, roll_no, batch_year, program, email, phone }) =>
        ({ full_name, roll_no, batch_year, program, ...(email ? { email } : {}), ...(phone ? { phone } : {}) }));
      const r = await bulkSave(kind, part).catch(() => ({ ok: false as const, error: "Couldn't reach the server. Check the connection." }));
      if (!r.ok) {
        setBusy(null);
        setError(`${r.error} ${i ? `${i.toLocaleString("en-IN")} rows were saved before this; uploading the same file again updates them, it doesn't duplicate them.` : "Nothing was saved."}`);
        return;
      }
      inserted += r.inserted; updated += r.updated;
      setProgress(Math.min(good.length, i + CHUNK));
    }
    setBusy(null);
    setDone({ inserted, updated, skipped: bad.length });
    setRead(null);
    router.refresh();
  };

  return (
    <>
      <section className="ma-panel" aria-labelledby={`${uid}-a`}>
        <h2 className="ma-panel__title" id={`${uid}-a`}>1. Records from a spreadsheet</h2>
        <fieldset className="ma-field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="ma-field__label">These rows are</legend>
          <div className="ma-actions">
            {([["alumnus", "Alumni (a graduating batch)"], ["student", "Current students"]] as const).map(([k, l]) => (
              <label key={k} className="ma-form__check"><input type="radio" name={`${uid}-kind`} checked={kind === k} onChange={() => setKind(k)} disabled={Boolean(busy)} /><span><b>{l}</b></span></label>
            ))}
          </div>
        </fieldset>
        <div className="ma-drop">
          <Icon name="file-up" size={32} />
          <b>Choose a CSV file</b>
          <span className="ma-note">Required columns: full name, roll number, batch year, programme. Optional: email, phone. Header names are matched for you. Up to {MAX.toLocaleString("en-IN")} rows.</span>
          <input id={`${uid}-f`} className="ma-file" type="file" accept=".csv,text/csv" disabled={Boolean(busy)} onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
          <label htmlFor={`${uid}-f`} className="ma-btn ma-btn--primary" aria-disabled={busy ? "true" : undefined}><Icon name="upload" />Choose file</label>
        </div>
        <p className="ma-field__help"><Icon name="info" size={16} />From Excel: File › Save As › “CSV UTF-8”.</p>

        {busy ? <p className="ma-note" role="status"><Icon name="loader-circle" size={16} className="ma-spin" /> {busy}{progress ? ` ${progress.toLocaleString("en-IN")} of ${good.length.toLocaleString("en-IN")}` : ""}</p> : null}
        {busy && progress ? <progress className="ma-progress" max={good.length} value={progress} aria-label="Saved rows" /> : null}
        {error ? <Note kind="danger" icon="circle-alert">{error}</Note> : null}
        {done ? (
          <Note kind="success" icon="check">
            <b>Saved.</b> {done.inserted.toLocaleString("en-IN")} new, {done.updated.toLocaleString("en-IN")} updated{done.skipped ? `, ${done.skipped} skipped` : ""}. The gate can search them now. Add their photos below, or <Link className="ma-link" href="/admin/alumni">go to People</Link>.
          </Note>
        ) : null}

        {read ? (
          <div className="ma-sub" role="group" aria-labelledby={`${uid}-c`}>
            <h3 className="ma-sub__title" id={`${uid}-c`}>Check before saving · {read.file}</h3>
            <dl className="ma-kv">
              {(Object.keys(COL_LABEL) as ColKey[]).map((k) => (
                <div key={k} style={{ display: "contents" }}>
                  <dt>{COL_LABEL[k]}</dt>
                  <dd>{read.cols[k] !== undefined ? <>column “{read.header[read.cols[k]!]}”</> : REQUIRED.includes(k) ? <b>Not found</b> : "Not in this file"}</dd>
                </div>
              ))}
            </dl>
            {missing.length ? (
              <Note kind="danger" icon="circle-alert">
                <b>Can&apos;t use this file yet.</b> No column for {missing.map((k) => COL_LABEL[k].toLowerCase()).join(", ")}. Rename that header in the spreadsheet (e.g. “Roll number”, “Batch year”) and choose the file again.
              </Note>
            ) : (
              <>
                <p className="ma-note ma-tabular">
                  {read.rows.length.toLocaleString("en-IN")} rows: <b>{(good.length - updates.length).toLocaleString("en-IN")} new</b>, <b>{updates.length.toLocaleString("en-IN")} update existing records</b>
                  {becomeAlumni ? ` (${becomeAlumni === 1 ? "1 current student becomes an alumnus" : `${becomeAlumni} current students become alumni`})` : ""}
                  {otherTypeChanges ? <>, <b>{otherTypeChanges} change type to {kind === "alumnus" ? "alumnus" : "current student"}</b></> : null}{bad.length ? <>, <b>{bad.length.toLocaleString("en-IN")} have problems and will be skipped</b></> : null}.
                </p>
                {bad.length ? (
                  <div className="ma-rows-scroll" tabIndex={0} role="region" aria-label="Rows with problems">
                    <ul className="ma-next">{bad.slice(0, 100).map((r) => <li key={r.line}>Line {r.line}{r.full_name ? ` (${r.full_name})` : ""}: {r.problems.join(", ")}</li>)}</ul>
                    {bad.length > 100 ? <p className="ma-note">…and {bad.length - 100} more.</p> : null}
                  </div>
                ) : null}
                {good.length ? (
                  <div className="ma-tablecard">
                    <div className="ma-table-wrap ma-rows-scroll" tabIndex={0} role="region" aria-label="Rows to save (first 50)">
                      <table className="ma-table">
                        <thead><tr><th>Line</th><th>Name</th><th>Roll no.</th><th>Batch</th><th>Programme</th><th>Will</th></tr></thead>
                        <tbody>
                          {good.slice(0, 50).map((r) => {
                            const e2 = ex(r);
                            return (
                              <tr key={r.line} style={{ cursor: "default" }}>
                                <td className="ma-tabular">{r.line}</td><td>{r.full_name}</td><td className="ma-tabular">{r.roll_no}</td>
                                <td className="ma-tabular">{r.batch_year}</td><td>{r.program}</td>
                                <td>{e2 ? `Update ${e2.full_name === r.full_name ? "record" : `“${e2.full_name}”`}` : "Add"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : null}
                <div className="ma-actions">
                  <button type="button" className="ma-btn ma-btn--secondary" onClick={() => setRead(null)} disabled={Boolean(busy)}>Cancel</button>
                  <button type="button" className="ma-btn ma-btn--primary" onClick={save} aria-disabled={busy || !good.length ? "true" : undefined}>
                    <Icon name={busy ? "loader-circle" : "check"} className={busy ? "ma-spin" : undefined} />Save {good.length.toLocaleString("en-IN")} {good.length === 1 ? "record" : "records"}
                  </button>
                </div>
              </>
            )}
          </div>
        ) : null}
      </section>
      {DEMO_MODE ? null : <PhotoBatch />}
    </>
  );
}

/** Photos named by roll number (e.g. 19BME112.jpg), matched to records and uploaded one by one. */
function PhotoBatch() {
  const uid = useId();
  const router = useRouter();
  const [state, setState] = useState<{ total: number; done: number; saved: number; unmatched: string[]; failed: string[] } | null>(null);
  const busy = state !== null && state.done < state.total;

  const onFiles = async (list: FileList | null) => {
    const files = [...(list ?? [])].filter((f) => /^image\/(jpeg|png|webp)$/.test(f.type));
    if (!files.length) return;
    const stem = (f: File) => f.name.replace(/\.[^.]+$/, "").trim();
    setState({ total: files.length, done: 0, saved: 0, unmatched: [], failed: [] });
    const res = await rollLookup([...new Set(files.flatMap((f) => [stem(f), stem(f).toUpperCase()]))].slice(0, 5000)).catch(() => ({ ok: false as const }));
    const byRoll = new Map<string, string>();
    if (res.ok) res.rows.forEach((r) => byRoll.set(r.roll_no.toLowerCase(), r.id));
    let saved = 0;
    const unmatched: string[] = [], failed: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const id = byRoll.get(stem(f).toLowerCase());
      if (!id) unmatched.push(f.name);
      else {
        try {
          const fd = new FormData();
          fd.set("photo", new File([await toGatePhoto(f)], "photo.jpg", { type: "image/jpeg" }));
          const r = await uploadPhoto(id, fd);
          if (r.ok) saved++; else failed.push(f.name);
        } catch { failed.push(f.name); }
      }
      setState({ total: files.length, done: i + 1, saved, unmatched: [...unmatched], failed: [...failed] });
    }
    router.refresh();
  };

  return (
    <section className="ma-panel" aria-labelledby={`${uid}-p`}>
      <h2 className="ma-panel__title" id={`${uid}-p`}>2. Photos (optional)</h2>
      <p className="ma-note">Choose image files named by roll number, e.g. <span className="ma-tabular">19BME112.jpg</span>. Each is matched to its record, cropped to the 3:4 frame the guard sees and resized before upload. A new photo replaces the old one.</p>
      <div className="ma-actions">
        <input id={`${uid}-pf`} className="ma-file" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={busy} onChange={(e) => { onFiles(e.target.files); e.target.value = ""; }} />
        <label htmlFor={`${uid}-pf`} className="ma-btn ma-btn--secondary" aria-disabled={busy ? "true" : undefined}><Icon name="upload" />Choose photos</label>
      </div>
      {state ? (
        <div role="status">
          {busy ? <><p className="ma-note ma-tabular"><Icon name="loader-circle" size={16} className="ma-spin" /> Uploading {state.done} of {state.total}…</p>
            <progress className="ma-progress" max={state.total} value={state.done} aria-label="Photos processed" /></> : (
            <Note kind={state.unmatched.length || state.failed.length ? "escalation" : "success"} icon={state.unmatched.length || state.failed.length ? "triangle-alert" : "check"}>
              <b>{state.saved} {state.saved === 1 ? "photo" : "photos"} saved.</b>
              {state.unmatched.length ? ` ${state.unmatched.length} didn't match a roll number: ${state.unmatched.slice(0, 10).join(", ")}${state.unmatched.length > 10 ? "…" : ""}.` : ""}
              {state.failed.length ? ` ${state.failed.length} couldn't be uploaded: ${state.failed.slice(0, 10).join(", ")}. Try those again.` : ""}
            </Note>
          )}
        </div>
      ) : null}
    </section>
  );
}
