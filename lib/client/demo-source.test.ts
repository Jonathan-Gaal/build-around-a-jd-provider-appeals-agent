import { afterEach, describe, expect, it, vi } from "vitest";
import { DemoPlayback, DemoRecorder, type DemoResult } from "./demo-source";
import { ApiError, readApi, setDemoSource, writeApi } from "./api";

const ok = (payload: unknown) => async (): Promise<DemoResult> => ({ status: 200, payload });

async function recordRun() {
  const recorder = new DemoRecorder("clinician-1", { note: "Synthetic note" });
  await recorder.handle("GET", "/api/cases/UR-1042", ok({ status: "needs_review" }));
  await recorder.handle("GET", "/api/auth/session", ok({ user: { id: "u1" }, expires: "2026-11-03T10:00:00Z" }));
  await recorder.handle("POST", "/api/cases/UR-1042/runs", ok({ runGroupId: "g1" }));
  await recorder.handle("GET", "/api/runs/g1", ok({ status: "running" }));
  await recorder.handle("GET", "/api/auth/session", ok({ user: { id: "u1" }, expires: "2026-11-03T10:05:00Z" }));
  await recorder.handle("GET", "/api/runs/g1", ok({ status: "complete" }));
  return recorder.recording("2026-11-05T00:00:00Z");
}

describe("demo recorder", () => {
  it("makes one frame per write and one tick per changed read", async () => {
    const recording = await recordRun();
    expect(recording.transitions).toEqual([{ kind: "write", method: "POST", url: "/api/cases/UR-1042/runs", response: "r2" }, { kind: "tick" }]);
    expect(recording.frames).toHaveLength(3);
    expect(recording.files).toEqual({ note: "Synthetic note" });
  });
  it("ignores session expiry so a session read is not a tick", async () => {
    const recording = await recordRun();
    expect(recording.transitions.filter(step => step.kind === "tick")).toHaveLength(1);
    expect(recording.responses[recording.frames[0]!["/api/auth/session"]!]!.body).toBe('{"user":{"id":"u1"}}');
  });
  it("treats the first read after a write as that write's result, not a tick", async () => {
    const recorder = new DemoRecorder("x");
    await recorder.handle("GET", "/api/cases/UR-1042", ok({ latestRun: null }));
    await recorder.handle("POST", "/api/cases/UR-1042/runs", ok({ runGroupId: "g1" }));
    await recorder.handle("GET", "/api/cases/UR-1042", ok({ latestRun: "g1" }));
    const recording = recorder.recording("t");
    expect(recording.transitions.map(step => step.kind)).toEqual(["write"]);
    const playback = new DemoPlayback(recording);
    await playback.handle("POST", "/api/cases/UR-1042/runs");
    expect((await playback.handle("GET", "/api/cases/UR-1042")).payload).toEqual({ latestRun: "g1" });
  });
  it("stores identical responses once", async () => {
    const recorder = new DemoRecorder("x");
    await recorder.handle("GET", "/a", ok({ same: 1 }));
    await recorder.handle("GET", "/b", ok({ same: 1 }));
    expect(Object.keys(recorder.recording("t").responses)).toEqual(["r0"]);
  });
  it("records refused writes with their status", async () => {
    const recorder = new DemoRecorder("x");
    await recorder.handle("POST", "/api/issues/i1/resolve", async () => ({ status: 409, payload: { error: { code: "active_run" } } }));
    const { responses } = recorder.recording("t");
    expect(responses.r0).toEqual({ status: 409, body: '{"error":{"code":"active_run"}}' });
  });
});

describe("demo playback", () => {
  it("answers reads from the current frame and moves on with each write and tick", async () => {
    const playback = new DemoPlayback(await recordRun());
    expect((await playback.handle("GET", "/api/cases/UR-1042")).payload).toEqual({ status: "needs_review" });
    expect((await playback.handle("POST", "/api/cases/UR-1042/runs")).payload).toEqual({ runGroupId: "g1" });
    expect((await playback.handle("GET", "/api/runs/g1")).payload).toEqual({ status: "running" });
    expect(playback.advanceTick()).toBe(true);
    expect((await playback.handle("GET", "/api/runs/g1")).payload).toEqual({ status: "complete" });
    expect(playback.advanceTick()).toBe(false);
  });
  it("falls back to the latest earlier frame for a page seen before", async () => {
    const playback = new DemoPlayback(await recordRun());
    await playback.handle("POST", "/api/cases/UR-1042/runs");
    expect((await playback.handle("GET", "/api/cases/UR-1042")).payload).toEqual({ status: "needs_review" });
  });
  it("returns 404 for a read the recording never made", async () => {
    const playback = new DemoPlayback(await recordRun());
    expect((await playback.handle("GET", "/api/cases/UR-9999")).status).toBe(404);
  });
  it("refuses a write that is not the next recorded write and stays in place", async () => {
    const playback = new DemoPlayback(await recordRun());
    expect((await playback.handle("PATCH", "/api/claims/c1")).payload).toEqual({ error: { code: "demo_out_of_sync" } });
    expect((await playback.handle("POST", "/api/cases/UR-1042/runs")).status).toBe(200);
  });
  it("skips a pending tick before the next write", async () => {
    const recorder = new DemoRecorder("x");
    await recorder.handle("GET", "/run", ok({ status: "running" }));
    await recorder.handle("GET", "/run", ok({ status: "complete" }));
    await recorder.handle("PATCH", "/claim", ok({ id: "c1" }));
    const playback = new DemoPlayback(recorder.recording("t"));
    expect((await playback.handle("PATCH", "/claim")).payload).toEqual({ id: "c1" });
  });
});

describe("client API in demo mode", () => {
  afterEach(() => { setDemoSource(null); vi.unstubAllGlobals(); });
  it("never calls the network while a playback is active", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    setDemoSource(new DemoPlayback(await recordRun()));
    expect(await readApi("/api/cases/UR-1042")).toEqual({ status: "needs_review" });
    expect(await writeApi("/api/cases/UR-1042/runs", "POST", {})).toEqual({ runGroupId: "g1" });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("raises a recorded refusal as the same ApiError the screens handle", async () => {
    setDemoSource(new DemoPlayback(await recordRun()));
    const error = await writeApi("/api/claims/c1", "PATCH", {}).catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: "demo_out_of_sync" });
  });
  it("uses the network when no demo is active", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal("fetch", fetch);
    expect(await readApi("/api/cases")).toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledOnce();
  });
});
