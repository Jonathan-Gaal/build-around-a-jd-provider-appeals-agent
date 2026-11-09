import type { Metadata } from "next";
import { DemoPlayer } from "@/components/demo-player";
import { SEGMENT_IDS, type SegmentId } from "@/lib/client/demo-scripts";
import { isHosted } from "@/lib/env";

export const metadata: Metadata = { title: "Demo · Wellline Review" };

// Public on purpose: playback reads only the bundled recordings, never a session, the database or a model.
// Playback starts only from a button on the page; no address starts it.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { record } = await searchParams;
  const recordSegment = !isHosted() && SEGMENT_IDS.find(id => id === record) || null;
  return <DemoPlayer recordSegment={recordSegment as SegmentId | null} />;
}
