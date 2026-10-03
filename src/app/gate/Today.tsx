import Link from "next/link";
import { Icon } from "@/components/Icon";
import { tr, type Lang } from "@/lib/i18n";
import { getToday } from "@/lib/gate";

/** The "Today" tiles beside every gate screen; each opens its list. */
export async function Today({ lang }: { lang: Lang }) {
  const c = await getToday();
  const tiles: [number | undefined, string, string | null][] = [
    [c?.expected, tr(lang, "tile.expected"), "/gate/expected"],
    [c?.inside, tr(lang, "tile.inside"), "/gate/inside"],
    [c?.flagged, tr(lang, "tile.flagged"), "/gate/cases"],
    [c?.visits, tr(lang, "tile.visits"), null], // no list of past visits at the gate
  ];
  return (
    <section className="ma-panel" aria-labelledby="today">
      <h2 className="ma-panel__title" id="today">{tr(lang, "today")}</h2>
      <div className="ma-stats">
        {tiles.map(([v, label, href]) => href ? (
          <Link key={label} className="ma-card" href={href}>
            <span className="ma-card__value ma-tabular">{v ?? "—"}</span>
            <span className="ma-card__label">{label}</span>
            <Icon name="arrow-up-right" className="ma-card__arrow" />
          </Link>
        ) : (
          <div key={label} className="ma-card">
            <span className="ma-card__value ma-tabular">{v ?? "—"}</span>
            <span className="ma-card__label">{label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
