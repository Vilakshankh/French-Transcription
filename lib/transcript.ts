/**
 * Server-side transcript fetching.
 *
 * Mirrors the approach used by the youtube-transcript-api project: load the watch page to obtain
 * the Innertube API key, ask the Innertube player endpoint (as the Android client) for the caption
 * track list, then download and parse the chosen track's timed-text XML.
 */
import type { Cue, TrackInfo, TranscriptData } from "./youtube";

const WATCH_URL = (id: string) => `https://www.youtube.com/watch?v=${id}`;
const INNERTUBE_URL = (key: string) => `https://www.youtube.com/youtubei/v1/player?key=${key}`;
const INNERTUBE_CONTEXT = { client: { clientName: "ANDROID", clientVersion: "20.10.38" } };
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

/** Preferred languages, in order. French first: that is what this project is for. */
export const DEFAULT_LANGUAGES = ["fr", "fr-FR", "fr-CA", "en", "en-US", "en-GB"];

const CACHE_TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; data: TranscriptData }>();

export class TranscriptError extends Error {
  constructor(message: string, public status = 404) {
    super(message);
    this.name = "TranscriptError";
  }
}

interface CaptionTrack {
  baseUrl: string;
  languageCode: string;
  kind?: string; // "asr" for auto-generated
  name?: { simpleText?: string; runs?: { text: string }[] };
}

export async function getTranscript(videoId: string, lang?: string): Promise<TranscriptData> {
  const key = `${videoId}:${lang ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;

  const data = await fetchTranscript(videoId, lang);
  cache.set(key, { at: Date.now(), data });
  return data;
}

async function fetchTranscript(videoId: string, lang?: string): Promise<TranscriptData> {
  const html = await fetchWatchHtml(videoId);
  const apiKey = extractInnertubeKey(html, videoId);
  const player = await fetchInnertube(videoId, apiKey);
  assertPlayable(player, videoId);

  const tracks: CaptionTrack[] | undefined =
    player?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks?.length) {
    throw new TranscriptError("Subtitles are disabled or unavailable for this video.");
  }

  const available = tracks
    .map<TrackInfo>((t) => ({ code: t.languageCode, name: trackName(t), generated: t.kind === "asr" }))
    .sort((a, b) => Number(a.generated) - Number(b.generated) || a.name.localeCompare(b.name));

  const track = pickTrack(tracks, lang ? [lang] : DEFAULT_LANGUAGES, Boolean(lang));
  const xml = await fetchText(track.baseUrl.replace("&fmt=srv3", ""), videoId);
  const cues = parseTimedText(xml);

  return {
    videoId,
    language: trackName(track),
    languageCode: track.languageCode,
    isGenerated: track.kind === "asr",
    available,
    cues,
  };
}

/** Manual track in a preferred language, then auto-generated, then (unless strict) the first track. */
function pickTrack(tracks: CaptionTrack[], languages: string[], strict: boolean): CaptionTrack {
  for (const generated of [false, true]) {
    for (const code of languages) {
      const found = tracks.find((t) => t.languageCode === code && (t.kind === "asr") === generated);
      if (found) return found;
    }
  }
  if (strict) {
    throw new TranscriptError(`No transcript in language "${languages[0]}" for this video.`);
  }
  return tracks[0];
}

function trackName(t: CaptionTrack): string {
  return t.name?.simpleText ?? t.name?.runs?.map((r) => r.text).join("") ?? t.languageCode;
}

// ---------- HTTP ----------

async function fetchText(url: string, videoId: string, init: RequestInit = {}): Promise<string> {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9", ...(init.headers ?? {}) },
    cache: "no-store",
  });
  if (res.status === 429) throw new TranscriptError("YouTube is rate-limiting requests from this server. Try again later.", 429);
  if (!res.ok) throw new TranscriptError(`YouTube responded with HTTP ${res.status} for video ${videoId}.`, 502);
  return res.text();
}

async function fetchWatchHtml(videoId: string): Promise<string> {
  let html = await fetchText(WATCH_URL(videoId), videoId);
  if (html.includes('action="https://consent.youtube.com/s"')) {
    // EU consent interstitial: replay the request with the consent cookie set.
    const m = html.match(/name="v" value="(.*?)"/);
    if (!m) throw new TranscriptError("Could not get past YouTube's consent page.", 502);
    html = await fetchText(WATCH_URL(videoId), videoId, { headers: { Cookie: `CONSENT=YES+${m[1]}` } });
    if (html.includes('action="https://consent.youtube.com/s"')) {
      throw new TranscriptError("Could not get past YouTube's consent page.", 502);
    }
  }
  return html;
}

function extractInnertubeKey(html: string, videoId: string): string {
  const m = html.match(/"INNERTUBE_API_KEY":\s*"([a-zA-Z0-9_-]+)"/);
  if (m) return m[1];
  if (html.includes('class="g-recaptcha"')) {
    throw new TranscriptError("YouTube is blocking requests from this server's IP (captcha).", 429);
  }
  throw new TranscriptError(`Could not parse the YouTube page for video ${videoId}.`, 502);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchInnertube(videoId: string, apiKey: string): Promise<any> {
  const res = await fetch(INNERTUBE_URL(apiKey), {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT, "Accept-Language": "en-US" },
    body: JSON.stringify({ context: INNERTUBE_CONTEXT, videoId }),
    cache: "no-store",
  });
  if (!res.ok) throw new TranscriptError(`YouTube player API responded with HTTP ${res.status}.`, 502);
  return res.json();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function assertPlayable(player: any, videoId: string): void {
  const ps = player?.playabilityStatus;
  const status: string | undefined = ps?.status;
  if (!status || status === "OK") return;
  const reason: string | undefined = ps?.reason;
  if (status === "LOGIN_REQUIRED") {
    if (reason?.includes("bot")) throw new TranscriptError("YouTube flagged this server as a bot. Try again later.", 429);
    throw new TranscriptError("This video is age-restricted; transcripts require sign-in.");
  }
  if (status === "ERROR" && reason?.includes("unavailable")) {
    throw new TranscriptError(`Video ${videoId} is unavailable.`);
  }
  throw new TranscriptError(reason ? `Video is not playable: ${reason}` : "Video is not playable.");
}

// ---------- parsing ----------

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ent: string) => {
    if (ent[0] === "#") {
      const code = ent[1].toLowerCase() === "x" ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[ent.toLowerCase()] ?? whole;
  });
}

/** Parses YouTube's timed-text XML: <text start="1.23" dur="4.5">Hello</text> */
export function parseTimedText(xml: string): Cue[] {
  const cues: Cue[] = [];
  const re = /<text\b([^>]*)>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) {
    const attrs = m[1];
    const start = parseFloat(attrs.match(/\bstart="([\d.]+)"/)?.[1] ?? "");
    const dur = parseFloat(attrs.match(/\bdur="([\d.]+)"/)?.[1] ?? "0");
    if (!Number.isFinite(start)) continue;
    // Text is double-encoded (entities inside XML), so decode, strip tags, decode again.
    const text = decodeEntities(decodeEntities(m[2]).replace(/<[^>]*>/g, ""))
      .replace(/\s+/g, " ")
      .trim();
    if (text) cues.push({ start: round(start), dur: round(Number.isFinite(dur) ? dur : 0), text });
  }
  return cues.sort((a, b) => a.start - b.start);
}

const round = (n: number) => Math.round(n * 1000) / 1000;
