import type { Metadata } from "next";
import { getTheme } from "@/components/Frame";
import { Icon } from "@/components/Icon";
import { SignOutButton } from "@/components/SignOutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DEMO_MODE } from "@/lib/demo";
import { tr } from "@/lib/i18n";
import { fmtTime } from "@/lib/format";
import { requireOnDuty } from "@/lib/gate";
import { signOut } from "../../sign-in/actions";
import { endShift } from "../actions";
import { GateShell } from "../GateShell";
import { LangToggle } from "../LangToggle";

export const metadata: Metadata = { title: "Settings · Guard console" };

/** Everything that isn't a visitor decision (owner, 2026-10-06): language, dark mode, change guard, sign out. */
export default async function GateSettingsPage() {
  const [duty, theme] = await Promise.all([requireOnDuty("settings"), getTheme()]);
  const { lang } = duty;
  const row = (id: string, title: string, sub: string, control: React.ReactNode) => (
    <section className="ma-panel ma-setting" aria-labelledby={id}>
      <div className="ma-setting__text"><h2 className="ma-panel__title" id={id}>{title}</h2><p className="ma-note">{sub}</p></div>
      <div className="ma-actions">{control}</div>
    </section>
  );
  return (
    <GateShell duty={duty} title={tr(lang, "title.settings")}>
      {row("s-duty", tr(lang, "set.duty"), tr(lang, "set.duty.sub", { n: duty.guard.name, t: fmtTime(duty.since) }),
        <form action={endShift} className="ma-inline-form"><button className="ma-btn ma-btn--primary"><Icon name="users" />{tr(lang, "duty.change")}</button></form>)}
      {row("s-lang", tr(lang, "set.lang"), tr(lang, "set.lang.sub"), <LangToggle lang={lang} />)}
      {row("s-theme", tr(lang, "set.theme"), tr(lang, "set.theme.sub"),
        <ThemeToggle variant="row" initial={theme} darkLabel={tr(lang, "theme.dark")} lightLabel={tr(lang, "theme.light")} />)}
      {row("s-device", tr(lang, "set.device"), `${duty.me.gate_name ?? ""} · ${duty.me.university_name}`,
        DEMO_MODE ? <SignOutButton signOut={signOut} label={tr(lang, "signout")} /> : null)}
    </GateShell>
  );
}
