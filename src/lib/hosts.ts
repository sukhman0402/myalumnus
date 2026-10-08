import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Host = { id: string; name: string; department: string | null; phone: string | null; active: boolean };

/** The hosts list (owner, 2026-10-08): kept in the database only, set up once and edited there by hand.
 *  Read by Add visitor; admins only (row-level security). */
export async function getHosts(activeOnly = false): Promise<Host[]> {
  const supabase = await createClient();
  let q = supabase.from("hosts").select("id, name, department, phone, active").order("name");
  if (activeOnly) q = q.eq("active", true);
  const { data } = await q;
  return (data ?? []) as Host[];
}

/** "Prof. S. Rao, Mechanical Engineering": what the visit stores and the guard sees. */
export const hostLabel = (h: Pick<Host, "name" | "department">) => (h.department ? `${h.name}, ${h.department}` : h.name);
