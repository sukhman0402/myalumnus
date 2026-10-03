import type { Metadata } from "next";
import { SignInForm } from "./SignInForm";
import { signOut } from "./actions";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ reason?: string }> }) {
  const { reason } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedInButNotInvited = reason === "not-invited" && Boolean(data?.claims?.sub);

  return (
    <main className="ma-signin" id="main">
      <div className="ma-signin__card">
        <div className="ma-rail__logo" aria-hidden="true">MA</div>
        <h1>Sign in to My Alumnus</h1>
        {signedInButNotInvited ? (
          <>
            <div className="ma-banner ma-banner--danger" role="alert">
              <span className="ma-banner__text">This account isn&apos;t set up for any university yet. Ask your admin to add your email, then sign in again.</span>
            </div>
            <form action={signOut}><button className="ma-btn ma-btn--secondary ma-btn--block">Sign out</button></form>
          </>
        ) : (
          <SignInForm />
        )}
        <p className="ma-note">Guards don&apos;t sign in here: the gate iPad is signed in by an admin, and each guard taps their name at the start of a shift.</p>
      </div>
    </main>
  );
}
