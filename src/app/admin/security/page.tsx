import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/profile";
import { Icon } from "@/components/Icon";
import { AdminShell } from "../AdminShell";
import { Banner, Chip, Empty, PanelHead, RowLink, Table, UUID } from "../ui";
import { getStaff, type StaffRow } from "./data";
import { Avatar } from "@/components/Avatar";

export const metadata: Metadata = { title: "Security · Admin console" };

// The same four columns in every section, so Status lines up down the page (owner, 2026-10-07).
const GROUPS: [StaffRow["role"], string, string[]][] = [
  ["gate", "Gate devices", ["Device", "Gate · sign-in email", "Status", ""]],
  ["admin", "Admins", ["Name", "Email", "Status", ""]],
];
const detail = (s: StaffRow) => s.role === "guard" ? [s.gate, s.shift_label].filter(Boolean).join(" · ") || "—"
  : s.role === "gate" ? [s.gate, s.email].filter(Boolean).join(" · ") : s.email ?? "—";
/** Active = can use the console: enabled and signed in at least once. */
function status(s: StaffRow) {
  return !s.active ? <Chip icon="user-x" text="Deactivated" />
    : !s.signed_in ? <Chip icon="clock" text="Not signed in yet" kind="hold" />
    : <Chip icon="check" text="Active" kind="success" />;
}

/** Gate devices and admins, each in its own section. No guard accounts: one gate, one device (owner, 2026-10-08). */
export default async function SecurityPage({ searchParams }: { searchParams: Promise<{ saved?: string; deactivated?: string; reactivated?: string }> }) {
  const me = await requireRole("admin");
  const sp = await searchParams;
  const { staff, error } = await getStaff();
  const nameOf = (id?: string) => (id && UUID.test(id) ? staff.find((s) => s.id === id)?.name : undefined);
  const saved = nameOf(sp.saved), off = nameOf(sp.deactivated), on = nameOf(sp.reactivated);
  // Same rule as the Status column. Guard records (the gate posts) are not accounts and are not listed.
  const accounts = staff.filter((s) => s.role !== "guard");
  const active = accounts.filter((s) => s.active && s.signed_in).length;

  return (
    <AdminShell me={me} title="Security" current="/admin/security"
      banner={saved ? <Banner kind="success" icon="check"><b>Saved: {saved}.</b></Banner>
        : off ? <Banner kind="success" icon="check"><b>{off} is deactivated.</b> They can&apos;t use the console any more; their past decisions stay in History.</Banner>
        : on ? <Banner kind="success" icon="check"><b>{on} is active again.</b></Banner>
        : error ? <Banner kind="danger" icon="circle-alert" alert>Couldn&apos;t load the accounts. Refresh the page.</Banner> : null}>
      <section className="ma-panel" aria-labelledby="ph">
        <PanelHead id="ph" title={`${active} active ${active === 1 ? "account" : "accounts"}`}
          actions={<Link className="ma-btn ma-btn--primary" href="/admin/security/new"><Icon name="user-plus" />Add account</Link>} />
        <p className="ma-note">Each gate has one device, signed in once when it is set up. Admins sign in with an email.</p>
      </section>
      {/* One section per kind of account (owner, 2026-10-06). */}
      {GROUPS.map(([role, title, heads]) => {
        const rows = accounts.filter((s) => s.role === role);
        return (
          <section key={role} className="ma-panel ma-sec-group" aria-labelledby={`g-${role}`}>
            <h2 className="ma-panel__title" id={`g-${role}`}>{title} <span className="ma-chip"><span className="ma-tabular">{rows.length}</span></span></h2>
            {rows.length ? (
              <Table label={title} heads={heads}>
                {rows.map((s) => (
                  <tr key={s.id}>
                    <td><span className="ma-cellperson">{role === "gate" ? <Avatar name={s.name} size="sm" icon={<Icon name="university" size={16} />} /> : <Avatar name={s.name} size="sm" />}
                      <span>{s.name}{s.me ? " (you)" : ""}</span></span></td>
                    <td className="ma-tabular">{detail(s)}</td>
                    <td>{status(s)}</td>
                    <td style={{ textAlign: "right" }}><RowLink href={`/admin/security/${s.id}`} label="Manage" who={s.name} /></td>
                  </tr>
                ))}
              </Table>
            ) : <Empty title={`No ${title.toLowerCase()} yet`} />}
          </section>
        );
      })}
    </AdminShell>
  );
}
