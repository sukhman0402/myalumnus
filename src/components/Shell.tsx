import Link from "next/link";
import { Icon } from "./Icon";

export type NavItem = { href: string; label: string; icon: string; current?: boolean; soon?: boolean };

/** The shared console frame: floating rail + title bar (design system: AppShell, NavRail). */
export function Shell({ title, nav, identity, identityIcon, actions, children, aside }: {
  title: string; nav: NavItem[]; identity: string; identityIcon: string;
  actions?: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode;
}) {
  return (
    <>
      <a className="ma-skip" href="#main">Skip to content</a>
      <div className="ma-app"><div className="ma-shell">
        <nav className="ma-rail" aria-label="Main">
          <div className="ma-rail__logo" aria-hidden="true">MA</div>
          {nav.map((n) => n.soon ? (
            <span key={n.href} className="ma-rail__item" aria-disabled="true" title={`${n.label}: coming in a later build slice`}>
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
          <div className={`ma-columns${aside ? "" : " ma-columns--single"}`}>
            <div>{children}</div>
            {aside ? <aside>{aside}</aside> : null}
          </div>
        </main>
      </div></div>
    </>
  );
}
