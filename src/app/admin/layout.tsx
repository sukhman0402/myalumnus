import { Frame, getTheme } from "@/components/Frame";
import { IdleSignOut } from "@/components/IdleSignOut";
import { ProfileBadge } from "@/components/ProfileBadge";
import { SignOutButton } from "@/components/SignOutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { requireRole } from "@/lib/profile";
import { signOut } from "../sign-in/actions";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "gauge" },   // not the grid icon: it looked like the logo (owner, 2026-10-06)
  { href: "/admin/alumni", label: "Alumni", icon: "graduation-cap" },
  { href: "/admin/visitors", label: "Visitors", icon: "id-card" },
  { href: "/admin/history", label: "History", icon: "history" },
  { href: "/admin/security", label: "Security", icon: "shield-user" },
  { href: "/admin/campus", label: "Settings", icon: "settings" },   // renamed from Campus (owner, 2026-10-06); address unchanged
  { href: "/admin/reports", label: "Reports", icon: "chart-column" },
];

/** The admin console frame (English only; planning/02 D12 covers the guard console). Every page still checks the role. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [me, theme] = await Promise.all([requireRole("admin"), getTheme()]);
  const tools = (
    <>
      <ThemeToggle initial={theme} darkLabel="Dark mode" lightLabel="Light mode" />
      <SignOutButton signOut={signOut} />
      <ProfileBadge name={me.name} detail={`Admin · ${me.university_name}`} />
    </>
  );
  return (
    <Frame consoleName="admin" home="/admin" homeLabel="My Alumnus: dashboard" nav={NAV} tools={tools}>
      <IdleSignOut signOut={signOut} />
      {children}
    </Frame>
  );
}
