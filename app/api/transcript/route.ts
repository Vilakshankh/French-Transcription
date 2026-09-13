import { NextRequest, NextResponse } from "next/server";
import { getTranscript, TranscriptError } from "@/lib/transcript";
import { parseVideoId } from "@/lib/youtube";

export const dynamic = "force-dynamic";

/** GET /api/transcript?v=<video id or URL>&lang=<optional caption language code> */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const videoId = parseVideoId(searchParams.get("v") ?? searchParams.get("video_id"));
  const lang = searchParams.get("lang")?.trim() || undefined;

  if (!videoId) {
    return NextResponse.json({ error: "Missing or invalid `v` parameter (YouTube URL or video ID)." }, { status: 400 });
  }
  if (lang && !/^[a-zA-Z-]{2,12}$/.test(lang)) {
    return NextResponse.json({ error: "Invalid `lang` parameter." }, { status: 400 });
  }

  try {
    const data = await getTranscript(videoId, lang);
    return NextResponse.json(data, { headers: { "Cache-Control": "public, max-age=3600" } });
  } catch (err) {
    if (err instanceof TranscriptError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Failed to fetch transcript: ${message}` }, { status: 502 });
  }
}
