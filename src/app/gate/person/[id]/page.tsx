import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { BackLink } from "@/components/BackLink";
import { RecordPhoto } from "@/components/RecordPhoto";
import { tr } from "@/lib/i18n";
import { fmtMonth, personMeta, type Kind } from "@/lib/format";
import { photoSrc, requireOnDuty, timeFns } from "@/lib/gate";
import { Today } from "../../Today";
import { Decide } from "./Decide";

export const metadata: Metadata = { title: "Record · Guard console" };

type Person = {
  id: string; full_name: string; kind: Kind; program: string | null; batch_year: number | null;
  photo_path: string | null; photo_added_on: string | null; same_name: number;
  expected: { at: string; purpose: string | null; host: string | null } | null;
  inside: { since: string; gate: string } | null;
  hours: { open: string | null; close: string | null; in_hours: boolean };
};

/** One record: photo, who they are, and the decision (mockups g05, g06, g12; "already inside" is new). */
export default async function PersonPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ q?: string; picked?: string; from?: string }>;
}) {
  const { c: fmtClock, t: fmtTime } = await timeFns();   // this device's 12/24-hour choice
  const duty = await requireOnDuty();
  const { lang } = duty;
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = await createClient();
  const { data } = await supabase.rpc("gate_person", { p_person: id });
  const p = data as Person | null;
  if (!p) notFound();
  // Shares a name with someone else and wasn't picked on the "ask first" screen: go there first (mockup g10).
  if (p.same_name > 1 && sp.picked !== "1") {
    redirect(`/gate/same-name?n=${encodeURIComponent(p.full_name)}&q=${encodeURIComponent((sp.q ?? "").slice(0, 80))}`);
  }

  const src = await photoSrc(p.photo_path);
  const meta = personMeta(lang, p);
  const q = (sp.q ?? "").slice(0, 80);
  const now = fmtTime(new Date().toISOString());

  const outside = !p.hours.in_hours;
  const hours = { open: p.hours.open ? fmtClock(p.hours.open) : "—", close: p.hours.close ? fmtClock(p.hours.close) : "—" };
  // Approve is locked when they're already inside or it's outside visiting hours; the chip says which (owner, 2026-10-07:
  // no instructions under the record).
  const locked = Boolean(p.inside) || outside;

  const chips = (
    <>
      {/* Someone already inside is no longer "expected": only one of the two shows. */}
      {p.expected && !p.inside ? <Chip icon="calendar-clock" text={tr(lang, "chip.expected", { t: fmtTime(p.expected.at) })} /> : null}
      {p.inside ? <Chip kind="hold" icon="triangle-alert" text={tr(lang, "chip.inside", { t: fmtTime(p.inside.since) })} /> : null}
      {!p.inside && outside ? <Chip kind="hold" icon="clock" text={`${tr(lang, "chip.now", { t: now })} · ${tr(lang, "lock.hours", hours)}`} /> : null}
    </>
  );
  const hasChips = Boolean(p.expected || p.inside || outside);
  // Where "back" goes: the search results the guard came from, the Expected list, or Home.
  const back = q ? { href: `/gate?q=${encodeURIComponent(q)}`, label: tr(lang, "back.results") }
    : sp.from === "expected" ? { href: "/gate/expected", label: tr(lang, "title.expected") }
    : { href: "/gate", label: tr(lang, "back.home") };

  return (
    <Shell title={tr(lang, "title.record")} aside={<Today lang={lang} />}>
      <section className="ma-panel" aria-labelledby="who">
        <BackLink href={back.href} label={tr(lang, "back")} />
        <Decide
          key={p.id}
          holdHref={`/gate/hold?person=${p.id}&q=${encodeURIComponent(q)}`}
          lang={lang} personId={p.id} clientId={crypto.randomUUID()} name={p.full_name} meta={meta} thumb={src}
          purpose={p.expected?.purpose ?? ""}
          locked={locked}
          photo={
            <RecordPhoto src={src} name={p.full_name}
              caption={p.photo_added_on ? tr(lang, "photo.added", { d: fmtMonth(p.photo_added_on, lang) }) : null}
              enlargeLabel={tr(lang, "photo.enlarge", { n: p.full_name })}
              altText={`${tr(lang, "photo.alt", { n: p.full_name })}${p.photo_path?.startsWith("sample/") ? " (sample)" : ""}`}
              closeLabel={tr(lang, "close")} noneTitle={tr(lang, "photo.none.t")} />
          }
          heading={
            <div>
              <h2 className="ma-record__name" id="who">{p.full_name}</h2>
              <p className="ma-record__meta">{meta}</p>
              {hasChips ? <div className="ma-record__chips" id="who-chips">{chips}</div> : null}
            </div>
          }
        />
      </section>
    </Shell>
  );
}

function Chip({ icon, text, kind }: { icon: string; text: string; kind?: "hold" }) {
  return (
    <span className={`ma-chip${kind ? ` ma-chip--${kind}` : ""}`}>
      <span className="ma-circle"><Icon name={icon} /></span><span className="ma-tabular">{text}</span>
    </span>
  );
}
