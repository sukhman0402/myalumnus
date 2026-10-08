import { Clock } from "@/components/Clock";
import { tr, type Lang } from "@/lib/i18n";
import { getToday, timeFns } from "@/lib/gate";

/** Beside every gate screen. Owner, 2026-10-08: sizes and order swapped. Today's visits first and large (the number
 *  the guard glances at); the time and date under it, small. */
export async function Today({ lang }: { lang: Lang }) {
  const [c, { h24 }] = await Promise.all([getToday(), timeFns()]);
  return (
    <section className="ma-panel" aria-label={tr(lang, "today")}>
      <div className="ma-today">
        <span className="ma-today__value ma-tabular">{c?.visits ?? "—"}</span>
        <span className="ma-today__label">{tr(lang, "tile.visits")}</span>
      </div>
      <Clock lang={lang} label={tr(lang, "clock.label")} small h24={h24} />
    </section>
  );
}
