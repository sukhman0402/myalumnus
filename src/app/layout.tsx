import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "@/styles/font.css";
import "@/styles/tokens.css";
import "@/styles/components.css";
import "@/styles/screens.css";
import "./app.css";

export const metadata: Metadata = {
  title: { default: "My Alumnus", template: "%s · My Alumnus" },
  description: "Campus-gate visitor verification: guard and admin consoles.",
  robots: { index: false, follow: false }, // private live: invite-only, not listed in search engines
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

/** Light unless this device chose dark with the moon button (cookie `ma-theme`, set by components/ThemeToggle). */
export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const jar = await cookies();
  const theme = jar.get("ma-theme")?.value === "dark" ? "dark" : "light";
  // Text size chosen in guard Settings (owner, 2026-10-08): scales every rem-based size on this device.
  const text = jar.get("ma-text")?.value;
  return (
    <html lang="en" data-theme={theme} data-text={text === "large" || text === "larger" ? text : undefined}>
      <body>{children}</body>
    </html>
  );
}
