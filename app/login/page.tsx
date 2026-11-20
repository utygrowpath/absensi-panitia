import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in · Presensi Panitia",
};

export default function LoginPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="w-full max-w-[22rem]">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-ink">
            Presensi Panitia
          </h1>
          <p className="mt-1.5 text-[0.875rem] leading-relaxed text-ink-muted">
            Sign in to record and review committee attendance.
          </p>
        </div>

        <div className="panel p-6">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
