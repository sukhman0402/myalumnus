"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "./BrandMark";
import { Icon } from "./Icon";
import type { NavItem } from "./Shell";

/** The nav item for this address: the longest item address the path starts with; the console home (first item)
 *  covers every page no other item claims (a record, a held case, the hold form…). */
export function currentHref(nav: NavItem[], path: string) {
  const hits = nav.filter((n) => path === n.href || path.startsWith(`${n.href}/`)).sort((a, b) => b.href.length - a.href.length);
  return hits[0]?.href ?? nav[0]?.href;
}

/**
 * The logo (goes to this console's home) and the side bar, in two states (owner decision 2026-10-05): icons only
 * (starts this way), or icon + label side by side after tapping the arrow. The choice is remembered per device and
 * per console in a cookie, so the server draws the right state on the first paint (no jump).
 * The rail lives in the console layout, so it stays on screen between pages; the current item follows the address
 * (owner, 2026-10-06: the logo goes home; the bar lines up with the first card, the logo sits in the title row).
 */
export function Rail({ nav, home, homeLabel, soonLabel, initialOpen, consoleName, showLabel, hideLabel }: {
  nav: NavItem[]; home: string; homeLabel: string; soonLabel: string; initialOpen: boolean; consoleName: string; showLabel: string; hideLabel: string;
}) {
  const [open, setOpen] = useState(initialOpen);
  const path = usePathname();
  const current = currentHref(nav, path);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    document.cookie = `ma-rail-${consoleName}=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax; secure`;
  };
  return (
    <>
      <Link href={home} className={`ma-brand${open ? " is-open" : ""}`} aria-label={homeLabel} title={homeLabel}>
        <span className="ma-rail__logo"><BrandMark /></span><span className="ma-brand__name" aria-hidden="true">My Alumnus</span>
      </Link>
      <nav className={`ma-rail${open ? " is-open" : ""}`} aria-label="Main" id="ma-rail">
        {nav.map((n) => n.soon ? (
          <span key={n.href} className="ma-rail__item" aria-disabled="true" title={`${n.label}: ${soonLabel}`}>
            <Icon name={n.icon} /><span className="ma-rail__label">{n.label}</span>
          </span>
        ) : (
          <Link key={n.href} className="ma-rail__item" href={n.href} aria-current={n.href === current ? "page" : undefined} title={open ? undefined : n.label}>
            <Icon name={n.icon} /><span className="ma-rail__label">{n.label}</span>
          </Link>
        ))}
        <button type="button" className="ma-rail__item ma-rail__toggle" onClick={toggle} aria-expanded={open} aria-controls="ma-rail"
          title={open ? undefined : showLabel}>
          <Icon name={open ? "chevron-left" : "chevron-right"} /><span className="ma-rail__label">{open ? hideLabel : showLabel}</span>
        </button>
      </nav>
    </>
  );
}
