import TranscriptPlayer from "@/components/TranscriptPlayer";
import { DEFAULT_VIDEO_ID, parseVideoId } from "@/lib/youtube";

interface PageProps {
  searchParams: Promise<{ v?: string | string[] }>;
}

export default async function Page({ searchParams }: PageProps) {
  const { v } = await searchParams;
  const requested = Array.isArray(v) ? v[0] : v;
  const videoId = parseVideoId(requested) ?? DEFAULT_VIDEO_ID;
  return <TranscriptPlayer key={videoId} initialVideoId={videoId} />;
}
