import { fmtDate, fmtTime } from "@/lib/format";

export type Change = { at: string; action: string; actor: string; changed: Record<string, [unknown, unknown]> | null };

/** "Changes" panel: the audit log for one row, in words (planning/02 D7). */
export function ChangeLog({ rows, labels, added }: { rows: Change[]; labels: Record<string, string>; added: string }) {
  const show = (key: string, v: unknown) => {
    if (key === "photo_path") return v ? "a photo" : "none";
    if (key === "active") return v ? "yes" : "no";
    if (key === "gate_id") return "another gate";
    if (v === null || v === undefined || v === "") return "empty";
    return String(v).replace(/^(\d{2}:\d{2}):00$/, "$1");
  };
  const lines = rows.flatMap((r) => {
    if (r.action === "INSERT") return [{ r, text: added }];
    if (r.action !== "UPDATE" || !r.changed) return [];
    const parts = Object.entries(r.changed).filter(([k]) => labels[k]).map(([k, [a, b]]) =>
      k === "photo_path" ? (b ? (a ? "Replaced the photo" : "Added a photo") : "Removed the photo")
        : k === "active" ? (b ? "Turned it back on" : "Turned it off")
        : `${labels[k]}: ${show(k, a)} → ${show(k, b)}`);
    return parts.length ? [{ r, text: parts.join(" · ") }] : [];
  });
  if (!lines.length) return <p className="ma-note">No changes yet.</p>;
  return (
    <ol className="ma-trail">
      {lines.map(({ r, text }, i) => (
        <li key={i}><time>{fmtDate(r.at)}, {fmtTime(r.at)}</time><span><b>{r.actor}</b>: {text}</span></li>
      ))}
    </ol>
  );
}
