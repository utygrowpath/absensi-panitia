import { supabaseAdmin } from "@/lib/supabase";
import type { Panitia } from "@/lib/types";
import { QrSheet } from "./qr-sheet";

// These routes read live attendance rows, so they block instead of prerendering.
export const instant = false;

async function loadPanitia(): Promise<Panitia[]> {
  const { data, error } = await supabaseAdmin()
    .from("panitia")
    .select("*")
    .order("divisi")
    .order("nama");
  if (error) throw new Error(`Could not load committee: ${error.message}`);
  return data ?? [];
}

export default async function QrPage() {
  const members = await loadPanitia();

  return (
    <div className="flex flex-col gap-6">
      <header className="no-print flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
            QR codes
          </h1>
          <p className="mt-1 text-[0.875rem] text-ink-muted">
            One static code per member. Export the sheet and mount it on the
            ID card.
          </p>
        </div>
        <a className="btn btn-primary" href="/admin/qr/export">
          Export Excel
        </a>
      </header>

      {members.length === 0 ? (
        <p className="panel px-5 py-8 text-center text-[0.875rem] text-ink-muted">
          No members yet. Add committee members first.
        </p>
      ) : (
        <QrSheet members={members} />
      )}
    </div>
  );
}
