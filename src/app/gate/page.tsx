import type { Metadata } from "next";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { startShift, endShift } from "./actions";

export const metadata: Metadata = { title: "Search · Guard console" };

const NAV = [
  { href: "/gate", label: "Search", icon: "search", current: true },
  { href: "/gate/expected", label: "Expected today", icon: "calendar-clock", soon: true },
  { href: "/gate/inside", label: "Inside now", icon: "users", soon: true },
];

export default async function GatePage() {
  const me = await requireRole("gate");
  const supabase = await createClient();
  const { data: shift } = await supabase.from("shifts")
    .select("id, started_at, guard:staff!shifts_guard_id_fkey(name, shift_label)")
    .eq("device_id", me.staff_id).is("ended_at", null).order("started_at", { ascending: false }).limit(1).maybeSingle();
  const guard = shift?.guard as unknown as { name: string; shift_label: string | null } | null;

  if (!shift || !guard) {
    const { data: guards } = await supabase.from("staff").select("id, name, shift_label")
      .eq("role", "guard").eq("gate_id", me.gate_id!).eq("active", true).order("name");
    return (
      <Shell title="Who's on duty?" nav={NAV} identityIcon="shield-user" identity={`${me.gate_name} · ${me.university_name}`}>
        <section className="ma-panel" aria-labelledby="pick">
          <h2 className="ma-panel__title" id="pick">Tap your name to start your shift</h2>
          <p className="ma-note">Every entry you make is recorded under your name until the next guard taps theirs.</p>
          {guards && guards.length ? (
            <ul className="ma-guardpick">
              {guards.map((g) => (
                <li key={g.id}>
                  <form action={startShift}>
                    <input type="hidden" name="guard_id" value={g.id} />
                    <button className="ma-btn ma-btn--secondary"><Icon name="shield-user" />{g.name}{g.shift_label ? ` · ${g.shift_label}` : ""}</button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <div className="ma-list"><div className="ma-empty"><b>No guards on this gate&apos;s list</b><span>Ask an admin to add guards for {me.gate_name} in Security.</span></div></div>
          )}
        </section>
      </Shell>
    );
  }

  const since = new Date(shift.started_at).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }).toUpperCase();
  return (
    <Shell title="Search" nav={NAV} identityIcon="shield-user"
      identity={`${guard.name}${guard.shift_label ? ` · Shift ${guard.shift_label}` : ""} · ${me.gate_name}`}
      actions={<form action={endShift} className="ma-inline-form"><button className="ma-btn ma-btn--secondary"><Icon name="users" />Change guard</button></form>}>
      <section className="ma-panel" aria-labelledby="ready">
        <h2 className="ma-panel__title" id="ready">On duty since {since}</h2>
        <p className="ma-note">Build slice 0: the gate is signed in and your shift is recorded. Search, Approve, Deny and Flag &amp; Hold arrive in slice 1.</p>
      </section>
    </Shell>
  );
}
