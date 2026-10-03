import { redirect } from "next/navigation";
import { getProfile } from "@/lib/profile";

/** Front door: sends each person to their console. */
export default async function Home() {
  const profile = await getProfile();
  if (!profile) redirect("/sign-in?reason=not-invited");
  redirect(profile.role === "admin" ? "/admin" : "/gate");
}
