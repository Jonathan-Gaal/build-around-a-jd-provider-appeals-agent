"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { setDemoSource } from "@/lib/client/api";
import { DemoPlayback, DemoRecorder, type DemoRecording } from "@/lib/client/demo-source";
import { DEMO_PACE, makeCursor, runSteps } from "@/lib/client/demo-runner";
import { SEGMENTS, STORIES, type SegmentId, type StoryId } from "@/lib/client/demo-scripts";
import { useWorkflowReducedMotion } from "@/lib/client/workflow-reduced-motion";
import { CaseWorkspace, type CaseTab } from "./case-workspace";
import { RoleWorkspace } from "./role-workspace";
import { WorkspaceOverview, type WorkspaceView } from "./workspace-overview";

// Each recording loads only when its segment plays.
const load = (id: SegmentId): Promise<DemoRecording> => ({
  "clinician-review": () => import("@/fixtures/demo/clinician-review.json"),
  coordinator: () => import("@/fixtures/demo/coordinator.json"),
  "clinician-signoff": () => import("@/fixtures/demo/clinician-signoff.json"),
  packet: () => import("@/fixtures/demo/packet.json"),
  manager: () => import("@/fixtures/demo/manager.json"),
}[id]()).then(module => module.default as unknown as DemoRecording);

const CASE_TABS: CaseTab[] = ["summary", "evidence", "issues", "recheck", "approval", "attachment", "dates"];
const VIEWS: WorkspaceView[] = ["queue", "my-reviews", "requests", "activity", "profile", "notifications", "search"];
const ROLE_PAGES = { "/roles/coordinator": "coordinator", "/roles/manager": "supervisor", "/roles/submission": "packet_staff" } as const;

/** The same screens the signed-in app routes to, chosen from the demo's own address instead of the URL. */
function DemoScreen({ location }: { location: string }) {
  const path = location.split("?")[0]!;
  const caseRoute = /^\/cases\/([^/]+)\/([a-z]+)$/.exec(path);
  if (caseRoute && CASE_TABS.includes(caseRoute[2] as CaseTab)) return <CaseWorkspace caseId={decodeURIComponent(caseRoute[1]!)} tab={caseRoute[2] as CaseTab} />;
  if (path in ROLE_PAGES) return <RoleWorkspace role={ROLE_PAGES[path as keyof typeof ROLE_PAGES]} />;
  const view = (path === "/" ? "queue" : path.slice(1)) as WorkspaceView;
  if (VIEWS.includes(view)) return <WorkspaceOverview view={view} />;
  return <p className="p-10">This page is not part of the demo.</p>;
}

type Status = "choosing" | "playing" | "done" | "failed";
declare global { interface Window { __demoFiles?: Record<string, string>; __demoRecording?: DemoRecording; __demoStatus?: string } }

