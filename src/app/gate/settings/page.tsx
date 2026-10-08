import type { Metadata } from "next";
import { getTheme } from "@/components/Frame";
import { SignOutButton } from "@/components/SignOutButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DEMO_MODE } from "@/lib/demo";
import { tr } from "@/lib/i18n";
import { asTextSize, requireOnDuty, TEXT_COOKIE, timeFns } from "@/lib/gate";
import { cookies } from "next/headers";
import { ChoiceGroup } from "@/components/ChoiceGroup";
import { setHours, setTextSize } from "../actions";
import { switchConsole } from "../../sign-in/actions";
import { GateShell } from "../GateShell";
import { LangToggle } from "../LangToggle";

export const metadata: Metadata = { title: "Settings · Guard console" };

/** Everything that isn't a visitor decision (owner, 2026-10-08): language, display, text size, time format.
 *  No change guard, no sign-out (one gate, one device). */
export default async function GateSettingsPage() {
  const [duty, theme, { h24 }, jar] = await Promise.all([requireOnDuty(), getTheme(), timeFns(), cookies()]);
  const text = asTextSize(jar.get(TEXT_COOKIE)?.value);
  const { lang } = duty;
  const row = (id: string, title: string, sub: string, control: React.ReactNode) => (
    <section className="ma-panel ma-setting" aria-labelledby={id}>
      <div className="ma-setting__text"><h2 className="ma-panel__title" id={id}>{title}</h2><p className="ma-note">{sub}</p></div>
      <div className="ma-actions">{control}</div>
    </section>
  );
  return (
    <GateShell duty={duty} title={tr(lang, "title.settings")}>
      {row("s-lang", tr(lang, "set.lang"), tr(lang, "set.lang.sub"), <LangToggle lang={lang} />)}
      {row("s-theme", tr(lang, "set.theme"), tr(lang, "set.theme.sub"),
        <ThemeToggle variant="row" initial={theme} darkLabel={tr(lang, "theme.dark")} lightLabel={tr(lang, "theme.light")} />)}
      {row("s-text", tr(lang, "set.text"), tr(lang, "set.text.sub"),
        <ChoiceGroup action={setTextSize} name="text" value={text} label={tr(lang, "set.text")}
          options={[["default", tr(lang, "text.default")], ["large", tr(lang, "text.large")], ["larger", tr(lang, "text.larger")]]} />)}
      {row("s-hours", tr(lang, "set.hours"), tr(lang, "set.hours.sub"),
        <ChoiceGroup action={setHours} name="hours" value={h24 ? "24" : "12"} label={tr(lang, "set.hours")}
          options={[["12", tr(lang, "hours.12")], ["24", tr(lang, "hours.24")]]} />)}
      {/* No sign-out on a gate device: it is signed in once, at setup (owner, 2026-10-08). The demo keeps a way across. */}
      {DEMO_MODE ? row("s-demo", tr(lang, "set.device"), tr(lang, "set.signout.sub"), <SignOutButton signOut={switchConsole.bind(null, "admin")} label={tr(lang, "signout")} />) : null}
    </GateShell>
  );
}
