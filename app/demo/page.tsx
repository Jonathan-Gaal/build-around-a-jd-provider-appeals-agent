import type { Metadata } from "next";
import { DemoPlayer } from "@/components/demo-player";
import { SEGMENT_IDS, STORIES, type SegmentId, type StoryId } from "@/lib/client/demo-scripts";
import { isHosted } from "@/lib/env";

export const metadata: Metadata = { title: "Demo · Wellline Review" };

// Public on purpose: playback reads only the bundled recordings, never a session, the database or a model.
export default async function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { record, play } = await searchParams;
  const recordSegment = !isHosted() && SEGMENT_IDS.find(id => id === record) || null;
  const autoplay = STORIES.find(story => story.id === play)?.id ?? null;
  return <DemoPlayer recordSegment={recordSegment as SegmentId | null} autoplay={autoplay as StoryId | null} />;
}
