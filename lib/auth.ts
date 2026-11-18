import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_TTL_SECONDS,
  equalStrings,
  signSession,
  verifySession,
} from "./session";

export { SESSION_COOKIE };

/** True when the current request carries a valid admin session. */
export async function isSignedIn(): Promise<boolean> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

/** Guard for Server Functions: every action must call this before mutating. */
export async function requireAdmin(): Promise<void> {
  if (!(await isSignedIn())) throw new Error("Unauthorized");
}

export async function checkCredentials(
  username: string,
  password: string,
): Promise<boolean> {
  const expectedUser = process.env.ADMIN_USERNAME;
  const expectedPass = process.env.ADMIN_PASSWORD;
  if (!expectedUser || !expectedPass) return false;
  return equalStrings(username, expectedUser) && equalStrings(password, expectedPass);
}

export async function startSession(): Promise<void> {
  const store = await cookies();
  store.set(
    SESSION_COOKIE,
    await signSession(Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    },
  );
}

export async function endSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
