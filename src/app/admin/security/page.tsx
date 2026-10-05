import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/profile";
import { Icon } from "@/components/Icon";
import { AdminShell } from "../AdminShell";
import { Banner, Chip, Empty, PanelHead, RowLink, Table, UUID } from "../ui";
import { getStaff, ROLE_LABEL } from "./data";

export const metadata: Metadata = { title: "Security · Admin console" };

/** Guards, gate devices and admins (mockup a13). */
export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ saved?: string; deactivated?: string; reactivated?: string }> }) {
  const me = await requireRole("admin");
  const sp = await searchParams;
  const { staff, error } = await getStaff();
  const nameOf = (id?: string) => (id && UUID.test(id) ? staff.find((s) => s.id === id)?.name : undefined);
  const saved = nameOf(sp.saved), off = nameOf(sp.deactivated), on = nameOf(sp.reactivated);
  const active = staff.filter((s) => s.active).length;

  return (
    <AdminShell me={me} title="Security" current="/admin/security"
      banner={saved ? <Banner kind="success" icon="check"><b>Saved: {saved}.</b> Guards see name and shift changes on the gate&apos;s list at once.</Banner>
        : off ? <Banner kind="success" icon="check"><b>{off} is deactivated.</b> They can&apos;t use the console any more; their past decisions stay in History.</Banner>
        : on ? <Banner kind="success" icon="check"><b>{on} is active again.</b></Banner>
        : error ? <Banner kind="danger" icon="circle-alert" alert>Couldn&apos;t load the accounts. Refresh the page.</Banner> : null}>
      <section className="ma-panel" aria-labelledby="ph">
        <PanelHead id="ph" title={`${active} active ${active === 1 ? "account" : "accounts"}`}
          actions={<Link className="ma-btn ma-btn--primary" href="/admin/security/new"><Icon name="user-plus" />Add account</Link>} />
        {staff.length ? (
          <Table label="Security accounts" heads={["Name", "Role", "Gate", "Shift or email", "Status", ""]}>
            {staff.map((s) => (
              <tr key={s.id}>
                <td>{s.name}{s.me ? " (you)" : ""}</td>
                <td>{ROLE_LABEL[s.role]}</td>
                <td>{s.gate ?? "—"}</td>
                <td className="ma-tabular">{s.role === "guard" ? s.shift_label ?? "—" : s.email}</td>
                <td>{!s.active ? <Chip icon="user-x" text="Deactivated" />
                  : s.on_shift ? <Chip icon="shield-user" text="On duty now" kind="success" />
                  : s.role !== "guard" && !s.signed_in ? <Chip icon="clock" text="Not signed in yet" kind="hold" />
                  : <Chip icon="check" text="Active" kind="success" />}</td>
                <td style={{ textAlign: "right" }}><RowLink href={`/admin/security/${s.id}`} label="Manage" who={s.name} /></td>
              </tr>
            ))}
          </Table>
        ) : <Empty title="No accounts yet" />}
      </section>
    </AdminShell>
  );
}
