import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { ymd } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { AdminShell } from "../../AdminShell";
import { AddVisitorForm } from "./AddVisitorForm";

export const metadata: Metadata = { title: "Add visitor · Admin console" };

export default async function AddVisitorPage() {
  const me = await requireRole("admin");
  const supabase = await createClient();
  const { data } = await supabase.from("gates").select("id, name").order("name");
  return (
    <AdminShell me={me} title="Add visitor" current="/admin/visitors">
      <section className="ma-panel" aria-labelledby="avh">
        <Link className="ma-link" href="/admin/visitors"><Icon name="arrow-left" />Visitors</Link>
        <h2 className="ma-panel__title" id="avh">Add an expected visitor</h2>
        <AddVisitorForm gates={(data ?? []) as { id: string; name: string }[]} today={ymd()} />
      </section>
    </AdminShell>
  );
}
