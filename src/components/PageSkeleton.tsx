/** Shown inside the console frame the moment a page is tapped, until its data arrives (loading.tsx).
 *  Grey shapes only, announced once as "Loading…"; with reduced motion they stay still. */
export function PageSkeleton({ label, aside }: { label: string; aside?: boolean }) {
  const rows = (n: number) => (
    <ul className="ma-list" aria-hidden="true">
      {Array.from({ length: n }, (_, i) => (
        <li key={i}><div className="ma-row ma-row--static">
          <span className="ma-skel ma-skel--photo" />
          <span className="ma-row__text" style={{ gap: 10 }}><span className="ma-skel" style={{ width: `${40 - i * 4}%` }} /><span className="ma-skel" style={{ width: `${70 - i * 6}%` }} /></span>
        </div></li>
      ))}
    </ul>
  );
  return (
    <main className="ma-shell__main ma-loading" id="main" tabIndex={-1} aria-busy="true">
      <header className="ma-titlebar"><span className="ma-skel ma-skel--title" aria-hidden="true" /><span className="ma-visually-hidden" role="status">{label}</span></header>
      <div className="ma-shell__body">
        <div className={`ma-columns${aside ? "" : " ma-columns--single"}`}>
          <div><section className="ma-panel"><span className="ma-skel ma-skel--h2" aria-hidden="true" />{rows(3)}</section></div>
          {aside ? <aside><section className="ma-panel"><span className="ma-skel ma-skel--h2" aria-hidden="true" /><span className="ma-skel ma-skel--block" aria-hidden="true" /><span className="ma-skel ma-skel--block" aria-hidden="true" /></section></aside> : null}
        </div>
      </div>
    </main>
  );
}
