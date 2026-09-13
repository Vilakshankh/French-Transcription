import { NextRequest, NextResponse } from "next/server";
import { translate, TranslateError } from "@/lib/translate";

export const dynamic = "force-dynamic";

const MAX_TEXT = 200;
const MAX_CONTEXT = 600;

/** GET /api/translate?q=<french text>&context=<sentence it appears in> */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const q = searchParams.get("q")?.trim() ?? "";
  const context = searchParams.get("context")?.trim().slice(0, MAX_CONTEXT) || undefined;

  if (!q) return NextResponse.json({ error: "Missing `q` parameter." }, { status: 400 });
  if (q.length > MAX_TEXT) return NextResponse.json({ error: `Text is too long (max ${MAX_TEXT} characters).` }, { status: 400 });

  try {
    const result = await translate(q, context);
    return NextResponse.json(result, { headers: { "Cache-Control": "public, max-age=86400" } });
  } catch (err) {
    if (err instanceof TranslateError) return NextResponse.json({ error: err.message }, { status: err.status });
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Translation failed: ${message}` }, { status: 502 });
  }
}
