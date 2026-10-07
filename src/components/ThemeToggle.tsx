"use client";

import { useState } from "react";
import { Icon } from "./Icon";

export const THEME_COOKIE = "ma-theme";

/**
 * Light / dark switch (owner, 2026-10-06: "Dark mode option not visible"). Applies at once on this device,
 * without a reload, and is remembered in a cookie so the server draws the right theme on the next first paint.
 * `variant="row"` is the labelled version for a Settings page.
 */
export function ThemeToggle({ initial, darkLabel, lightLabel, variant = "icon" }: {
  initial: "light" | "dark"; darkLabel: string; lightLabel: string; variant?: "icon" | "row";
}) {
  const [theme, setTheme] = useState(initial);
  const dark = theme === "dark";
  const flip = () => {
    const next = dark ? "light" : "dark";
    setTheme(next);
    document.documentElement.dataset.theme = next;
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax; secure`;
  };
  if (variant === "row") {
    return (
      <button type="button" className="ma-btn ma-btn--secondary" role="switch" aria-checked={dark} onClick={flip}>
        <Icon name={dark ? "sun" : "moon"} />{dark ? lightLabel : darkLabel}
      </button>
    );
  }
  return (
    <button type="button" className="ma-iconbtn" aria-label={darkLabel} aria-pressed={dark} title={dark ? lightLabel : darkLabel} onClick={flip}>
      <Icon name={dark ? "sun" : "moon"} />
    </button>
  );
}
