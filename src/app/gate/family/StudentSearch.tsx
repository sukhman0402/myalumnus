"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { tr, type Lang } from "@/lib/i18n";
import { searchStudents, type StudentHit } from "../actions";

/** Student lookup by name or roll number, after 3 characters (same pattern as the visitor search). */
export function StudentSearch({ lang }: { lang: Lang }) {
  const [q, setQ] = useState("");
  const [result, setResult] = useState<{ term: string; ok: boolean; hits: StudentHit[] } | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const term = q.trim();
  useEffect(() => {
    if (term.length < 3) return;
    let stale = false;
    const timer = setTimeout(async () => {
      try { const r = await searchStudents(term); if (!stale) setResult({ term, ok: r.ok, hits: r.ok ? r.hits : [] }); }
      catch { if (!stale) setResult({ term, ok: false, hits: [] }); }
    }, 250);
    return () => { stale = true; clearTimeout(timer); };
  }, [term]);
  const status = !term ? "idle" : term.length < 3 ? "short" : result?.term !== term ? "busy" : result.ok ? "done" : "error";
  const hits = status === "done" && result ? result.hits : [];
  const help = status === "idle" ? tr(lang, "search.help.idle") : status === "short" ? tr(lang, "search.help.short")
    : status === "busy" ? tr(lang, "search.help.busy") : status === "error" ? tr(lang, "search.help.error")
    : hits.length === 0 ? tr(lang, "search.help.none") : hits.length === 1 ? tr(lang, "fam.found", { n: 1 }) : tr(lang, "fam.found.n", { n: hits.length });
  return (
    <>
      <div className={`ma-field${status === "busy" ? " is-busy" : ""}${status === "error" ? " is-error" : ""}`}>
        <label className="ma-field__label" htmlFor="sq">{tr(lang, "fam.search")}</label>
        <div className="ma-field__box">
          <span className="ma-field__icon"><Icon name="search" /></span>
          <input ref={input} id="sq" type="search" autoComplete="off" spellCheck={false} autoFocus maxLength={80} placeholder=" "
            aria-describedby="sq-h" value={q} onChange={(e) => setQ(e.target.value)} />
          {status === "busy" ? <span className="ma-field__spin ma-spin"><Icon name="loader-circle" /></span> : null}
          <button type="button" className="ma-field__clear" aria-label={tr(lang, "search.clear")} onClick={() => { setQ(""); input.current?.focus(); }}><Icon name="x" /></button>
        </div>
        <p className="ma-field__help" id="sq-h" aria-live="polite"><Icon name={status === "error" ? "circle-alert" : "info"} size={16} />{help}</p>
      </div>
      {status === "done" && hits.length ? (
        <ul className="ma-list">
          {hits.map((s) => (
            <li key={s.id}>
              <Link className="ma-row" href={`/gate/family/${s.id}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {s.photo ? <span className="ma-row__photo ma-row__photo--img"><img src={s.photo} alt="" /></span> : <span className="ma-row__photo"><Icon name="user" /></span>}
                <span className="ma-row__text"><b>{s.full_name}</b>
                  <span>{[tr(lang, "kind.student"), s.program, s.roll_no ? tr(lang, "kv.roll", { r: s.roll_no }) : null].filter(Boolean).join(" · ")}</span></span>
                <span className="ma-row__chev"><Icon name="chevron-right" /></span>
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
      {status === "done" && !hits.length ? (
        <div className="ma-sub" role="status">
          <h3 className="ma-sub__title">{tr(lang, "fam.none", { q: term })}</h3>
          <p className="ma-note">{tr(lang, "fam.none.sub")}</p>
        </div>
      ) : null}
    </>
  );
}
