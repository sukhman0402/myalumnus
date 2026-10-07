import { Frame } from "@/components/Frame";
import { ProfileBadge } from "@/components/ProfileBadge";
import { gateNav, getDuty, getLang } from "@/lib/gate";
import { tr } from "@/lib/i18n";
import { requireRole } from "@/lib/profile";

/** The guard console frame: logo, side bar and the profile badge of the guard on duty. Stays on screen between
 *  pages; every page still checks the role and the duty itself (Next.js: never rely on a layout for access). */
export default async function GateLayout({ children }: { children: React.ReactNode }) {
  const [me, duty, lang] = await Promise.all([requireRole("gate"), getDuty(), getLang()]);
  // Only the badge up here (owner, 2026-10-06): language, dark mode, change guard and sign out live in Settings.
  // Badge: initials, the guard's name, and the gate to its right; no shift times (owner, 2026-10-07).
  const tools = duty
    ? <ProfileBadge inline name={duty.guard.name} detail={me.gate_name ?? ""} href="/gate/settings" hrefLabel={tr(lang, "nav.settings")} />
    : <ProfileBadge device inline name={tr(lang, "badge.noduty")} detail={me.gate_name ?? ""} />;
  return (
    <Frame consoleName="gate" home="/gate" homeLabel={tr(lang, "home")} nav={gateNav(lang)} tools={tools} lang={lang}
      skipLabel={tr(lang, "skip.main")} soonLabel={tr(lang, "soon")} showLabels={tr(lang, "rail.show")} hideLabels={tr(lang, "rail.hide")}>
      {children}
    </Frame>
  );
}
