import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { equalStrings, signSession, verifySession } from "../lib/session";

const SECRET = "test-secret";
const TTL = 60;

beforeEach(() => {
  vi.stubEnv("SESSION_SECRET", SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("session tokens", () => {
  it("round-trips a freshly signed token", async () => {
    const token = await signSession(Math.floor(Date.now() / 1000) + TTL);
    expect(await verifySession(token)).toBe(true);
  });

  it("rejects a tampered payload", async () => {
    const token = await signSession(Math.floor(Date.now() / 1000) + TTL);
    const [payload, signature] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ exp: 4102444800 })).toString(
      "base64url",
    );
    expect(await verifySession(`${forged}.${signature}`)).toBe(false);
    expect(payload).not.toBe(forged);
  });

  it("rejects a tampered signature", async () => {
    const token = await signSession(Math.floor(Date.now() / 1000) + TTL);
    const [payload] = token.split(".");
    expect(await verifySession(`${payload}.AAAA`)).toBe(false);
  });

  it("rejects an expired token", async () => {
    const token = await signSession(Math.floor(Date.now() / 1000) - 1);
    expect(await verifySession(token)).toBe(false);
  });

  it("rejects garbage", async () => {
    expect(await verifySession(undefined)).toBe(false);
    expect(await verifySession("")).toBe(false);
    expect(await verifySession("not-a-token")).toBe(false);
    expect(await verifySession("a.b.c")).toBe(false);
  });

  it("does not accept a token signed under another secret", async () => {
    const token = await signSession(Math.floor(Date.now() / 1000) + TTL);
    vi.stubEnv("SESSION_SECRET", "a-different-secret");
    expect(await verifySession(token)).toBe(false);
  });
});

describe("equalStrings", () => {
  it("matches identical strings", () => {
    expect(equalStrings("admin", "admin")).toBe(true);
  });

  it("rejects different strings", () => {
    expect(equalStrings("admin", "adm1n")).toBe(false);
    expect(equalStrings("admin", "administrator")).toBe(false);
    expect(equalStrings("", "admin")).toBe(false);
  });
});
