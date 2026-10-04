"use client";

import { Icon } from "./Icon";
import { unsubscribeThisBrowser } from "./PushToggle";

/** Sign out, first stopping this browser's alerts so a shared computer doesn't keep receiving them. */
export function SignOutButton({ signOut }: { signOut: () => Promise<void> }) {
  return (
    <form className="ma-inline-form" action={async () => { await unsubscribeThisBrowser(); await signOut(); }}>
      <button className="ma-btn ma-btn--secondary"><Icon name="arrow-right" />Sign out</button>
    </form>
  );
}