export function DemoPlayer({ recordSegment }: { recordSegment: SegmentId | null }) {
  const reducedMotion = useWorkflowReducedMotion();
  const [status, setStatus] = useState<Status>("choosing");
  const [story, setStory] = useState<StoryId | null>(null);
  const [screen, setScreen] = useState<{ key: number; location: string; role: string } | null>(null);
  const [caption, setCaption] = useState("");
  const [recordedAt, setRecordedAt] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);

  const show = useCallback((location: string, role: string) => {
    setScreen(current => ({ key: (current?.key ?? 0) + 1, location, role }));
    // Screens read ?claim= and ?document= from the address bar, as they do in the app.
    window.history.replaceState(window.history.state, "", `/demo${location.includes("?") ? location.slice(location.indexOf("?")) : ""}`);
  }, []);

  // Links inside the screens move the demo, never the browser, so a replay can't leave /demo.
  function keepLinksInDemo(event: MouseEvent) {
    const href = (event.target as HTMLElement).closest("a")?.getAttribute("href");
    if (!href?.startsWith("/") || href.startsWith("/demo")) return;
    event.preventDefault();
    if (screen) show(href, screen.role);
  }

  const play = useCallback(async (id: StoryId) => {
    controller.current?.abort();
    const abort = new AbortController();
    controller.current = abort;
    setStory(id); setStatus("playing"); setFailure(null); setCaption("");
    const cursor = makeCursor(reducedMotion);
    let playback: DemoPlayback | null = null;
    const ticks = window.setInterval(() => { playback?.advanceTick(); }, 1500 * DEMO_PACE);
    try {
      for (const segmentId of STORIES.find(item => item.id === id)!.segments) {
        const segment = SEGMENTS[segmentId], recording = await load(segmentId);
        playback = new DemoPlayback(recording);
        setDemoSource(playback); setRecordedAt(recording.recordedAt);
        show(segment.start, segment.roleLabel);
        await runSteps(segment.steps, { cursor, caption: setCaption, signal: abort.signal, files: recording.files, reducedMotion });
      }
      setStatus("done"); setCaption("That's the demo. Watch it again or pick another view.");
    } catch (cause) {
      if (abort.signal.aborted) return;
      setStatus("failed"); setFailure(cause instanceof Error ? cause.message : "unknown");
    } finally { window.clearInterval(ticks); cursor.remove(); }
  }, [reducedMotion, show]);

  const stop = useCallback(() => {
    controller.current?.abort(); setDemoSource(null);
    setStatus("choosing"); setScreen(null); setStory(null);
    window.history.replaceState(window.history.state, "", "/demo");
  }, []);

  // Record mode (local only): the same steps drive the real screens against the real server, saving every response.
  useEffect(() => {
    if (!recordSegment) return;
    const segment = SEGMENTS[recordSegment], files = window.__demoFiles ?? {};
    const recorder = new DemoRecorder(recordSegment, files);
    const cursor = makeCursor(true), abort = new AbortController();
    setDemoSource(recorder); setStatus("playing"); show(segment.start, `${segment.roleLabel} · recording`);
    window.__demoStatus = "recording";
    runSteps(segment.steps, { cursor, caption: setCaption, signal: abort.signal, files, reducedMotion: true })
      .then(() => { window.__demoRecording = recorder.recording(new Date().toISOString()); window.__demoStatus = "done"; })
      .catch((cause: unknown) => { window.__demoStatus = `failed: ${cause instanceof Error ? cause.message : "unknown"}`; })
      .finally(() => cursor.remove());
    return () => { abort.abort(); setDemoSource(null); };
  }, [recordSegment, show]);

  useEffect(() => () => { controller.current?.abort(); setDemoSource(null); }, []);

  if (status === "choosing" || !screen) return <DemoChooser onPlay={id => { void play(id); }} />;
  const label = recordSegment ? "Recording demo" : "Demo replay";
  return <div onClickCapture={keepLinksInDemo}>
    <div data-demo-chrome className="fixed inset-x-0 top-0 z-[10000] flex flex-wrap items-center justify-between gap-2 bg-[#1d392f] px-4 py-2 text-xs text-white">
      <span><strong className="mr-2 rounded bg-[#d9ff3f] px-2 py-0.5 text-[#1d392f]">{label.toUpperCase()}</strong>{screen.role} view<span className="hidden sm:inline"> · replaying a snapshot of real Claude calls{recordedAt && ` recorded ${new Date(recordedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" })}`} · case UR-1042 · no live AI calls</span></span>
      {!recordSegment && <button type="button" onClick={stop} className="rounded border border-white/40 px-3 py-1 font-semibold">Stop demo</button>}
    </div>
    {/* Viewers watch; the cursor clicks. This layer keeps a stray click from pulling the replay out of step. */}
    <div data-demo-chrome aria-hidden="true" className="fixed inset-0 z-[9990]" />
    <div className="pt-9"><DemoScreen key={screen.key} location={screen.location} /></div>
    <div data-demo-chrome className="fixed inset-x-0 bottom-0 z-[10000] flex justify-center p-4">
      <div role="status" aria-live="polite" data-demo-caption className="flex max-w-3xl flex-wrap items-center gap-3 rounded-xl bg-[#1d392f]/95 px-5 py-3 text-sm text-white shadow-xl">
        <span>{status === "failed" ? `The demo stopped (${failure}).` : caption || "…"}</span>
        {(status === "done" || status === "failed") && story && <>
          <button type="button" onClick={() => { void play(story); }} className="rounded bg-[#d9ff3f] px-3 py-1 font-semibold text-[#1d392f]">Watch again</button>
          <button type="button" onClick={stop} className="rounded border border-white/40 px-3 py-1">Choose another view</button>
        </>}
      </div>
    </div>
  </div>;
}

function DemoChooser({ onPlay }: { onPlay: (id: StoryId) => void }) {
  return <main className="flex min-h-screen items-center justify-center bg-[#f3f6f2] px-5 py-10 text-[#1e3e31]">
    <div className="w-full max-w-2xl">
      <div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-lg bg-[#255e4b] font-serif text-2xl font-bold text-white">W</span><span className="font-semibold">Wellline Review</span></div>
      <p className="mt-10 text-xs font-bold tracking-widest text-[#5c806a]">DEMO MODE</p>
      <h1 className="mt-2 font-serif text-3xl">Watch a concurrent review, start to finish</h1>
      <p className="mt-2 text-sm text-[#63786c]">Pick a view and it plays by itself on the real screens: a recorded run of the synthetic case UR-1042. Nothing is saved and nothing is sent to a payer.</p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">{STORIES.map(item => <li key={item.id} className={item.id === "full" ? "sm:col-span-2" : undefined}>
        <button type="button" onClick={() => onPlay(item.id)} className={`h-full w-full rounded-xl border p-5 text-left transition-colors hover:border-[#255e4b] ${item.id === "full" ? "border-[#255e4b] bg-[#255e4b] text-white" : "border-[#dce5de] bg-white"}`}>
          <strong className="block">{item.title} <span aria-hidden="true">▶</span></strong>
          <span className={`mt-2 block text-sm ${item.id === "full" ? "text-white/80" : "text-[#63786c]"}`}>{item.description}</span>
        </button>
      </li>)}</ul>
      <Link href="/login" className="mt-8 inline-block text-sm underline underline-offset-4">Sign in instead</Link>
    </div>
  </main>;
}
