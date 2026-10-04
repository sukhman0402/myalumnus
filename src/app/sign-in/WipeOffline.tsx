"use client";

import { useEffect } from "react";
import { wipeOffline } from "@/lib/offline";

/** Opening the sign-in page clears anything the gate saved for offline use (planning/02 D11: wiped on sign-out). */
export function WipeOffline() {
  useEffect(() => { wipeOffline(); }, []);
  return null;
}
