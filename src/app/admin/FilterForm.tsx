import Form from "next/form";

/**
 * A filter bar. It applies when the button is pressed (or Enter in the search box), not on every dropdown change:
 * changing the page while someone is still choosing breaks keyboard use (WCAG 3.2.2). next/form keeps it a soft navigation.
 */
export function FilterForm({ action, label, children }: { action: string; label: string; children: React.ReactNode }) {
  return <Form action={action} replace scroll={false} className="ma-filters" role="search" aria-label={label}>{children}</Form>;
}
