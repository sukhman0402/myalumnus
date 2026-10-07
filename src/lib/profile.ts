import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "gate" | "guard";
export type Profile = {
  staff_id: string;
  name: string;
  role: Role;
  university_id: string;
  university_name: string;
  gate_id: string | null;
  gate_name: string | null;
};

/** The signed-in person's staff record, or null if signed in but not invited (or signed out).
 *  Read once per request: the console layout and the page share it (React cache). */
export const getProfile = cache(async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_profile");
  if (error || !data || data.length === 0) return null;
  return data[0] as Profile;
});

/** For pages and Server Functions: require one role, otherwise send the person to the right place. */
export async function requireRole(role: Role): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/sign-in?reason=not-invited");
  if (profile.role !== role) redirect("/");
  return profile;
}
