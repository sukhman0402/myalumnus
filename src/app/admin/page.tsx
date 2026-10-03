import type { Metadata } from "next";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { IdleSignOut } from "@/components/IdleSignOut";
import { signOut } from "../sign-in/actions";

export const metadata: Metadata = { title: "Dashboard · Admin console" };

const NAV = [
  { href: "/admin", label: "Dashboard", icon: "layout-dashboard", current: true },
  { href: "/admin/alumni", label: "Alumni", icon: "graduation-cap", soon: true },
  { href: "/admin/visitors", label: "Visitors", icon: "id-card", soon: true },
  { href: "/admin/history", label: "History", icon: "history", soon: true },
  { href: "/admin/security", label: "Security", icon: "shield-user", soon: true },
  { href: "/admin/campus", label: "Campus", icon: "settings", soon: true },
  { href: "/admin/reports", label: "Reports", icon: "chart-column", soon: true },
];

export default async function AdminDashboard() {
  const me = await requireRole("admin");
  const supabase = await createClient();
  // Counts come through row-level security: they prove this admin reads only their own university.
  const [people, staff, gates, rules] = await Promise.all([
    supabase.from("people").select("id", { count: "exact", head: true }),
    supabase.from("staff").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("gates").select("name").order("name"),
    supabase.from("campus_rules").select("open_time, close_time, escalate_minutes").limit(1).maybeSingle(),
  ]);
  const t = (s?: string) => s ? new Date(`1970-01-01T${s}`).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase() : "—";

  return (
    <Shell title="Dashboard" nav={NAV} identityIcon="user" identity={`${me.name} · Admin · ${me.university_name}`}
      actions={<form action={signOut} className="ma-inline-form"><button className="ma-btn ma-btn--secondary"><Icon name="arrow-right" />Sign out</button></form>}>
      <IdleSignOut signOut={signOut} />
      <section className="ma-panel" aria-labelledby="found">
        <h2 className="ma-panel__title" id="found">Foundation is live</h2>
        <p className="ma-note">Build slice 0: sign-in, roles and the database. The escalation queue and the other admin screens arrive in slices 2 and 4.</p>
        <div className="ma-stats">
          <div className="ma-card"><span className="ma-card__value ma-tabular">{people.count ?? "—"}</span><span className="ma-card__label">People on record</span></div>
          <div className="ma-card"><span className="ma-card__value ma-tabular">{staff.count ?? "—"}</span><span className="ma-card__label">Staff and gate devices</span></div>
          <div className="ma-card"><span className="ma-card__value ma-tabular">{gates.data?.length ?? "—"}</span><span className="ma-card__label">Gates</span></div>
          <div className="ma-card"><span className="ma-card__value ma-tabular">{rules.data?.escalate_minutes ?? "—"} min</span><span className="ma-card__label">Escalation hand-off</span></div>
        </div>
        <dl className="ma-kv">
          <dt>University</dt><dd>{me.university_name} (fictional)</dd>
          <dt>Visiting hours</dt><dd className="ma-tabular">{t(rules.data?.open_time)} – {t(rules.data?.close_time)}</dd>
          <dt>Gates</dt><dd>{gates.data?.map((g) => g.name).join(" · ") || "—"}</dd>
        </dl>
      </section>
    </Shell>
  );
}
