import "./load-env";
import {readFile} from "node:fs/promises";
import {parseFrontMatter} from "../lib/fixtures/load-fixture";

// Terminal walkthrough of the UR-1042 demo against a running local server.
// Start the server first (see BACKEND.md, "Terminal walkthrough"). Replay mode must be on.
const BASE = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const CASE = "UR-1042";
const ACCOUNT = "clinician_a";
const credential: string = process.env.DEMO_CREDENTIAL_CLINICIAN_A ?? "";
if (!credential) throw new Error("Set DEMO_CREDENTIAL_CLINICIAN_A in .env.local first.");

const jar = new Map<string, string>();
function remember(response: Response) {
  for (const cookie of response.headers.getSetCookie()) {
    const pair = cookie.split(";")[0];
    const at = pair.indexOf("=");
    jar.set(pair.slice(0, at), pair.slice(at + 1));
  }
}
const cookies = () => [...jar].map(([name, value]) => `${name}=${value}`).join("; ");

async function signIn() {
  const csrf = await fetch(`${BASE}/api/auth/csrf`);
  remember(csrf);
  const {csrfToken} = (await csrf.json()) as {csrfToken: string};
  const form = new URLSearchParams({csrfToken, account: ACCOUNT, credential});
  const response = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST", redirect: "manual", body: form,
    headers: {Origin: BASE, Cookie: cookies(), "Content-Type": "application/x-www-form-urlencoded"},
  });
  remember(response);
  if (!jar.has("authjs.session-token")) throw new Error("Sign-in failed. Check DEMO_CREDENTIAL_CLINICIAN_A matches the server.");
}

async function api(method: string, path: string, body?: unknown) {
  const response = await fetch(`${BASE}/api/${path}`, {
    method, redirect: "manual",
    headers: {Origin: BASE, Cookie: cookies(), ...(body === undefined ? {} : {"Content-Type": "application/json"})},
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  remember(response);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${method} ${path} -> ${response.status} ${JSON.stringify(data)}`);
  return data;
}

async function waitForRun(runId: string) {
  for (;;) {
    const run = await api("GET", `runs/${runId}`);
    if (run.status !== "running") return run;
    await new Promise((done) => setTimeout(done, 2000));
  }
}

const say = (text: string) => console.log(`\n== ${text}`);

// Verifying a document already starts a rerun, so join that run instead of failing with active_run.
async function startOrJoinRun(): Promise<string> {
  try {
    return (await api("POST", `cases/${CASE}/runs`, {})).runGroupId;
  } catch (error) {
    const active = /"activeRunGroupId":"([0-9a-f-]{36})"/.exec(String(error));
    if (active) return active[1];
    throw error;
  }
}

async function reviewRun() {
  const run = await waitForRun(await startOrJoinRun());
  for (const agent of run.agents) console.log(`  ${agent.agent}: ${agent.status}`);
}

async function blockers(label: string) {
  const validation = await api("GET", `cases/${CASE}/validation`);
  console.log(`  ${label}: ${validation.blockers.length === 0 ? "no blockers" : validation.blockers.map((b: {code: string}) => b.code).join(", ")}`);
  return validation;
}

async function main() {
  say("Signing in as the demo clinician");
  await signIn();
  console.log("  signed in");

  say("Running the three-agent review on UR-1042");
  await reviewRun();
  let validation = await blockers("blockers after the first review");

  say("Late progress note arrives: uploading and verifying it");
  const note = parseFrontMatter(await readFile("fixtures/ur-1042/late-arrival/note-2026-11-02.md", "utf8"));
  const uploaded = await api("POST", `cases/${CASE}/documents`, {type: "progress_note", title: "Late note", author: "Caller ignored", serviceDate: "2026-11-01", content: note.body});
  await api("POST", `documents/${uploaded.id}/verify`, {decision: "verified"});
  await reviewRun();

  say("Clearing the code-raised issues");
  const issues = await api("GET", `cases/${CASE}/issues`);
  const missing = issues.find((i: {type: string; status: string; source: string}) => i.type === "missing_document" && i.status === "open" && i.source === "code");
  const dates = issues.find((i: {type: string; status: string; source: string}) => i.type === "date_conflict" && i.status === "open" && i.source === "code");
  if (missing) await api("POST", `issues/${missing.id}/resolve`, {resolution: "attach_document", reason: "Verified late note covers missing day", evidenceDocumentId: uploaded.id});
  if (dates) {
    const caseView = await api("GET", `cases/${CASE}`);
    await api("POST", `issues/${dates.id}/resolve`, {resolution: "verify_period", reason: "Request is for Nov 4–6; current authorization remains Nov 1–3", evidenceDocumentId: caseView.reviewPeriod.sourceDocumentId, verifiedPeriod: {start: "2026-11-04", end: "2026-11-06"}});
  }
  validation = await blockers("blockers after clearing issues");

  say("Clinician approval");
  if (validation.blockers.length > 0) {
    console.log("  Approval is blocked. The clinician must reject or edit the flagged claims first.");
    return;
  }
  const approval = await api("POST", `cases/${CASE}/approve`, {packetVersionId: validation.packetVersionId, contentHash: validation.contentHash, acknowledgement: "Reviewed all sources in synthetic demo"});
  console.log(`  approved (${approval.status ?? "ok"})`);
}

main().catch((error) => {
  console.error(`\nWalkthrough stopped: ${error instanceof Error ? error.message : "unknown error"}`);
  process.exitCode = 1;
});
