/** HTTP acceptance checks against a Next production server on the isolated test origin. */
import "../scripts/load-env";
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getEnv } from "../lib/env";
import { connectDatabase } from "../lib/db";
import { users, caseMembers } from "../lib/db/schema";
import { DEMO_ACCOUNTS, seed } from "../lib/db/seed";
import { roleHome } from "../lib/auth/roles";
const env = getEnv(), origin = env.APP_ORIGIN;
assert.equal(origin, "http://127.0.0.1:3006");
assert.equal(env.APP_DEPLOYMENT, "local");
assert(env.DATABASE_URL && new URL(env.DATABASE_URL).pathname.endsWith("_test") && ["localhost", "127.0.0.1"].includes(new URL(env.DATABASE_URL).hostname));
const { db, pool } = connectDatabase(env.DATABASE_URL);
class Session {
 private cookies = new Map<string, string>();
 async request(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers); headers.set("cookie", [...this.cookies.entries()].map(([key, value]) => `${key}=${value}`).join("; "));
  const response = await fetch(`${origin}${path}`, { ...init, headers, redirect: "manual" });
  for (const entry of response.headers.getSetCookie()) { const pair = entry.split(";")[0], at = pair.indexOf("="); this.cookies.set(pair.slice(0, at), pair.slice(at + 1)); }
  return response;
 }
 async login(account: string) {
  const credential = env.demoCredentials[account]; assert(credential, `Configure ${account} for the local test process`);
  const csrf = z.object({ csrfToken: z.string() }).parse(await (await this.request("/api/auth/csrf")).json());
  const result = await this.request("/api/auth/callback/credentials", { method: "POST", headers: { Origin: origin!, "Content-Type": "application/x-www-form-urlencoded", "X-Auth-Return-Redirect": "1" }, body: new URLSearchParams({ csrfToken: csrf.csrfToken, account, credential, callbackUrl: origin! }).toString() });
  assert(result.ok, `${account}: login request failed`);
 }
}
const identity = z.object({ user: z.object({ id: z.string(), role: z.string() }) });
async function main() {
 assert.equal((await db.select().from(users).limit(1)).length, 0, "Fresh session-test DB required");
 await seed(db);
 const anonymous = new Session(); assert.equal((await anonymous.request("/api/cases")).status, 401);
 assert.equal((await anonymous.request("/")).headers.get("location"), "/login");
 const sessions = new Map<string, Session>(), identities = new Set<string>();
 for (const account of DEMO_ACCOUNTS) {
  const session = new Session(); await session.login(account.accountKey); sessions.set(account.accountKey, session);
  const current = identity.parse(await (await session.request("/api/auth/session")).json());
  assert.equal(current.user.role, account.role); identities.add(current.user.id);
  const home = roleHome(account.role), own = await session.request(home);
  assert.equal(own.status, 200, `${account.accountKey}: own workspace`);
  const other = await session.request(account.role === "clinician" ? "/roles/manager" : "/cases/UR-1042/summary");
  assert.equal(other.status, 307, `${account.accountKey}: foreign page must redirect`); assert.equal(other.headers.get("location"), home);
  if (account.role !== "clinician") assert.equal((await session.request("/api/cases/UR-1042/approve", { method: "POST", headers: { Origin: origin!, "Content-Type": "application/json" }, body: "{}" })).status, 403);
 }
 assert.equal(identities.size, 5);
 // An existing encrypted JWT must not retain its previous privileges.
 const coordinator = sessions.get("coordinator_a")!;
 await db.update(users).set({ role: "packet_staff" }).where(eq(users.accountKey, "coordinator_a"));
 assert.equal(identity.parse(await (await coordinator.request("/api/auth/session")).json()).user.role, "packet_staff");
 assert.equal((await coordinator.request("/api/cases/UR-1042")).status, 403);
 assert.equal((await coordinator.request("/roles/coordinator")).headers.get("location"), "/roles/submission");
 const [row] = await db.select().from(users).where(eq(users.accountKey, "coordinator_a"));
 await db.delete(caseMembers).where(eq(caseMembers.userId, row.id)); await db.delete(users).where(eq(users.id, row.id));
 assert.equal((await coordinator.request("/api/cases")).status, 401, "Deleted identity cannot use its old JWT");
 assert.equal((await coordinator.request("/roles/submission")).headers.get("location"), "/login");
 console.log(JSON.stringify({ passed: true, auth: "real Auth.js cookies over HTTP", distinctAccounts: identities.size, checks: ["anonymous rejection", "role landing pages", "cross-role page redirects", "API sign-off denial", "role change affects existing JWT", "deleted identity rejected"], liveModelCalls: 0 }, null, 2));
}
main().finally(() => pool.end());
