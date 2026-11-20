import { NextResponse, type NextRequest } from "next/server";
import { buildQrWorkbook } from "@/lib/qr-export";
import { SESSION_COOKIE, verifySession } from "@/lib/session";
import { supabaseAdmin } from "@/lib/supabase";
import type { Panitia } from "@/lib/types";

// Same ordering as the QR page so both views list members identically.
async function loadPanitia(): Promise<Panitia[]> {
  const { data, error } = await supabaseAdmin()
    .from("panitia")
    .select("*")
    .order("divisi")
    .order("nama");
  if (error) throw new Error(`Could not load committee: ${error.message}`);
  return data ?? [];
}

/**
 * The roster as a spreadsheet with each member's code embedded, for reading
 * the list as a table and reprinting cards from one file.
 *
 * The proxy already redirects signed-out visitors; the session is verified
 * again here because that redirect is only an optimisation.
 */
export async function GET(request: NextRequest) {
  const signedIn = await verifySession(request.cookies.get(SESSION_COOKIE)?.value);
  if (!signedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const workbook = await buildQrWorkbook(await loadPanitia());
  // en-CA renders YYYY-MM-DD, and the day starts in Jakarta, not UTC.
  const stamp = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());

  return new NextResponse(workbook, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="qr-codes-${stamp}.xlsx"`,
      "Content-Length": String(workbook.byteLength),
    },
  });
}
