import type { Metadata } from "next";
import { BrandMark } from "@/components/BrandMark";
import { DEMO_MODE } from "@/lib/demo";
import { DemoSignIn } from "./DemoSignIn";
import { SignInForm } from "./SignInForm";
import { WipeOffline } from "./WipeOffline";
import { signOut } from "./actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedInButNotInvited = !DEMO_MODE && reason === "not-invited" && Boolean(data?.claims?.sub);

  return (
    <main className="ma-signin" id="main">
      <WipeOffline />
      <div className="ma-signin__card">
        <div className="ma-signin__brand">
          <div className="ma-rail__logo" aria-hidden="true"><BrandMark /></div>
          <h1>{DEMO_MODE ? "My Alumnus" : "Sign in to My Alumnus"}</h1>
        </div>
        {DEMO_MODE ? <DemoSignIn /> : signedInButNotInvited ? (
          <>
            <div className="ma-banner ma-banner--danger" role="alert">
              <span className="ma-banner__text">This account isn&apos;t set up for any university yet. Ask your admin to add your email, then sign in again.</span>
            </div>
            <form action={signOut}><button className="ma-btn ma-btn--secondary ma-btn--block">Sign out</button></form>
          </>
        ) : (
          <SignInForm />
        )}
      </div>
    </main>
  );
}
