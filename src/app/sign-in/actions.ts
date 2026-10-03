"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

export type SignInState = {
  step: "email" | "code";
  email: string;
  error?: string;
  notice?: string;
};

const Email = z.string().trim().toLowerCase().pipe(z.email());
const Code = z.string().trim().regex(/^\d{6}$/);

/** Step 1: send a 6-digit code, but only to invited admin and gate-device emails. */
export async function sendCode(_prev: SignInState, form: FormData): Promise<SignInState> {
  const parsed = Email.safeParse(form.get("email"));
  if (!parsed.success) return { step: "email", email: String(form.get("email") ?? ""), error: "Enter an email address, like name@university.edu." };
  const email = parsed.data;
  const supabase = await createClient();

  const { data: allowed, error: checkError } = await supabase.rpc("can_sign_in", { p_email: email });
  if (checkError) return { step: "email", email, error: "Couldn't reach the server. Check the connection and try again." };
  // Same message whether or not the email is invited, so the page doesn't reveal who has access.
  const notice = `If ${email} is set up for My Alumnus, a 6-digit code is on its way. It expires in 1 hour.`;
  if (!allowed) return { step: "code", email, notice };

  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) {
    const wait = /rate|seconds|security purposes/i.test(error.message);
    return { step: "email", email, error: wait ? "A code was sent very recently. Wait a minute, then try again." : "Couldn't send the code. Try again in a minute." };
  }
  return { step: "code", email, notice };
}

/** Step 2: check the code and start the session. */
export async function verifyCode(_prev: SignInState, form: FormData): Promise<SignInState> {
  const email = String(form.get("email") ?? "");
  const code = Code.safeParse(form.get("code"));
  if (!code.success) return { step: "code", email, error: "Enter the 6 digits from the email." };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token: code.data, type: "email" });
  if (error) return { step: "code", email, error: "That code didn't work. It may have expired: check the latest email, or send a new code." };
  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/sign-in");
}
