import { connection } from "next/server";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";
import { AdminNav, SignOut } from "./nav";

// Admin routes always need the session cookie and live attendance rows, so they
// block on purpose instead of shipping a static shell.
export const instant = false;

export const metadata: Metadata = {
  title: "Admin · Presensi Panitia",
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Session checks read the clock; keep them out of the prerender pass.
  await connection();
  await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Sticky so long pages (the QR sheet) scroll the content, not the nav. */}
      <aside className="flex flex-col border-b border-line bg-chrome lg:sticky lg:top-0 lg:h-screen lg:w-60 lg:flex-none lg:self-start lg:overflow-y-auto lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between px-5 py-4 lg:block">
          <div>
            <p className="text-[0.9375rem] font-semibold tracking-tight text-ink">
              Presensi Panitia
            </p>
            <p className="mt-0.5 hidden text-[0.75rem] text-ink-faint lg:block">
              Event day control panel
            </p>
          </div>
          <div className="lg:hidden">
            <SignOut />
          </div>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible lg:px-3 lg:pb-5">
          <AdminNav />
        </nav>

        <div className="mt-auto hidden px-3 pb-4 lg:block">
          <SignOut />
        </div>
      </aside>

      <main className="flex-1 px-5 py-6 sm:px-8 sm:py-8 lg:px-10">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
