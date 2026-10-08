export type Report = {
  from: string; days: number; visits: number; family_groups: number; family_guests: number; family_overstays: number;
  held: number; held_approved: number; held_denied: number; held_left?: number; held_open: number; overstays: number;
  outcomes: { gate_approved: number; held_approved: number; gate_denied: number; held_denied: number; held_left?: number };
  admin_decided: number; median_admin_seconds: number | null; passed_to_host: number; passed_to_admin?: number;
  escalations: { name: string; created_at: string; decided_at: string | null; passed_at: string | null; to_admin_at?: string | null; status: string; by_role: string | null }[];
  by_day: { d: string; n: number }[]; by_hour: { h: number; n: number }[];
  by_type: { type: string; visits: number; held: number; denied: number; overstays: number }[];
  hours: { open: string; close: string; escalate_minutes: number } | null;
};
