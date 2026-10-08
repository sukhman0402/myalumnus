"use client";

import { useEffect, useState } from "react";

const TZ = "Asia/Kolkata";

/** The time, the date under it (`small`: one line-height card under Today's visits, owner 2026-10-08) (owner, 2026-10-06: the Today section becomes date and time).
 *  Campus time zone, like every other time on the gate screens. Ticks each minute on the minute. */
export function Clock({ lang, label, small, h24 }: { lang: "en" | "hi"; label: string; small?: boolean; h24?: boolean }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: number;
    const tick = () => { setNow(new Date()); timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50); };
    timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    return () => window.clearTimeout(timer);
  }, []);
  const parts = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: h24 ? "2-digit" : "numeric", minute: "2-digit", hour12: !h24 }).formatToParts(now);
  const hm = parts.filter((p) => p.type === "hour" || p.type === "minute" || p.type === "literal").map((p) => p.value).join("").trim();
  const ampm = (parts.find((p) => p.type === "dayPeriod")?.value ?? "").toUpperCase();
  // Built from parts so the server and the browser print the same text (their locale data differ on commas).
  const dp = new Intl.DateTimeFormat(lang === "hi" ? "hi-IN" : "en-IN", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).formatToParts(now);
  const part = (t: string) => dp.find((p) => p.type === t)?.value ?? "";
  const date = `${part("weekday")}, ${part("day")} ${part("month")} ${part("year")}`;
  return (
    <div className={`ma-clock${small ? " ma-clock--small" : ""}`} role="group" aria-label={label}>
      <time className="ma-clock__time ma-tabular" dateTime={now.toISOString()} suppressHydrationWarning>
        {hm}<span className="ma-clock__ampm">{ampm}</span>
      </time>
      <span className="ma-clock__date" suppressHydrationWarning>{date}</span>
    </div>
  );
}
