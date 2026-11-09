/**
 * Records demo mode: a fresh local database and a replay-only production build, then each segment's script drives the
 * real screens in a browser signed in as that segment's account, saving every response to fixtures/demo/<segment>.json.
 * No API key and no spend ledger reach the server, so a prompt change that misses the committed replays fails loudly.
 * Usage: npm run demo:record   (local PostgreSQL; drops its own temporary database at the end)
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { userInfo } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "@playwright/test";
import { SEGMENT_IDS, SEGMENTS } from "../lib/client/demo-scripts";

const PORT = 3010, ORIGIN = `http://127.0.0.1:${PORT}`;
const DB = `ur_demo_record_${Date.now()}_test`;
const ACCOUNTS = ["clinician_a", "clinician_b", "coordinator_a", "manager_a", "packet_a"];
const credentials = Object.fromEntries(ACCOUNTS.map(account => [account, randomBytes(16).toString("hex")]));
// Empty means unset (lib/env.ts), so a key or ledger in the developer's shell can't reach the server.
const env: NodeJS.ProcessEnv = {
  ...process.env, NODE_NO_WARNINGS: "1", ANTHROPIC_API_KEY: "", SPEND_LEDGER_URL: "", VERCEL: "", VERCEL_ENV: "", VERCEL_URL: "",
  DATABASE_URL: `postgresql://${userInfo().username}@localhost/${DB}`, APP_DEPLOYMENT: "local", APP_ORIGIN: ORIGIN,
  AUTH_SECRET: randomBytes(32).toString("hex"), AGENT_REPLAY: "1", AGENT_RECORD: "0", AGENT_REPLAY_DIR: "fixtures/replay",
  DEMO_NOW: "2026-11-03T09:00:00-05:00",
  ...Object.fromEntries(ACCOUNTS.map(account => [`DEMO_CREDENTIAL_${account.toUpperCase()}`, credentials[account]])),
};

function run(command: string, args: string[]) {
  const result = spawnSync(command, args, { env, stdio: ["ignore", "ignore", "inherit"] });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed`);
}

async function main() {
  let server: ChildProcess | null = null;
  run("createdb", [DB]);
  try {
    run("npx", ["tsx", "--conditions=react-server", "scripts/db-migrate.ts"]);
    run("npx", ["tsx", "--conditions=react-server", "scripts/db-seed.ts"]);
    console.log("Building (replay only, no API key)...");
    run("npx", ["next", "build", "--turbopack"]);
    server = spawn("npx", ["next", "start", "-p", String(PORT), "-H", "127.0.0.1"], { env, stdio: "ignore", detached: true });
    for (let tries = 0; tries < 60; tries++) { if (await fetch(`${ORIGIN}/api/auth/csrf`).then(r => r.ok, () => false)) break; await delay(1000); }

    // The file exactly as the coordinator would pick it; the screen strips the front matter itself.
    const files = { "late-note": await readFile("fixtures/ur-1042/late-arrival/note-2026-11-02.md", "utf8") };
    const browser = await chromium.launch();
    try {
      // One shared database, segments in story order: each starts where the last one left the case.
      for (const id of SEGMENT_IDS) {
        const segment = SEGMENTS[id];
        const context = await browser.newContext({ baseURL: ORIGIN, viewport: { width: 1440, height: 900 } });
        const page = await context.newPage();
        await page.goto("/login");
        await page.getByLabel("Account").selectOption(segment.account);
        await page.getByLabel("Demo credential").fill(credentials[segment.account]!);
        await page.getByRole("button", { name: "Sign in" }).click();
        await page.waitForURL(url => !url.pathname.startsWith("/login"));
        await page.addInitScript(value => { window.__demoFiles = value; }, files);
        await page.goto(`/demo?record=${id}`);
        await page.waitForFunction(() => window.__demoStatus === "done" || window.__demoStatus?.startsWith("failed"), null, { timeout: 240000 }).catch(() => {});
        const status = await page.evaluate(() => `${window.__demoStatus} · last caption: ${document.querySelector("[data-demo-caption]")?.textContent}`).then(text => text.startsWith("done") ? "done" : text);
        if (status !== "done") {
          await page.screenshot({ path: `.e2e-results/demo-record-${id}.png`, fullPage: true });
          throw new Error(`${id}: ${status} (screenshot in .e2e-results/)`);
        }
        const recording = await page.evaluate(() => window.__demoRecording);
        await writeFile(`fixtures/demo/${id}.json`, `${JSON.stringify(recording)}\n`);
        console.log(`Recorded ${id}: ${recording!.frames.length} frames, ${recording!.transitions.length} transitions`);
        await context.close();
      }
    } finally { await browser.close(); }
  } finally {
    if (server?.pid) process.kill(-server.pid); // the whole group: npx and the Next server it started
    await delay(500);
    spawnSync("dropdb", ["--if-exists", "--force", DB], { env, stdio: "ignore" });
  }
}

main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
