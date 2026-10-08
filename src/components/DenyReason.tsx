"use client";

import { useState } from "react";
import { Icon } from "./Icon";
import { tr, type Lang, type TKey } from "@/lib/i18n";
import { DENY_WHY, OTHER, WHY_EN } from "@/lib/reasons";

/** Deny reason as a dropdown (owner, 2026-10-08), the same reasons as Flag & Hold except "Name not found".
 *  "Something else" opens a text box. onChange gives the reason to save: the English label, or the typed text. */
export function DenyReason({ lang, id, error: given, stamp, onChange, autoFocus }: {
  lang: Lang; id: string; error?: string; stamp?: unknown; onChange: (reason: string) => void; autoFocus?: boolean;
}) {
  const [why, setWhy] = useState("");
  const [other, setOther] = useState("");
  // An error shows until the guard changes the reason; a new failed submit (new `stamp`) shows it again.
  const [hidden, setHidden] = useState(false);
  const [seen, setSeen] = useState(stamp);
  if (stamp !== seen) { setSeen(stamp); setHidden(false); }
  const error = hidden ? undefined : given;
  const emit = (w: string, o: string) => { setHidden(true); onChange(!w ? "" : Number(w) === OTHER ? o.trim() : WHY_EN[Number(w) - 1]); };
  const help = error ? `${id}-help` : undefined;
  return (
    <>
      <div className={`ma-field${error && Number(why) !== OTHER ? " is-error" : ""}`}>
        <label className="ma-field__label" htmlFor={id}>{tr(lang, "deny.reason")}</label>
        <div className="ma-field__box">
          <select id={id} value={why} autoFocus={autoFocus} aria-invalid={error && Number(why) !== OTHER ? true : undefined}
            aria-describedby={Number(why) !== OTHER ? help : undefined}
            onChange={(e) => { setWhy(e.target.value); emit(e.target.value, other); }}>
            {/* Not disabled: a form reset after a failed submit must land back here, matching what is saved. */}
            <option value="">{tr(lang, "deny.pick")}</option>
            {DENY_WHY.map((i) => <option key={i} value={i}>{tr(lang, `fh.why.${i}` as TKey)}</option>)}
          </select>
          <Icon name="chevron-down" className="ma-field__icon" />
        </div>
        {error && Number(why) !== OTHER ? <p className="ma-field__help" id={help}><Icon name="circle-alert" size={16} />{error}</p> : null}
      </div>
      {Number(why) === OTHER ? (
        <div className={`ma-field${error ? " is-error" : ""}`}>
          <label className="ma-field__label" htmlFor={`${id}-o`}>{tr(lang, "deny.other")}</label>
          <div className="ma-field__box">
            <input id={`${id}-o`} value={other} maxLength={300} autoFocus placeholder={tr(lang, "deny.ph")}
              aria-invalid={error ? true : undefined} aria-describedby={help}
              onChange={(e) => { setOther(e.target.value); emit(why, e.target.value); }} />
          </div>
          {error ? <p className="ma-field__help" id={help}><Icon name="circle-alert" size={16} />{error}</p> : null}
        </div>
      ) : null}
    </>
  );
}
