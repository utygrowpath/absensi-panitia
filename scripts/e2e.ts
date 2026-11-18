/**
 * End-to-end check of the real server actions over HTTP, using React's own
 * encodeReply so the request body matches what a browser sends.
 * Run with: npx tsx --env-file=.env.local scripts/e2e.ts
 */
export {};

import { todayInJakarta } from "../lib/time";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const SECRET = process.env.SUPABASE_SECRET_KEY!;
const SUPABASE = process.env.NEXT_PUBLIC_SUPABASE_URL!;

type Step = { name: string; pass: boolean; detail: string };
const steps: Step[] = [];

function record(name: string, pass: boolean, detail: string) {
  steps.push({ name, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${name} — ${detail}`);
}

async function encodeReply(value: unknown): Promise<FormData> {
  const mod = await import(
    "next/dist/compiled/react-server-dom-turbopack-experimental/cjs/react-server-dom-turbopack-client.node.development.js"
  );
  const reply = await mod.encodeReply(value);
  if (reply instanceof FormData) return reply;
  // encodeReply may fall back to a string; wrap it the way Next expects.
  const form = new FormData();
  form.append("0", reply);
  return form;
}

async function callAction<T>(
  actionId: string,
  args: unknown[],
  cookie?: string,
  path = "/",
): Promise<{ status: number; body: string; data?: T }> {
  const body = await encodeReply(args);
  const headers: Record<string, string> = { "Next-Action": actionId };
  if (cookie) headers.Cookie = cookie;

  // Server Actions are POSTed to the page path that registered them.
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers,
    body,
    redirect: "manual",
  });
  const text = await res.text();
  return { status: res.status, body: text };
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

/** Pull the action id for a given exported name out of the dev manifest. */
async function actionId(name: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const raw = await readFile(".next/dev/server/server-reference-manifest.json", "utf8");
  const manifest = JSON.parse(raw);
  for (const [id, entry] of Object.entries<{ exportedName: string }>(manifest.node ?? {})) {
    if (entry.exportedName === name) return id;
  }
  throw new Error(`No server action named ${name} in manifest`);
}

async function mintSession(): Promise<string> {
  const { signSession } = await import("../lib/session");
  return signSession(Math.floor(Date.now() / 1000) + 3600);
}

async function rest(path: string, init?: RequestInit) {
  return fetch(`${SUPABASE}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SECRET,
      Authorization: `Bearer ${SECRET}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

async function main() {
  // --- 1. login -----------------------------------------------------------
  const loginId = await actionId("login");

  const bad = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Next-Action": loginId },
    body: await encodeReply([
      undefined,
      form({ username: "admin", password: "nope" }),
    ]),
    redirect: "manual",
  });
  const badText = await bad.text();
  record(
    "login rejects wrong password",
    badText.includes("credentials do not match"),
    `status ${bad.status}, error surfaced: ${badText.includes("credentials do not match")}`,
  );

  const good = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Next-Action": loginId },
    body: await encodeReply([
      undefined,
      form({ username: "admin", password: process.env.ADMIN_PASSWORD! }),
    ]),
    redirect: "manual",
  });
  const setCookie = good.headers.get("set-cookie") ?? "";
  record(
    "login accepts correct password and sets cookie",
    setCookie.includes("admin_session="),
    `status ${good.status}, cookie: ${setCookie.slice(0, 40)}…`,
  );

  // --- 2. unauthenticated actions are refused ----------------------------
  const token = (await (await rest("panitia?select=qr_token&limit=1")).json())[0]
    .qr_token as string;
  const scanId = await actionId("scanAttendance");

  const anon = await callAction(scanId, [token]);
  record(
    "scan refused without a session",
    anon.status === 307 || anon.body.includes("Unauthorized"),
    `status ${anon.status}`,
  );

  // --- 3. scan round trip -------------------------------------------------
  const cookie = `admin_session=${await mintSession()}`;

  // Reset any previous attendance for this member so the run is repeatable.
  const person = (
    await (await rest(`panitia?select=id&qr_token=eq.${token}`)).json()
  )[0];
  await rest(`attendance?panitia_id=eq.${person.id}`, { method: "DELETE" });

  const first = await callAction(scanId, [token], cookie, "/admin/scan");
  record(
    "first scan marks present",
    first.body.includes("marked"),
    first.body.slice(0, 200),
  );

  const second = await callAction(scanId, [token], cookie, "/admin/scan");
  record(
    "second scan reports already present",
    second.body.includes("already"),
    second.body.slice(0, 200),
  );

  const rows = await (
    await rest(`attendance?panitia_id=eq.${person.id}&select=status`)
  ).json();
  record(
    "database holds exactly one hadir row",
    rows.length === 1 && rows[0].status === "hadir",
    JSON.stringify(rows),
  );

  // --- 4. manual status change -------------------------------------------
  const setStatusId = await actionId("setAttendanceStatus");
  // The app works in Asia/Jakarta, so a UTC date string here would target a
  // different day and write a second record instead of updating the first.
  const today = todayInJakarta();
  const manual = await callAction(
    setStatusId,
    [
      form({
        panitiaId: person.id,
        status: "izin",
        date: today,
      }),
    ],
    cookie,
    "/admin/manual",
  );
  const after = (
    await (
      await rest(`attendance?panitia_id=eq.${person.id}&attendance_date=eq.${today}&select=status`)
    ).json()
  )[0];
  record(
    "manual check-in flips status to izin",
    manual.status === 200 && after?.status === "izin",
    `action ${manual.status}, db ${JSON.stringify(after)}`,
  );

  // --- 5. cleanup ---------------------------------------------------------
  await rest(`attendance?panitia_id=eq.${person.id}`, { method: "DELETE" });
  const left = await (
    await rest(`attendance?panitia_id=eq.${person.id}&select=id`)
  ).json();
  record("test attendance rows cleaned up", left.length === 0, `${left.length} left`);

  const failed = steps.filter((s) => !s.pass);
  console.log(`\n${steps.length - failed.length}/${steps.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
