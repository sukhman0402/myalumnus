import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/Icon";
import { AdminShell } from "../../AdminShell";
import { ChangeLog, type Change } from "../../ChangeLog";
import { ConfirmButton } from "../../ConfirmButton";
import { fromHint } from "../../errors";
import { Banner, UUID } from "../../ui";
import { setStaffActive } from "../actions";
import { getStaff, ROLE_LABEL } from "../data";
import { StaffForm } from "../StaffForm";

export const metadata: Metadata = { title: "Manage account · Admin console" };
const LABELS = { name: "Name", email: "Email", gate_id: "Gate", shift_label: "Shift", active: "Active" };

export default async function StaffPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const me = await requireRole("admin");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const { staff, gates } = await getStaff();
  const s = staff.find((x) => x.id === id);
  if (!s) notFound();
  const supabase = await createClient();
  const { data: changes } = await supabase.rpc("admin_changes", { p_table: "staff", p_row: id });
  const err = sp.error ? fromHint({ hint: sp.error }).error : null;
  const what = s.role === "guard" ? "They disappear from the gate's name list and any shift they have open ends."
    : s.role === "gate" ? "The iPad loses access to the guard console at once, and its open shift ends."
    : "They lose access to this console at once.";

  return (
    <AdminShell me={me} title="Manage account" current="/admin/security"
      banner={err ? <Banner kind="danger" icon="circle-alert" alert>{err}</Banner> : null}
      aside={<section className="ma-panel" aria-labelledby="ch"><h2 className="ma-panel__title" id="ch">Changes</h2>
        <ChangeLog rows={(changes ?? []) as Change[]} labels={LABELS} added="Added this account" /></section>}>
      <section className="ma-panel" aria-labelledby="sh">
        <Link className="ma-link" href="/admin/security"><Icon name="arrow-left" />Security</Link>
        <h2 className="ma-panel__title" id="sh">{s.name} · {ROLE_LABEL[s.role]}</h2>
        {!s.active ? <Banner kind="escalation" icon="user-x"><b>Deactivated.</b> Past decisions stay in History.</Banner> : null}
        <StaffForm gates={gates} initial={{ id: s.id, role: s.role, name: s.name, email: s.email ?? "", gate: s.gate_id ?? "", shift: s.shift_label ?? "", signedIn: s.signed_in }} />
        {s.me ? <p className="ma-note">You can&apos;t deactivate your own account. Another admin can.</p> : (
          <div className="ma-sub" role="group" aria-labelledby="dh">
            <h3 className="ma-sub__title" id="dh">{s.active ? "Deactivate" : "Reactivate"}</h3>
            <p className="ma-note">{s.active ? `${what} Their past decisions stay in History. You can reactivate them later.` : "They can use the console again straight away."}</p>
            {s.active ? (
              <ConfirmButton action={setStaffActive} fields={{ id: s.id, active: "0" }} label="Deactivate" icon="user-x"
                title={`Deactivate ${s.name}?`} confirmLabel="Deactivate" keepLabel="Keep account"
                body={<p>{what} Their past decisions stay in History.</p>} />
            ) : (
              <ConfirmButton action={setStaffActive} fields={{ id: s.id, active: "1" }} label="Reactivate" icon="user-check" destructive={false}
                title={`Reactivate ${s.name}?`} confirmLabel="Reactivate" body={<p>They can use the console again straight away.</p>} />
            )}
          </div>
        )}
      </section>
    </AdminShell>
  );
}
