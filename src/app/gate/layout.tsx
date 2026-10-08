import { Frame } from "@/components/Frame";
import { ProfileBadge } from "@/components/ProfileBadge";
import { gateNav, getLang } from "@/lib/gate";
import { tr } from "@/lib/i18n";
import { requireRole } from "@/lib/profile";

/** The guard console frame: logo, side bar and, top right, the college icon with this device's gate name.
 *  One gate, one device, no guard names (owner, 2026-10-08). Every page still checks the role itself
 *  (Next.js: never rely on a layout for access). */
export default async function GateLayout({ children }: { children: React.ReactNode }) {
  const [me, lang] = await Promise.all([requireRole("gate"), getLang()]);
  const tools = <ProfileBadge icon="university" name={me.gate_name ?? ""} />;
  return (
    <Frame consoleName="gate" home="/gate" homeLabel={tr(lang, "home")} nav={gateNav(lang)} tools={tools} lang={lang}
      skipLabel={tr(lang, "skip.main")} soonLabel={tr(lang, "soon")} showLabels={tr(lang, "rail.show")} hideLabels={tr(lang, "rail.hide")}>
      {children}
    </Frame>
  );
}
