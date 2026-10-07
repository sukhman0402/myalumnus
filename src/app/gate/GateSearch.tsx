"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { HoldLink } from "@/components/HoldLink";
import { tr, type Lang } from "@/lib/i18n";
import { fmtTime, personMeta } from "@/lib/format";
import { getRoster as getRosterAction, searchPeople, type SearchHit } from "./actions";
import { getRoster, isNetworkError, putRoster, searchRoster, type Roster, type RosterRow } from "@/lib/offline";
import { OfflineDecide } from "./OfflineDecide";

type Status = "idle" | "short" | "busy" | "done" | "error" | "offline";
const ROSTER_MAX_AGE = 60 * 60 * 1000; // refreshed at least hourly, and whenever a different guard is on duty

/**
 * The guard's search box (mockups g01, g03, g04, g11). Results appear after 3 letters, 250 ms after the
 * last key press. The query is kept in the address (?q=) so "Search results" on a record comes back here.
 */
export function GateSearch({ lang, initialQuery, guard, hours }: {
  lang: Lang; initialQuery: string; guard: string; hours: { open: string; close: string };
}) {
  const [q, setQ] = useState(initialQuery);
  const [result, setResult] = useState<{ term: string; ok: boolean; hits: SearchHit[]; offline?: RosterRow[] } | null>(null);
  const [roster, setRoster] = useState<Roster | null>(null);
  const [picked, setPicked] = useState<RosterRow | null>(null);
  const [saved, setSaved] = useState<{ name: string; at: string } | null>(null);
  const [open, setOpen] = useState(true);   // the results layer; closes on a tap outside or Esc, opens again on focus
  const input = useRef<HTMLInputElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const rosterRef = useRef<Roster | null>(null);
  const term = q.trim();

  // The offline list (D11): read what this iPad saved, then refresh it if it's old or from another guard's shift.
  useEffect(() => {
    let alive = true;
    (async () => {
      const cached = await getRoster().catch(() => undefined);
      if (cached && alive) { rosterRef.current = cached; setRoster(cached); }
      if (cached && cached.guard === guard && Date.now() - Date.parse(cached.at) < ROSTER_MAX_AGE) return;
      const r = await getRosterAction().catch(() => ({ ok: false as const }));
      if (!r.ok || !alive) return;
      const fresh = { at: new Date().toISOString(), guard, rows: r.rows };
      rosterRef.current = fresh; setRoster(fresh);
      await putRoster(fresh).catch(() => undefined);
    })();
    return () => { alive = false; };
  }, [guard]);

  useEffect(() => {
    window.history.replaceState(window.history.state, "", term ? `/gate?q=${encodeURIComponent(term)}` : "/gate");
    if (term.length < 3) return;
    let stale = false; // a newer keystroke replaces this request
    const offline = () => ({ term, ok: true, hits: [], offline: rosterRef.current ? searchRoster(rosterRef.current.rows, term) : [] });
    const timer = setTimeout(async () => {
      if (!navigator.onLine) { if (!stale) setResult(offline()); return; }
      try {
        const res = await searchPeople(term);
        if (!stale) setResult({ term, ok: res.ok, hits: res.ok ? res.hits : [] });
      } catch (e) {
        if (!stale) setResult(isNetworkError(e) ? offline() : { term, ok: false, hits: [] });
      }
    }, 250);
    return () => { stale = true; clearTimeout(timer); };
  }, [term]);

  useEffect(() => {
    const down = (e: PointerEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("pointerdown", down);
    return () => document.removeEventListener("pointerdown", down);
  }, []);

  const status: Status = !term ? "idle" : term.length < 3 ? "short"
    : result?.term !== term ? "busy" : result.offline ? "offline" : result.ok ? "done" : "error";
  const offRows = status === "offline" && result?.offline ? result.offline : [];
  const hits = status === "done" && result ? result.hits : [];
  const n = hits.length;
  const help = status === "idle" ? tr(lang, "search.help.idle")
    : status === "short" ? tr(lang, "search.help.short")
    : status === "busy" ? tr(lang, "search.help.busy")
    : status === "error" ? tr(lang, "search.help.error")
    : status === "offline" ? tr(lang, "off.banner.b")
    : n === 0 ? tr(lang, "search.help.none") : n === 1 ? tr(lang, "search.help.one") : tr(lang, "search.help.count", { n });

  // People who share a name are never listed separately: the guard asks first (mockup g10).
  const groups: SearchHit[][] = [];
  const byName = new Map<string, SearchHit[]>();
  for (const h of hits) {
    const k = h.full_name.toLowerCase();
    if (!byName.has(k)) { byName.set(k, []); groups.push(byName.get(k)!); }
    byName.get(k)!.push(h);
  }
  const back = `?q=${encodeURIComponent(term)}`;

  if (picked) {
    return <OfflineDecide lang={lang} row={picked} guard={guard} hours={hours} onBack={() => setPicked(null)}
      onSaved={(name, at) => { setPicked(null); setSaved({ name, at }); setQ(""); }} />;
  }

  return (
    <>
      {saved ? (
        <div className="ma-banner ma-banner--success" role="status">
          <span className="ma-circle"><Icon name="check" /></span>
          <span className="ma-banner__text"><b>{tr(lang, "off.saved.b", { n: saved.name, t: fmtTime(saved.at) })}</b> {tr(lang, "off.saved")}</span>
        </div>
      ) : null}
      {/* Results open as a layer over the Home lists (owner, 2026-10-06), so the lists stay where they are. */}
      <div className="ma-search" ref={wrap}>
      <section className="ma-panel" aria-label={tr(lang, "search.label")}>
        <div className={`ma-field${status === "busy" ? " is-busy" : ""}${status === "error" ? " is-error" : ""}`}>
          <label className="ma-field__label" htmlFor="q">{tr(lang, "search.label")}</label>
          <div className="ma-search__anchor">
          <div className="ma-field__box">
            <span className="ma-field__icon"><Icon name="search" /></span>
            <input ref={input} id="q" type="search" autoComplete="off" spellCheck={false} autoFocus enterKeyHint="search"
              placeholder={tr(lang, "search.ph")} aria-describedby="q-help" value={q} maxLength={80}
              onChange={(e) => { setQ(e.target.value); setSaved(null); setOpen(true); }} onFocus={() => setOpen(true)} onClick={() => setOpen(true)}
              onKeyDown={(e) => { if (e.key === "Escape" && term) { e.preventDefault(); setOpen(false); } }} />
            {status === "busy" ? <span className="ma-field__spin ma-spin"><Icon name="loader-circle" /></span> : null}
            <button type="button" className="ma-field__clear" aria-label={tr(lang, "search.clear")}
              onClick={() => { setQ(""); input.current?.focus(); }}><Icon name="x" /></button>
          </div>
      {open && term.length >= 3 ? <div className="ma-search__drop">
      {status === "busy" ? (
        <section className="ma-panel" aria-label={tr(lang, "search.help.busy")} aria-busy="true">
          <ul className="ma-list">
            {[0, 1, 2].map((i) => (
              <li key={i}><div className="ma-row ma-row--static">
                <span className="ma-skel ma-skel--photo" />
                <span className="ma-row__text" style={{ gap: 10 }}><span className="ma-skel" style={{ width: "40%" }} /><span className="ma-skel" style={{ width: "70%" }} /></span>
              </div></li>
            ))}
          </ul>
        </section>
      ) : null}

      {status === "done" && n > 0 ? (
        <section className="ma-panel" aria-labelledby="rh">
          <h2 className="ma-panel__title" id="rh">{n === 1 ? tr(lang, "search.result1", { q: term }) : tr(lang, "search.results", { n, q: term })}</h2>
          <ul className="ma-list">
            {groups.map((g) => g.length > 1 ? (
              <li key={g[0].id}>
                <Link className="ma-row ma-row--prompt" href={`/gate/same-name?n=${encodeURIComponent(g[0].full_name)}&q=${encodeURIComponent(term)}`}>
                  <span className="ma-row__photo"><Icon name="user-search" /></span>
                  <span className="ma-row__text"><b>{tr(lang, "dup.title", { c: g.length, n: g[0].full_name })}</b><span>{tr(lang, "dup.prompt.sub")}</span></span>
                  <span className="ma-row__chev"><Icon name="chevron-right" /></span>
                </Link>
              </li>
            ) : (
              <li key={g[0].id}>
                <Link className="ma-row" href={`/gate/person/${g[0].id}${back}`}>
                  {g[0].photo
                    // eslint-disable-next-line @next/next/no-img-element -- tiny local SVG thumbnails
                    ? <span className="ma-row__photo ma-row__photo--img"><img src={g[0].photo} alt="" /></span>
                    : <span className="ma-row__photo"><Icon name="user" /></span>}
                  <span className="ma-row__text">
                    <b>{g[0].full_name}</b>
                    <span>{personMeta(lang, g[0])}{g[0].has_photo ? "" : ` · ${tr(lang, "nophoto")}`}</span>
                  </span>
                  {g[0].expected_at ? (
                    <span className="ma-row__end"><span className="ma-chip"><span className="ma-circle"><Icon name="calendar-clock" /></span>
                      <span className="ma-tabular">{tr(lang, "chip.expected", { t: fmtTime(g[0].expected_at) })}</span></span></span>
                  ) : null}
                  <span className="ma-row__chev"><Icon name="chevron-right" /></span>
                </Link>
              </li>
            ))}
          </ul>
          {n >= 25 ? <p className="ma-note">{tr(lang, "search.more")}</p> : null}
        </section>
      ) : null}

      {status === "done" && n === 0 ? (
        <section className="ma-panel" aria-labelledby="nh">
          <h2 className="ma-panel__title" id="nh">{tr(lang, "nomatch.title", { q: term })}</h2>
          <p className="ma-note">{tr(lang, "nomatch.sub")}</p>
          <ol className="ma-next">
            <li>{tr(lang, "nomatch.1")}</li><li>{tr(lang, "nomatch.2")}</li><li>{tr(lang, "nomatch.3")}</li>
          </ol>
          <div className="ma-actions"><HoldLink lang={lang} href={`/gate/hold?name=${encodeURIComponent(term)}&q=${encodeURIComponent(term)}`} /></div>
        </section>
      ) : null}

      {status === "offline" ? (
        <section className="ma-panel" aria-labelledby="oh">
          <div className="ma-banner ma-banner--escalation" role="status">
            <span className="ma-circle"><Icon name="cloud-off" /></span>
            <span className="ma-banner__text"><b>{tr(lang, "off.banner.b")}</b>{" "}
              {roster ? tr(lang, "off.banner", { t: fmtTime(roster.at), n: roster.rows.length }) : tr(lang, "off.none")}</span>
          </div>
          {roster ? (
            <>
              <h2 className="ma-panel__title" id="oh">{offRows.length === 0 ? tr(lang, "off.nomatch", { q: term })
                : offRows.length === 1 ? tr(lang, "off.result1", { q: term }) : tr(lang, "off.result", { n: offRows.length, q: term })}</h2>
              <ul className="ma-list">
                {offRows.map((r) => (
                  <li key={r.id}>
                    <button type="button" className="ma-row" onClick={() => setPicked(r)} style={{ width: "100%", textAlign: "left", font: "inherit" }}>
                      <span className="ma-row__photo"><Icon name="user" /></span>
                      <span className="ma-row__text"><b>{r.full_name}</b><span>{personMeta(lang, r)}</span></span>
                      <span className="ma-row__chev"><Icon name="chevron-right" /></span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          ) : <h2 className="ma-visually-hidden" id="oh">{tr(lang, "off.banner.b")}</h2>}
        </section>
      ) : null}
      </div> : null}
          </div>
          <p className="ma-field__help" id="q-help" aria-live="polite">
            <Icon name={status === "error" ? "circle-alert" : "info"} size={16} />{help}
          </p>
        </div>
        <div>
          <Link className="ma-btn ma-btn--secondary" href="/gate/family"><Icon name="user-plus" />{tr(lang, "family.register")}</Link>
        </div>
      </section>

      </div>
    </>
  );
}
