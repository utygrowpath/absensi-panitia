import { supabaseAdmin } from "@/lib/supabase";
import type { Panitia } from "@/lib/types";
import { PanitiaTable } from "../panitia-table";

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

export default async function PanitiaPage() {
  const members = await loadPanitia();
  const divisions = [...new Set(members.map((m) => m.divisi))].sort();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-[1.75rem] font-semibold tracking-tight text-ink">
          Committee
        </h1>
        <p className="mt-1 text-[0.875rem] text-ink-muted">
          {members.length} members across {divisions.length} divisions.
        </p>
      </header>

      <PanitiaTable members={members} divisions={divisions} />
    </div>
  );
}
