export interface VocabEntry {
  id: string;
  french: string;
  english: string;
  note?: string;
  /** Video the word was saved from, and where in it. */
  videoId?: string;
  time?: number;
  addedAt: number;
}

export const VOCAB_STORAGE_KEY = "french-transcription:vocabulary";

export function normalizeFrench(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export function loadVocabulary(): VocabEntry[] {
  try {
    const raw = window.localStorage.getItem(VOCAB_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(parsed) ? (parsed as VocabEntry[]).filter((e) => e && typeof e.french === "string") : [];
  } catch {
    return [];
  }
}

export function saveVocabulary(entries: VocabEntry[]): void {
  try {
    window.localStorage.setItem(VOCAB_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    /* storage unavailable (private mode, quota) — keep the in-memory list */
  }
}

export function vocabularyToCsv(entries: VocabEntry[]): string {
  const escape = (v: string | number | undefined) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const rows = entries.map((e) => [e.french, e.english, e.note ?? "", e.videoId ?? "", e.time ?? ""].map(escape).join(","));
  return ["french,english,note,video,time", ...rows].join("\n");
}
