"use client";

import { useEffect, useRef } from "react";

/** One floating tooltip for every chart mark with data-tip (mouse and pen). Screen readers get each chart's text instead. */
export function ChartTips() {
  const tip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const el = tip.current;
      if (!el) return;
      const t = (e.target as Element | null)?.closest?.("[data-tip]") as HTMLElement | SVGElement | null;
      if (!t || e.pointerType === "touch") { el.hidden = true; return; }
      el.textContent = t.getAttribute("data-tip");
      el.style.left = `${e.clientX}px`;
      el.style.top = `${e.clientY}px`;
      el.hidden = false;
    };
    document.addEventListener("pointermove", move);
    return () => document.removeEventListener("pointermove", move);
  }, []);
  return <div ref={tip} className="ma-chart-tip" hidden aria-hidden="true" />;
}
