"use client";

import { useEffect, useState } from "react";

/** mm:ss since a moment (the escalation timer). Counts up once a second on the device's clock. */
export function Timer({ since }: { since: string }) {
  const start = new Date(since).getTime();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, []);
  const s = Math.max(0, Math.floor(((now ?? start) - start) / 1000));
  const text = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  return <span className="ma-timer ma-tabular" suppressHydrationWarning>{text}</span>;
}
