import { redirect } from "next/navigation";

// Retired in Iteration 3 (cleanup, 2026-10-08): this list now lives on the guard's Home, and nothing links here any
// more. An old bookmark lands on Home instead of a page with no way back.
export default function Retired() {
  redirect("/gate");
}
