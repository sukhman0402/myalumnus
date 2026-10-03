import Link from "next/link";
import { Icon } from "./Icon";
import { tr, type Lang } from "@/lib/i18n";

/** Flag & Hold: opens the hold form with what the guard already knows. */
export function HoldLink({ lang, href }: { lang: Lang; href: string }) {
  return (
    <Link className="ma-decision ma-decision--hold" href={href}>
      <Icon name="flag" className="ma-ic" />{tr(lang, "dec.hold")}
    </Link>
  );
}
