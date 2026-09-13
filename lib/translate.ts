/**
 * French -> English translation for hover lookups.
 *
 * Two providers:
 *  - "claude"   (used automatically when ANTHROPIC_API_KEY is set): context-aware, returns the
 *               meaning of the word or phrase as used in the sentence it came from.
 *  - "mymemory" (default, no key needed): the free MyMemory translation API.
 *
 * Force one with TRANSLATE_PROVIDER=claude|mymemory.
 */
import Anthropic from "@anthropic-ai/sdk";

export interface Translation {
  source: string;
  translation: string;
  /** Short extra note (base form, part of speech, literal meaning). */
  note?: string;
  provider: "claude" | "mymemory";
}

export class TranslateError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
    this.name = "TranslateError";
  }
}

const MAX_CACHE = 2000;
const cache = new Map<string, Translation>();

function remember(key: string, value: Translation) {
  if (cache.size >= MAX_CACHE) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, value);
}

export function activeProvider(): Translation["provider"] {
  const forced = process.env.TRANSLATE_PROVIDER?.toLowerCase();
  if (forced === "claude" || forced === "mymemory") return forced;
  return process.env.ANTHROPIC_API_KEY ? "claude" : "mymemory";
}

export async function translate(text: string, context?: string): Promise<Translation> {
  const provider = activeProvider();
  const key = `${provider}|${text.toLowerCase()}|${provider === "claude" ? (context ?? "") : ""}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const result = provider === "claude" ? await translateWithClaude(text, context) : await translateWithMyMemory(text);
  remember(key, result);
  return result;
}

// ---------- Claude ----------

let anthropic: Anthropic | null = null;

const SYSTEM_PROMPT = `You are a French-to-English dictionary for a language learner watching a French video.
You get a French word or phrase and the sentence it appears in. Reply with the English meaning as it is used in that sentence.

Reply format, nothing else:
line 1: the English translation (1 to 6 words)
line 2 (optional): a brief note under 12 words, e.g. the dictionary form if the word is inflected, the part of speech, or a literal meaning when the translation is idiomatic.`;

async function translateWithClaude(text: string, context?: string): Promise<Translation> {
  anthropic ??= new Anthropic();
  const user = context ? `Word or phrase: «${text}»\nSentence: «${context}»` : `Word or phrase: «${text}»`;

  let response: Anthropic.Message;
  try {
    response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: 256,
      output_config: { effort: "low" },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: user }],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new TranslateError("Invalid ANTHROPIC_API_KEY.", 500);
    if (err instanceof Anthropic.RateLimitError) throw new TranslateError("Translation rate limit reached. Try again shortly.", 429);
    if (err instanceof Anthropic.APIError) throw new TranslateError(`Translation service error (${err.status}).`, 502);
    throw err;
  }

  if (response.stop_reason === "refusal") {
    throw new TranslateError("The translation service declined this request.", 502);
  }
  const raw = response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n")
    .trim();
  const [first, ...rest] = raw.split("\n").map((line) => line.trim()).filter(Boolean);
  if (!first) throw new TranslateError("Empty translation.", 502);
  return { source: text, translation: first, note: rest.join(" ") || undefined, provider: "claude" };
}

// ---------- MyMemory ----------

async function translateWithMyMemory(text: string): Promise<Translation> {
  const params = new URLSearchParams({ q: text, langpair: "fr|en" });
  if (process.env.MYMEMORY_EMAIL) params.set("de", process.env.MYMEMORY_EMAIL); // raises the daily quota
  const res = await fetch(`https://api.mymemory.translated.net/get?${params}`, { cache: "no-store" });
  if (!res.ok) throw new TranslateError(`Translation service responded with HTTP ${res.status}.`, 502);
  const body = (await res.json()) as {
    responseStatus?: number | string;
    responseDetails?: string;
    responseData?: { translatedText?: string };
  };
  const status = Number(body.responseStatus);
  if (status === 429) throw new TranslateError("Daily translation quota reached. Set MYMEMORY_EMAIL or ANTHROPIC_API_KEY.", 429);
  const translated = body.responseData?.translatedText?.trim();
  if (status !== 200 || !translated) {
    throw new TranslateError(body.responseDetails || "Translation service returned no result.", 502);
  }
  return { source: text, translation: decodeEntities(translated), provider: "mymemory" };
}

function decodeEntities(s: string): string {
  return s.replace(/&(amp|lt|gt|quot|#39|apos);/g, (_, e: string) =>
    ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'" })[e] ?? _,
  );
}
