import Link from "next/link";

/** One plain "Back" button on every inner gate screen (owner, 2026-10-07: generic, no icon, no screen name). */
export function BackLink({ href, label }: { href: string; label: string }) {
  return <Link className="ma-back" href={href}>{label}</Link>;
}
