/** Shared (client + server) helpers and types for the transcript feature. */

export const DEFAULT_VIDEO_ID = "ejVkyXSl63I";

export interface Cue {
  /** Start time in seconds. */
  start: number;
  /** Duration in seconds. */
  dur: number;
  text: string;
}

export interface TrackInfo {
  code: string;
  name: string;
  generated: boolean;
}

export interface TranscriptData {
  videoId: string;
  language: string;
  languageCode: string;
  isGenerated: boolean;
  available: TrackInfo[];
  cues: Cue[];
}

const VIDEO_ID_RE = /^[\w-]{11}$/;

/** Accepts a bare 11-character ID or any common YouTube URL form. Returns null if none found. */
export function parseVideoId(value: string | null | undefined): string | null {
  const v = (value ?? "").trim();
  if (!v) return null;
  if (VIDEO_ID_RE.test(v)) return v;
  const m = v.match(/(?:v=|youtu\.be\/|\/embed\/|\/shorts\/|\/live\/|\/v\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, "0") : String(m);
  return `${h ? h + ":" : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/** Index of the last cue whose start <= t (binary search), or -1 before the first cue. */
export function findCueIndex(cues: Cue[], t: number): number {
  let lo = 0;
  let hi = cues.length - 1;
  let ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (cues[mid].start <= t) {
      ans = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return ans;
}

const EDGE_PUNCTUATION = /^[\s«»"'“”‘’(\[{.,;:!?…—–-]+|[\s«»"'“”‘’)\]}.,;:!?…—–-]+$/g;

/** Strips surrounding punctuation from a token so "«Bonjour," becomes "Bonjour". */
export function cleanWord(token: string): string {
  return token.replace(EDGE_PUNCTUATION, "");
}
