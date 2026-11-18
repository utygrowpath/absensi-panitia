"use server";

import { redirect } from "next/navigation";
import { checkCredentials, endSession, isSignedIn, startSession } from "@/lib/auth";

export type LoginState = { error?: string } | undefined;

/** Verify credentials and open an admin session. */
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!username || !password) {
    return { error: "Username and password are required." };
  }
  if (!(await checkCredentials(username, password))) {
    return { error: "Those credentials do not match our records." };
  }

  await startSession();
  redirect("/admin");
}

export async function logout(): Promise<void> {
  await requireSession();
  await endSession();
  redirect("/login");
}

async function requireSession(): Promise<void> {
  if (!(await isSignedIn())) redirect("/login");
}
