import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { IdleSignOut } from "@/components/IdleSignOut";
import type { Profile } from "@/lib/profile";
import { signOut } from "../sign-in/actions";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "layout-dashboard" },
  { href: "/admin/alumni", label: "Alumni", icon: "graduation-cap", soon: true },
  { href: "/admin/visitors", label: "Visitors", icon: "id-card", soon: true },
  { href: "/admin/history", label: "History", icon: "history", soon: true },
  { href: "/admin/security", label: "Security", icon: "shield-user", soon: true },
  { href: "/admin/campus", label: "Campus", icon: "settings", soon: true },
  { href: "/admin/reports", label: "Reports", icon: "chart-column", soon: true },
];

/** The admin console frame (English only; planning/02 D12 covers the guard console). */
export function AdminShell({ me, title, current, aside, banner, children }: {
  me: Profile; title: string; current: string; aside?: React.ReactNode; banner?: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Shell title={title} nav={NAV.map((n) => ({ ...n, current: n.href === current }))} identityIcon="user"
      identity={`${me.name} · Admin · ${me.university_name}`} aside={aside} banner={banner}
      actions={<form action={signOut} className="ma-inline-form"><button className="ma-btn ma-btn--secondary"><Icon name="arrow-right" />Sign out</button></form>}>
      <IdleSignOut signOut={signOut} />
      {children}
    </Shell>
  );
}
