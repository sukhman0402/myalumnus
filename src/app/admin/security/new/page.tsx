import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/profile";
import { Icon } from "@/components/Icon";
import { AdminShell } from "../../AdminShell";
import { getStaff } from "../data";
import { StaffForm } from "../StaffForm";

export const metadata: Metadata = { title: "Add account · Admin console" };

export default async function NewStaffPage() {
  const me = await requireRole("admin");
  const { gates } = await getStaff();
  return (
    <AdminShell me={me} title="Add account" current="/admin/security">
      <section className="ma-panel" aria-labelledby="sh">
        <Link className="ma-link" href="/admin/security"><Icon name="arrow-left" />Security</Link>
        <h2 className="ma-panel__title" id="sh">Add an account</h2>
        <StaffForm gates={gates} initial={{ id: "", role: "guard", name: "", email: "", gate: gates.length === 1 ? gates[0].id : "", shift: "", signedIn: false }} />
      </section>
    </AdminShell>
  );
}
