import { Shell } from "@/components/Shell";
import { tr } from "@/lib/i18n";
import { gateNav, identity, type Duty, type GateSection } from "@/lib/gate";
import { LangToggle } from "./LangToggle";
import { Today } from "./Today";
import { OfflineSync } from "./OfflineSync";

/** Every guard screen after the name picker: rail, title bar with the guard on duty, and the Today tiles. */
export function GateShell({ duty, title, section, banner, actions, children }: {
  duty: Duty; title: string; section: GateSection; banner?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode;
}) {
  const { lang } = duty;
  return (
    <Shell lang={lang} showLabels={tr(lang, "rail.show")} hideLabels={tr(lang, "rail.hide")} skipLabel={tr(lang, "skip.main")} soonLabel={tr(lang, "soon")} nav={gateNav(lang, section)}
      title={title} identityIcon="shield-user" identity={identity(duty)} banner={banner}
      actions={<>{actions}<LangToggle lang={lang} /></>} aside={<Today lang={lang} />}>
      <OfflineSync lang={lang} />
      {children}
    </Shell>
  );
}
