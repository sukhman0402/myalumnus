export type NavItem = { href: string; label: string; icon: string; soon?: boolean };

/**
 * One page inside a console frame (components/Frame.tsx, drawn by the console layout): the title row and the
 * content columns. The page's <main> spans the frame's title row and content row (CSS subgrid), so its title sits
 * in line with the logo and the profile badge, and its first card lines up with the top of the side bar.
 */
export function Shell({ title, actions, children, aside, banner }: {
  title: string; actions?: React.ReactNode; children: React.ReactNode; aside?: React.ReactNode; banner?: React.ReactNode;
}) {
  return (
    <main className="ma-shell__main" id="main" tabIndex={-1}>
      <header className="ma-titlebar">
        <h1>{title}</h1>
        {actions ? <div className="ma-actions">{actions}</div> : null}
      </header>
      <div className="ma-shell__body">
        {banner}
        <div className={`ma-columns${aside ? "" : " ma-columns--single"}`}>
          <div>{children}</div>
          {aside ? <aside>{aside}</aside> : null}
        </div>
      </div>
    </main>
  );
}
