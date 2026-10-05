import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/profile";
import { Icon } from "@/components/Icon";
import { AdminShell } from "../../AdminShell";
import { PersonForm } from "../PersonForm";

export const metadata: Metadata = { title: "Add record · Admin console" };

/** Add one record. The photo is added on the next screen, once the record exists. */
export default async function NewPersonPage({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const me = await requireRole("admin");
  const sp = await searchParams;
  const kind = ["alumnus", "student", "faculty", "placement"].includes(sp.kind ?? "") ? sp.kind! : "alumnus";
  return (
    <AdminShell me={me} title="Add record" current="/admin/alumni">
      <section className="ma-panel" aria-labelledby="fh">
        <Link className="ma-link" href="/admin/alumni"><Icon name="arrow-left" />Alumni</Link>
        <h2 className="ma-panel__title" id="fh">Add a record</h2>
        <PersonForm initial={{ id: "", kind, name: "", roll: "", batch: "", program: "", phone: "", email: "", active: true }} />
      </section>
    </AdminShell>
  );
}
