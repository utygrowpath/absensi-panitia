/**
 * Seed the `panitia` table from `data_panitia.csv`.
 * Idempotent: skips when the table already holds rows.
 * Run with: npm run seed
 *
 * Uses the PostgREST endpoint directly rather than supabase-js, which wants a
 * WebSocket global that only Next.js's server runtime polyfills.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parsePanitiaCsv } from "../lib/types";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY");
  process.exit(1);
}

const headers = {
  apikey: key,
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
};

async function rest(
  path: string,
  init?: RequestInit & { extraHeaders?: Record<string, string> },
): Promise<Response> {
  const { extraHeaders, ...restInit } = init ?? {};
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...restInit,
    headers: { ...headers, ...extraHeaders },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`${init?.method ?? "GET"} ${path} -> ${response.status}: ${body}`);
  }
  return response;
}

async function main() {
  const existing = await rest("panitia?select=id&limit=1");
  if ((await existing.json()).length > 0) {
    const counted = await rest("panitia?select=id&limit=1", {
      extraHeaders: { Prefer: "count=exact" },
    });
    const range = counted.headers.get("content-range") ?? "";
    const total = range.split("/").pop();
    console.log(`panitia already holds ${total} rows — skipping seed.`);
    return;
  }

  const csv = readFileSync(resolve(process.cwd(), "data_panitia.csv"), "utf8");
  const rows = parsePanitiaCsv(csv).map((row) => ({ ...row, qr_token: crypto.randomUUID() }));

  await rest("panitia", { method: "POST", body: JSON.stringify(rows) });
  console.log(`Seeded ${rows.length} committee members.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
