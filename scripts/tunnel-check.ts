/**
 * Proves the login action works when VS Code port forwarding sets a mismatched
 * x-forwarded-host, which is what tripped Next's CSRF check on the phone.
 * Run with: npx tsx --env-file=.env.local scripts/tunnel-check.ts
 */
export {};

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:3000";

async function actionId(): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const manifest = JSON.parse(
    await readFile(".next/dev/server/server-reference-manifest.json", "utf8"),
  );
  for (const [id, entry] of Object.entries<{ exportedName: string }>(
    manifest.node ?? {},
  )) {
    if (entry.exportedName === "login") return id;
  }
  throw new Error("login action not found in manifest");
}

async function encodeReply(value: unknown): Promise<FormData> {
  const mod = await import(
    "next/dist/compiled/react-server-dom-turbopack-experimental/cjs/react-server-dom-turbopack-client.node.development.js"
  );
  const reply = await mod.encodeReply(value);
  if (reply instanceof FormData) return reply;
  const form = new FormData();
  form.append("0", reply);
  return form;
}

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

async function post(
  id: string,
  body: FormData,
  headers: Record<string, string>,
): Promise<{ status: number; text: string; headers: Headers }> {
  const res = await fetch(`${BASE}/login`, {
    method: "POST",
    headers: { "Next-Action": id, ...headers },
    body,
    redirect: "manual",
  });
  return { status: res.status, text: await res.text(), headers: res.headers };
}

const TUNNEL_HEADERS = {
  // This is the mismatch Next rejected before the config change.
  "X-Forwarded-Host": "g0t9bspj-3000.asse.devtunnels.ms",
  Origin: "http://localhost:3000",
};

async function main() {
  const id = await actionId();
  const results: { name: string; pass: boolean; detail: string }[] = [];
  const record = (name: string, pass: boolean, detail: string) => {
    results.push({ name, pass, detail });
    console.log(`${pass ? "PASS" : "FAIL"}  ${name} — ${detail}`);
  };

  const password = process.env.ADMIN_PASSWORD!;

  // 1. Wrong password through the tunnel: must reach the action and be rejected
  //    by our own validation, not by the framework's CSRF check.
  const bad = await post(
    id,
    await encodeReply([undefined, form({ username: "admin", password: "nope" })]),
    TUNNEL_HEADERS,
  );
  record(
    "tunnel: wrong password reaches the action",
    bad.text.includes("credentials do not match"),
    `status ${bad.status}, own validation surfaced: ${bad.text.includes("credentials do not match")}`,
  );
  record(
    "tunnel: CSRF no longer aborts",
    !bad.text.includes("Invalid Server Actions request"),
    `csrf abort present: ${bad.text.includes("Invalid Server Actions request")}`,
  );

  // 2. Correct password through the tunnel: must set the session cookie.
  const good = await post(
    id,
    await encodeReply([
      undefined,
      form({ username: "admin", password }),
    ]),
    TUNNEL_HEADERS,
  );
  const cookie = good.headers.get("set-cookie") ?? "";
  record(
    "tunnel: correct password sets session cookie",
    cookie.includes("admin_session="),
    `status ${good.status}, cookie: ${cookie.slice(0, 34)}…`,
  );

  // 3. Regression: the plain localhost path still works.
  const plain = await post(
    id,
    await encodeReply([
      undefined,
      form({ username: "admin", password: "nope" }),
    ]),
    { Origin: "http://localhost:3000" },
  );
  record(
    "localhost: correct origin still works",
    plain.text.includes("credentials do not match"),
    `status ${plain.status}`,
  );

  // 4. A genuinely foreign origin must still be refused (CSRF stays armed).
  const foreign = await post(
    id,
    await encodeReply([
      undefined,
      form({ username: "admin", password }),
    ]),
    {
      Origin: "https://evil.example.com",
      "X-Forwarded-Host": "g0t9bspj-3000.asse.devtunnels.ms",
    },
  );
  record(
    "foreign origin is still rejected",
    foreign.text.includes("Invalid Server Actions request"),
    `status ${foreign.status}, rejected: ${foreign.text.includes("Invalid Server Actions request")}`,
  );

  const failed = results.filter((r) => !r.pass);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
