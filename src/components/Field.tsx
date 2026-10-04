import { Icon } from "./Icon";

// Form fields in the design system's pattern: label above, box, then help or the error in the same place.
// Errors replace the help text and are tied to the input with aria-describedby / aria-invalid.

type Common = { id: string; label: string; help?: React.ReactNode; error?: string };

export function Field({ id, label, help, error, icon, ...input }: Common & { icon?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const describe = help || error ? `${id}-h` : undefined;
  return (
    <div className={`ma-field${error ? " is-error" : ""}`}>
      <label className="ma-field__label" htmlFor={id}>{label}</label>
      <div className="ma-field__box">
        {icon ? <span className="ma-field__icon"><Icon name={icon} /></span> : null}
        <input id={id} placeholder=" " aria-describedby={describe} aria-invalid={error ? true : undefined} {...input} />
      </div>
      {describe ? <p className="ma-field__help" id={describe}><Icon name={error ? "circle-alert" : "info"} size={16} />{error ?? help}</p> : null}
    </div>
  );
}

export function Select({ id, label, help, error, options, ...select }: Common & {
  options: [string, string][];
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const describe = help || error ? `${id}-h` : undefined;
  return (
    <div className={`ma-field${error ? " is-error" : ""}`}>
      <label className="ma-field__label" htmlFor={id}>{label}</label>
      <div className="ma-field__box">
        <select id={id} aria-describedby={describe} aria-invalid={error ? true : undefined} {...select}>
          {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <Icon name="chevron-down" className="ma-field__icon" />
      </div>
      {describe ? <p className="ma-field__help" id={describe}><Icon name={error ? "circle-alert" : "info"} size={16} />{error ?? help}</p> : null}
    </div>
  );
}

/** The "Not saved" summary at the top of a form, as in mockup a09. */
export function FormError({ error, count }: { error?: string; count?: number }) {
  if (!error && !count) return null;
  return (
    <div className="ma-banner ma-banner--danger" role="alert">
      <span className="ma-circle"><Icon name="circle-alert" /></span>
      <span className="ma-banner__text">
        {count ? <><b>{count === 1 ? "1 field needs attention." : `${count} fields need attention.`}</b> Nothing is saved yet.{error ? ` ${error}` : ""}</> : error}
      </span>
    </div>
  );
}

export function SubmitButton({ pending, icon, children, kind = "primary" }: {
  pending: boolean; icon: string; children: React.ReactNode; kind?: "primary" | "secondary" | "destructive";
}) {
  return (
    <button type="submit" className={`ma-btn ma-btn--${kind}`} aria-disabled={pending ? "true" : undefined}
      onClick={(e) => { if (pending) e.preventDefault(); }}>
      <Icon name={pending ? "loader-circle" : icon} className={pending ? "ma-spin" : undefined} />{children}
    </button>
  );
}
