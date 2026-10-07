"use client";

import { useEffect, useState } from "react";

const TZ = "Asia/Kolkata";

/** Large time, the date under it (owner, 2026-10-06: the Today section becomes date and time).
 *  Campus time zone, like every other time on the gate screens. Ticks each minute on the minute. */
export function Clock({ lang, label }: { lang: "en" | "hi"; label: string }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    let timer: number;
    const tick = () => { setNow(new Date()); timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50); };
    timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000) + 50);
    return () => window.clearTimeout(timer);
  }, []);
  const parts = new Intl.DateTimeFormat("en-IN", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true }).formatToParts(now);
  const hm = parts.filter((p) => p.type === "hour" || p.type === "minute" || p.type === "literal").map((p) => p.value).join("").trim();
  const ampm = (parts.find((p) => p.type === "dayPeriod")?.value ?? "").toUpperCase();
  const date = now.toLocaleDateString(lang === "hi" ? "hi-IN" : "en-IN", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return (
    <div className="ma-clock" role="group" aria-label={label}>
      <time className="ma-clock__time ma-tabular" dateTime={now.toISOString()} suppressHydrationWarning>
        {hm}<span className="ma-clock__ampm">{ampm}</span>
      </time>
      <span className="ma-clock__date" suppressHydrationWarning>{date}</span>
    </div>
  );
}
