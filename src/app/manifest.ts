import type { MetadataRoute } from "next";

/** Lets the consoles be added to an iPad's Home Screen, which iPadOS requires before it shows web alerts (Q2). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "My Alumnus",
    short_name: "My Alumnus",
    description: "Campus-gate visitor verification: guard and admin consoles.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f4f5f7",
    theme_color: "#1d2333",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
