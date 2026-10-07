import { PageSkeleton } from "@/components/PageSkeleton";

/** Instant feedback on every admin-page tap (owner, 2026-10-06). The frame stays; this fills the page area. */
export default function Loading() {
  return <PageSkeleton label="Loading…" />;
}
