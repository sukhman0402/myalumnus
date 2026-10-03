import { ICONS } from "./icons";

/** A decorative Lucide icon (always aria-hidden: meaning comes from the visible label next to it). */
export function Icon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const inner = ICONS[name];
  if (!inner) return null;
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      dangerouslySetInnerHTML={{ __html: inner }}
    />
  );
}
