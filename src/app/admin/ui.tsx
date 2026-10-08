import Link from "next/link";
import { Icon } from "@/components/Icon";
import { KIND_LABEL } from "@/lib/format";

// Small building blocks shared by the admin pages (design system: Banner, Chip, Panel head, Table, Empty state).

export function Banner({ kind, icon, children, alert }: {
  kind: "escalation" | "success" | "danger" | "neutral"; icon: string; children: React.ReactNode; alert?: boolean;
}) {
  return (
    <div className={`ma-banner ma-banner--${kind}`} role={alert ? "alert" : "status"}>
      <span className="ma-circle"><Icon name={icon} /></span><span className="ma-banner__text">{children}</span>
    </div>
  );
}

export function Chip({ icon, text, kind }: { icon: string; text: React.ReactNode; kind?: "hold" | "success" | "danger" | "neutral" }) {
  return (
    <span className={`ma-chip${kind ? ` ma-chip--${kind}` : ""}`}>
      <span className="ma-circle"><Icon name={icon} /></span><span className="ma-tabular">{text}</span>
    </span>
  );
}

const KIND_ICON: Record<string, string> = {
  alumnus: "graduation-cap", student: "book-open", faculty: "id-card", placement: "id-card", walkin: "user-search", family: "users",
};
export function KindChip({ kind }: { kind: string }) {
  return <Chip icon={KIND_ICON[kind] ?? "user"} text={KIND_LABEL[kind] ?? kind} kind={kind === "alumnus" ? "success" : undefined} />;
}

export function PanelHead({ id, title, actions }: { id: string; title: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="ma-panel__head">
      <h2 className="ma-panel__title" id={id}>{title}</h2>
      {actions ? <div className="ma-actions">{actions}</div> : null}
    </div>
  );
}

export function Thumb({ src }: { src: string | null | undefined }) {
  // eslint-disable-next-line @next/next/no-img-element -- signed, short-lived links; next/image would cache them
  return src ? <span className="ma-row__photo ma-row__photo--img"><img src={src} alt="" /></span> : <span className="ma-row__photo"><Icon name="user" /></span>;
}

export function PersonCell({ name, src }: { name: string; src?: string | null }) {
  return <span className="ma-cellperson"><Thumb src={src} /><span>{name}</span></span>;
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="ma-list"><div className="ma-empty"><b>{title}</b>{children ? <span>{children}</span> : null}</div></div>;
}

/** A table card. Each row's last cell holds its link ("View", "Edit"); the link's hidden text names the row. */
export function Table({ label, heads, children }: { label: string; heads: string[]; children: React.ReactNode }) {
  return (
    <div className="ma-tablecard">
      <div className="ma-table-wrap" tabIndex={0} role="region" aria-label={label}>
        <table className="ma-table">
          <thead><tr>{heads.map((h, i) => <th key={i}>{h || <span className="ma-visually-hidden">Actions</span>}</th>)}</tr></thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

export function RowLink({ href, label, who }: { href: string; label: string; who: string }) {
  return <Link className="ma-view" href={href}>{label}<span className="ma-visually-hidden"> {who}</span></Link>;
}

/** "Showing 51–100 of 4,812" with Previous / Next. */
export function Pager({ page, total, size = 50, href }: { page: number; total: number; size?: number; href: (p: number) => string }) {
  if (total <= size) return null;
  const last = Math.ceil(total / size);
  const from = (page - 1) * size + 1;
  const to = Math.min(total, page * size);
  return (
    <nav className="ma-actions ma-pager" aria-label="Pages">
      <span className="ma-note ma-tabular">Showing {from.toLocaleString("en-IN")}–{to.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")}</span>
      {page > 1 ? <Link className="ma-btn ma-btn--secondary" href={href(page - 1)}><Icon name="chevron-left" />Previous</Link> : null}
      {page < last ? <Link className="ma-btn ma-btn--secondary" href={href(page + 1)}>Next<Icon name="chevron-right" /></Link> : null}
    </nav>
  );
}

/** Builds a link to the same page with some search parameters changed (empty values are dropped). */
export function withParams(path: string, base: Record<string, string | undefined>, change: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...base, ...change })) if (v !== undefined && v !== "" && v !== null) q.set(k, String(v));
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A dropdown in a filter bar (see FilterForm). */
export function FilterSelect({ id, name, label, value, options }: { id: string; name: string; label: string; value: string; options: [string, string][] }) {
  return (
    <div className="ma-field">
      <label className="ma-field__label" htmlFor={id}>{label}</label>
      <div className="ma-field__box">
        <select id={id} name={name} defaultValue={value}>{options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <Icon name="chevron-down" className="ma-field__icon" />
      </div>
    </div>
  );
}
