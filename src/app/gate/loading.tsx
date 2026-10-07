import { PageSkeleton } from "@/components/PageSkeleton";

/** Instant feedback on every guard-page tap (owner, 2026-10-06: "slow navigation on click"). The frame stays;
 *  this skeleton fills the page area until the page's data is back. Static text: the layout knows the language,
 *  but a loading state can't read it, so it says "Loading…" in both scripts for screen readers. */
export default function Loading() {
  return <PageSkeleton label="Loading… · लोड हो रहा है…" aside />;
}
