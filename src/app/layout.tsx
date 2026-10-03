import type { Metadata, Viewport } from "next";
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

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
