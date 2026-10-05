import { Shell } from "@/components/Shell";
import { IdleSignOut } from "@/components/IdleSignOut";
import { SignOutButton } from "@/components/SignOutButton";
import type { Profile } from "@/lib/profile";
import { signOut } from "../sign-in/actions";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "layout-dashboard" },
  { href: "/admin/alumni", label: "Alumni", icon: "graduation-cap" },
  { href: "/admin/visitors", label: "Visitors", icon: "id-card" },
  { href: "/admin/history", label: "History", icon: "history" },
  { href: "/admin/security", label: "Security", icon: "shield-user" },
  { href: "/admin/campus", label: "Campus", icon: "settings" },
  { href: "/admin/reports", label: "Reports", icon: "chart-column" },
];

/** The admin console frame (English only; planning/02 D12 covers the guard console). */
export function AdminShell({ me, title, current, aside, banner, children }: {
  me: Profile; title: string; current: string; aside?: React.ReactNode; banner?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Shell consoleName="admin" title={title} nav={NAV.map((n) => ({ ...n, current: n.href === current }))} identityIcon="user"
      identity={`${me.name} · Admin · ${me.university_name}`} aside={aside} banner={banner}
      actions={<SignOutButton signOut={signOut} />}>
      <IdleSignOut signOut={signOut} />
      {children}
    </Shell>
  );
}
