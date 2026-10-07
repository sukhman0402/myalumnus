import { Shell } from "@/components/Shell";
import type { Profile } from "@/lib/profile";

/** One admin page: title row and columns. The rail, logo, profile badge and sign-out come from app/admin/layout.tsx.
 *  `me` and `current` are kept for the callers; the rail now follows the address. */
export function AdminShell({ title, aside, banner, children }: {
  me?: Profile; title: string; current?: string; aside?: React.ReactNode; banner?: React.ReactNode; children: React.ReactNode;
}) {
  return <Shell title={title} aside={aside} banner={banner}>{children}</Shell>;
}
