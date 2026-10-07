/** Initials avatar for staff (guards, admins, gate devices). Owner, 2026-10-06: "Initials avatars".
 *  Visitors never get initials: on a visitor record a wrong letter could read as an identity (photo rule, research/50).
 *  Decorative: the name is always written next to it. */
const TITLES = /^(dr|prof|mr|mrs|ms|shri|smt)\.?$/i;

export function initials(name: string) {
  const words = name.replace(/[·|,]/g, " ").split(/\s+/).filter((w) => w && !TITLES.test(w));
  if (!words.length) return "?";
  const first = words[0].replace(/\./g, "");
  const last = words.length > 1 ? words[words.length - 1].replace(/\./g, "") : "";
  return ((first[0] ?? "") + (last[0] ?? "")).toUpperCase() || "?";
}

export function Avatar({ name, size = "md", icon }: { name: string; size?: "sm" | "md" | "lg"; icon?: React.ReactNode }) {
  return <span className={`ma-avatar ma-avatar--${size}`} aria-hidden="true">{icon ?? initials(name)}</span>;
}
