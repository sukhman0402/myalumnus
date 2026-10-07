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
  const theme = (await cookies()).get("ma-theme")?.value === "dark" ? "dark" : "light";
  return (
    <html lang="en" data-theme={theme}>
      <body>{children}</body>
    </html>
  );
}
