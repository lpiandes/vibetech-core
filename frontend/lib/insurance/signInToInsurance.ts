"use client";

import { signIn } from "next-auth/react";

export async function authenticateInsuranceCredentials({
  email,
  password,
  nextPath,
}: {
  email: string;
  password: string;
  nextPath: string;
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const signed = await signIn("credentials", {
    email: String(email ?? "").trim(),
    password,
    redirect: false,
    callbackUrl: nextPath,
  });
  if (signed?.error) {
    return { ok: false, error: "Could not sign in with that email and password." };
  }
  return { ok: true, url: String(signed?.url || nextPath) };
}

/** Shared credentials sign-in used by VibeKeep login. */
export async function signInToInsurance(input: {
  email: string;
  password: string;
  nextPath: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const signed = await authenticateInsuranceCredentials(input);
  if (!signed.ok) return signed;
  window.location.assign(signed.url);
  return { ok: true };
}
