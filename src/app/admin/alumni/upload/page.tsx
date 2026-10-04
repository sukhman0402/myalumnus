import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/profile";
import { Icon } from "@/components/Icon";
import { AdminShell } from "../../AdminShell";
import { BulkUpload } from "./BulkUpload";

export const metadata: Metadata = { title: "Bulk upload · Admin console" };

export default async function BulkUploadPage() {
  const me = await requireRole("admin");
  return (
    <AdminShell me={me} title="Bulk upload" current="/admin/alumni">
      <p><Link className="ma-link" href="/admin/alumni"><Icon name="arrow-left" />Alumni</Link></p>
      <BulkUpload />
    </AdminShell>
  );
}
