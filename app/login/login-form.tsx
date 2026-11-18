"use client";

import { useActionState } from "react";
import { login } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, undefined);

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <div>
        <label className="label" htmlFor="username">
          Username
        </label>
        <input
          className="field"
          id="username"
          name="username"
          type="text"
          autoComplete="username"
          placeholder="admin"
          required
          aria-invalid={state?.error ? true : undefined}
        />
      </div>

      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input
          className="field"
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          required
          aria-invalid={state?.error ? true : undefined}
        />
      </div>

      {state?.error ? (
        <p
          role="alert"
          className="rounded-md bg-alfa-soft px-3 py-2 text-[0.8125rem] font-medium text-alfa"
        >
          {state.error}
        </p>
      ) : null}

      <button className="btn btn-primary btn-lg mt-1" type="submit" disabled={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
