import Link from "next/link";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

/** Who is using this console, top right (owner, 2026-10-06: "profile badge on the top right panel").
 *  Name on the first line, role / gate on the second; `inline` puts the gate to the right of the name (guard console). With no person (gate device, nobody on duty) the
 *  avatar shows the gate icon instead of initials. */
export function ProfileBadge({ name, detail, device, href, hrefLabel, inline }: { name: string; detail: string; device?: boolean; href?: string; hrefLabel?: string; inline?: boolean }) {
  const inner = (
    <>
      <Avatar name={name} icon={device ? <Icon name="shield-user" size={18} /> : undefined} />
      <span className="ma-badge__text"><b>{name}</b><span>{detail}</span></span>
    </>
  );
  // With a link (guard console: to Settings, where the guard changes over), the whole badge is the target.
  return href
    ? <Link className={`ma-badge ma-badge--link${inline ? " ma-badge--inline" : ""}`} href={href} aria-label={`${name}, ${detail}. ${hrefLabel ?? ""}`.trim()}>{inner}</Link>
    : <div className={`ma-badge${inline ? " ma-badge--inline" : ""}`}>{inner}</div>;
}
