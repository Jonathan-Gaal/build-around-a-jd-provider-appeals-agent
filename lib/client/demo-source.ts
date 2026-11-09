/**
 * Demo mode's data source. Record mode passes every API call through to the real server and saves what came back;
 * play mode answers the same calls from that recording, so a demo needs no login, database or model and writes nothing.
 * State is a list of frames (the GET responses true at one moment). A write moves to the next frame; so does a
 * "tick", which is a read that changed with no write in between (a review run finishing).
 */
export type DemoMethod = "GET" | "POST" | "PATCH";
export type RecordedResponse = { status: number; body: string };
export type DemoTransition = { kind: "write"; method: Exclude<DemoMethod, "GET">; url: string; response: string } | { kind: "tick" };
export type DemoRecording = {
  version: 1; segment: string; recordedAt: string;
  responses: Record<string, RecordedResponse>;
  frames: Record<string, string>[];
  transitions: DemoTransition[];
  files: Record<string, string>;
};
export type DemoResult = { status: number; payload: unknown };
export type DemoSource = { handle(method: DemoMethod, url: string, real: () => Promise<DemoResult>): Promise<DemoResult> };

/** Session expiry changes on every read; keeping it would turn each read into a tick. */
function normalize(url: string, payload: unknown): unknown {
  if (url !== "/api/auth/session" || typeof payload !== "object" || payload === null) return payload;
  return Object.fromEntries(Object.entries(payload).filter(([key]) => key !== "expires"));
}

export class DemoRecorder implements DemoSource {
  private readonly ids = new Map<string, string>();
  private readonly responses: Record<string, RecordedResponse> = {};
  private readonly frames: Record<string, string>[] = [{}];
  private readonly transitions: DemoTransition[] = [];
  private seen = new Set<string>();
  constructor(private readonly segment: string, private readonly files: Record<string, string> = {}) {}

  private nextFrame(transition: DemoTransition) {
    this.transitions.push(transition);
    this.frames.push({ ...this.frames[this.frames.length - 1]! });
    this.seen = new Set();
  }

  private store(result: DemoResult, url: string): string {
    const body = JSON.stringify(normalize(url, result.payload));
    const key = `${result.status}:${body}`;
    let id = this.ids.get(key);
    if (!id) { id = `r${this.ids.size}`; this.ids.set(key, id); this.responses[id] = { status: result.status, body }; }
    return id;
  }

  async handle(method: DemoMethod, url: string, real: () => Promise<DemoResult>): Promise<DemoResult> {
    const result = await real();
    const id = this.store(result, url);
    if (method === "GET") {
      // A new frame starts as a copy of the last one, so only a URL already read in this frame can show a tick.
      const frame = this.frames[this.frames.length - 1]!;
      if (this.seen.has(url) && frame[url] !== id) this.nextFrame({ kind: "tick" });
      this.frames[this.frames.length - 1]![url] = id;
      this.seen.add(url);
    } else this.nextFrame({ kind: "write", method, url, response: id });
    return result;
  }

  recording(recordedAt: string): DemoRecording {
    return { version: 1, segment: this.segment, recordedAt, responses: this.responses, frames: this.frames, transitions: this.transitions, files: this.files };
  }
}

export class DemoPlayback implements DemoSource {
  private frame = 0;
  constructor(private readonly recording: DemoRecording) {}

  /** The player calls this on a timer: a pending tick means the recorded server state moved on by itself. */
  advanceTick(): boolean {
    if (this.recording.transitions[this.frame]?.kind !== "tick") return false;
    this.frame++;
    return true;
  }

  private response(id: string): DemoResult {
    const stored = this.recording.responses[id];
    if (!stored) throw new Error("demo_recording_corrupt");
    return { status: stored.status, payload: JSON.parse(stored.body) };
  }

  async handle(method: DemoMethod, url: string): Promise<DemoResult> {
    if (method === "GET") {
      // The current frame, else the latest earlier frame that saw this URL (a page the recording visited before).
      for (let index = Math.min(this.frame, this.recording.frames.length - 1); index >= 0; index--) {
        const id = this.recording.frames[index]![url];
        if (id) return this.response(id);
      }
      return { status: 404, payload: { error: { code: "not_in_demo_recording" } } };
    }
    while (this.advanceTick()) { /* a write comes after any pending ticks */ }
    const next = this.recording.transitions[this.frame];
    if (next?.kind !== "write" || next.method !== method || next.url !== url) return { status: 409, payload: { error: { code: "demo_out_of_sync" } } };
    this.frame++;
    return this.response(next.response);
  }
}
