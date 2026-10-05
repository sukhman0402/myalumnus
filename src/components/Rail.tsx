"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "./Icon";
import type { NavItem } from "./Shell";

/**
 * The side bar, in two states (owner decision 2026-10-05): icons only (starts this way), or icon + label side by
 * side after tapping the arrow. The choice is remembered per device and per console in a cookie, so the server
 * draws the right state on the first paint (no jump). In the icons-only state each item still has its label for
 * screen readers and a hover tooltip, and the current page stays highlighted.
 */
export function Rail({ nav, soonLabel, initialOpen, consoleName, showLabel, hideLabel }: {
  nav: NavItem[]; soonLabel: string; initialOpen: boolean; consoleName: string; showLabel: string; hideLabel: string;
}) {
  const [open, setOpen] = useState(initialOpen);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    document.cookie = `ma-rail-${consoleName}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax; secure`;
  };
  return (
    <nav className={`ma-rail${open ? " is-open" : ""}`} aria-label="Main" id="ma-rail">
      <div className="ma-rail__logo" aria-hidden="true">MA</div>
      {nav.map((n) => n.soon ? (
        <span key={n.href} className="ma-rail__item" aria-disabled="true" title={`${n.label}: ${soonLabel}`}>
          <Icon name={n.icon} /><span className="ma-rail__label">{n.label}</span>
        </span>
      ) : (
        <Link key={n.href} className="ma-rail__item" href={n.href} aria-current={n.current ? "page" : undefined} title={open ? undefined : n.label}>
          <Icon name={n.icon} /><span className="ma-rail__label">{n.label}</span>
        </Link>
      ))}
      <button type="button" className="ma-rail__item ma-rail__toggle" onClick={toggle} aria-expanded={open} aria-controls="ma-rail"
        title={open ? undefined : showLabel}>
        <Icon name={open ? "chevron-left" : "chevron-right"} /><span className="ma-rail__label">{open ? hideLabel : showLabel}</span>
      </button>
    </nav>
  );
}
