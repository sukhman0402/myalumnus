import { Frame } from "@/components/Frame";
import { ProfileBadge } from "@/components/ProfileBadge";
import { requireRole } from "@/lib/profile";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "gauge" },   // not the grid icon: it looked like the logo (owner, 2026-10-06)
  { href: "/admin/alumni", label: "People", icon: "graduation-cap" },
  { href: "/admin/visitors", label: "Expected visits", icon: "id-card" },
  { href: "/admin/history", label: "History", icon: "history" },
  { href: "/admin/security", label: "Staff & devices", icon: "shield-user" },
  { href: "/admin/campus", label: "Settings", icon: "settings" },   // renamed from Campus (owner, 2026-10-06); address unchanged
  { href: "/admin/reports", label: "Reports", icon: "chart-column" },
];

/** The admin console frame (English only; planning/02 D12 covers the guard console). Every page still checks the role.
 *  Top right: initials + name only. Display and sign-out live in Settings; signing in is a one-time device setup,
 *  so there is no idle sign-out any more (owner, 2026-10-08). */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await requireRole("admin");
  return (
    <Frame consoleName="admin" home="/admin" homeLabel="My Alumnus: dashboard" nav={NAV}
      tools={<ProfileBadge name={me.name} href="/admin/campus" hrefLabel="Settings" />}>
      {children}
    </Frame>
  );
}
