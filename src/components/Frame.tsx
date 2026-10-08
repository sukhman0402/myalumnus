import { cookies } from "next/headers";
import { Rail } from "./Rail";
import type { NavItem } from "./Shell";

/**
 * The console frame, drawn once by the console layout and kept between pages (owner, 2026-10-06: slow page
 * changes). Grid: logo | page title | tools on the first row, side bar | page content below. A page's
 * loading.tsx skeleton shows inside the frame at once while the page's data loads.
 */
export async function Frame({ consoleName, home, homeLabel, nav, tools, lang = "en", skipLabel = "Skip to content", soonLabel = "Coming in a later build",
  showLabels = "Show labels", hideLabels = "Hide labels", children }: {
  consoleName: "gate" | "admin"; home: string; homeLabel: string; nav: NavItem[]; tools: React.ReactNode; lang?: string;
  skipLabel?: string; soonLabel?: string; showLabels?: string; hideLabels?: string; children: React.ReactNode;
}) {
  // The gate's side bar starts open with labels, so a guard on a touch screen reads the words, not only icons
  // (Iteration 3, finding F11). Admin starts closed. The device's own choice (cookie) wins once made.
  const saved = (await cookies()).get(`ma-rail-${consoleName}`)?.value;
  const railOpen = saved ? saved === "1" : consoleName === "gate";
  return (
    <div lang={lang}>
      <a className="ma-skip" href="#main">{skipLabel}</a>
      <div className="ma-app"><div className="ma-shell">
        <Rail nav={nav} home={home} homeLabel={homeLabel} soonLabel={soonLabel} initialOpen={railOpen} consoleName={consoleName} showLabel={showLabels} hideLabel={hideLabels} />
        <div className="ma-tools">{tools}</div>
        {children}
      </div></div>
    </div>
  );
}

/** The current theme (cookie), for the toggle's first state. */
export async function getTheme(): Promise<"light" | "dark"> {
  return (await cookies()).get("ma-theme")?.value === "dark" ? "dark" : "light";
}
