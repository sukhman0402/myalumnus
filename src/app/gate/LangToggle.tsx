import { Icon } from "@/components/Icon";
import { tr, type Lang } from "@/lib/i18n";
import { setLang } from "./actions";

/** One tap switches the guard console between English and Hindi. The button names the other language in its own script. */
export function LangToggle({ lang }: { lang: Lang }) {
  const other: Lang = lang === "en" ? "hi" : "en";
  return (
    <form action={setLang} className="ma-inline-form">
      <input type="hidden" name="lang" value={other} />
      <button className="ma-btn ma-btn--secondary" aria-label={`${tr(lang, "lang.label")}: ${tr(lang, "lang.switch")}`}>
        <Icon name="languages" /><span lang={other}>{tr(lang, "lang.switch")}</span>
      </button>
    </form>
  );
}
