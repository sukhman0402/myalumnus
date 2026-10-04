import "server-only";
import { createClient } from "@/lib/supabase/server";

export type StaffRow = {
  id: string; name: string; role: "admin" | "gate" | "guard"; email: string | null; gate_id: string | null; gate: string | null;
  shift_label: string | null; active: boolean; signed_in: boolean; me: boolean; on_shift: boolean;
};
export const ROLE_LABEL = { guard: "Guard", gate: "Gate device", admin: "Admin" } as const;

export async function getStaff() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_staff");
  return { ...((data ?? { staff: [], gates: [] }) as { staff: StaffRow[]; gates: { id: string; name: string }[] }), error };
}
