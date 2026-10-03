import Link from "next/link";
import { Icon } from "./Icon";

export type NavItem = { href: string; label: string; icon: string; current?: boolean; soon?: boolean };

/** The shared console frame: floating rail + title bar (design system: AppShell, NavRail). */
export function Shell({ title, nav, identity, identityIcon, actions, children, aside, banner, lang = "en", skipLabel = "Skip to content", soonLabel = "Coming in a later build" }: {
  title: string; nav: NavItem[]; identity: string; identityIcon: string;
  actions?: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode; banner?: React.ReactNode;
  lang?: string; skipLabel?: string; soonLabel?: string;
}) {
  return (
    <div lang={lang}>
      <a className="ma-skip" href="#main">{skipLabel}</a>
      <div className="ma-app"><div className="ma-shell">
        <nav className="ma-rail" aria-label="Main">
          <div className="ma-rail__logo" aria-hidden="true">MA</div>
          {nav.map((n) => n.soon ? (
            <span key={n.href} className="ma-rail__item" aria-disabled="true" title={`${n.label}: ${soonLabel}`}>
              <Icon name={n.icon} /><span>{n.label}</span>
            </span>
          ) : (
            <Link key={n.href} className="ma-rail__item" href={n.href} aria-current={n.current ? "page" : undefined}>
              <Icon name={n.icon} /><span>{n.label}</span>
            </Link>
          ))}
        </nav>
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
