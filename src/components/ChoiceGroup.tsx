/** A row of mutually exclusive choices that each save on tap (guard Settings: text size, time format). Works without
 *  JavaScript: every button submits the form with its own value. The current choice is pressed. */
export function ChoiceGroup({ action, name, value, options, label }: {
  action: (form: FormData) => Promise<void>; name: string; value: string; options: [string, string][]; label: string;
}) {
  return (
    <form action={action} className="ma-choices" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button key={v} name={name} value={v} aria-pressed={v === value} className={`ma-choice${v === value ? " is-on" : ""}`}>{text}</button>
      ))}
    </form>
  );
}
