import { Clock } from "@/components/Clock";
import { tr, type Lang } from "@/lib/i18n";
import { getToday } from "@/lib/gate";

/** Beside every gate screen (owner, 2026-10-06): the time, large, one card high; the date under it; then today's
 *  visits. The Expected / Inside / Flagged counts moved onto Home, next to their lists. */
export async function Today({ lang }: { lang: Lang }) {
  const c = await getToday();
  return (
    <section className="ma-panel" aria-label={tr(lang, "today")}>
      <Clock lang={lang} label={tr(lang, "clock.label")} />
      <div className="ma-card ma-card--static">
        <span className="ma-card__value ma-tabular">{c?.visits ?? "—"}</span>
        <span className="ma-card__label">{tr(lang, "tile.visits")}</span>
      </div>
    </section>
  );
}
