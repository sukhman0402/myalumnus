import { cookies } from "next/headers";
import { Icon } from "./Icon";
import { Rail } from "./Rail";

export type NavItem = { href: string; label: string; icon: string; current?: boolean; soon?: boolean };

/** The shared console frame: floating rail + title bar (design system: AppShell, NavRail). */
export async function Shell({ title, nav, identity, identityIcon, actions, children, aside, banner, lang = "en", skipLabel = "Skip to content",
  soonLabel = "Coming in a later build", consoleName = "gate", showLabels = "Show labels", hideLabels = "Hide labels" }: {
  title: string; nav: NavItem[]; identity: string; identityIcon: string;
  actions?: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode; banner?: React.ReactNode;
  lang?: string; skipLabel?: string; soonLabel?: string; consoleName?: "gate" | "admin"; showLabels?: string; hideLabels?: string;
}) {
  const railOpen = (await cookies()).get(`ma-rail-${consoleName}`)?.value === "1";   // starts closed (icons only)
  return (
    <div lang={lang}>
      <a className="ma-skip" href="#main">{skipLabel}</a>
      <div className="ma-app"><div className="ma-shell">
        <Rail nav={nav} soonLabel={soonLabel} initialOpen={railOpen} consoleName={consoleName} showLabel={showLabels} hideLabel={hideLabels} />
        <main className="ma-shell__main" id="main" tabIndex={-1}>
          <header className="ma-titlebar">
            <h1>{title}</h1>
            <div className="ma-actions">
              {actions}
              <p className="ma-identity"><Icon name={identityIcon} size={16} />{identity}</p>
            </div>
          </header>
          {banner}
          <div className={`ma-columns${aside ? "" : " ma-columns--single"}`}>
            <div>{children}</div>
            {aside ? <aside>{aside}</aside> : null}
          </div>
        </main>
      </div></div>
    </div>
  );
}
