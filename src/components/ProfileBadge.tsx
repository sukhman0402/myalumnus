import Link from "next/link";
import { Avatar } from "./Avatar";
import { Icon } from "./Icon";

/** Top right of each console. Admin: initials + name only (owner, 2026-10-08). Guard device: the college icon + the gate
 *  name (one gate, one device, no guard names: owner, 2026-10-08). `icon` replaces the initials with an icon. */
export function ProfileBadge({ name, detail, icon, href, hrefLabel }: { name: string; detail?: string; icon?: string; href?: string; hrefLabel?: string }) {
  const inner = (
    <>
      <Avatar name={name} icon={icon ? <Icon name={icon} size={18} /> : undefined} />
      <span className="ma-badge__text"><b>{name}</b>{detail ? <span>{detail}</span> : null}</span>
    </>
  );
  return href
    ? <Link className="ma-badge ma-badge--link" href={href} aria-label={`${name}${detail ? `, ${detail}` : ""}. ${hrefLabel ?? ""}`.trim()}>{inner}</Link>
    : <div className="ma-badge">{inner}</div>;
}
