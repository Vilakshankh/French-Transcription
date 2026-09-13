"use client";

import { useMemo } from "react";

import { cn } from "@/lib/utils";
import { cleanWord } from "@/lib/youtube";

interface StreamingTextProps {
  text: string;
  /** 0..1 — how much of the text has "arrived". */
  progress: number;
  /** Show a blinking caret after the last revealed word. */
  caret?: boolean;
  className?: string;
}

/**
 * Reveals text word by word, like a streaming response. Each newly revealed word
 * fades in; already-revealed words stay put so the paragraph only ever grows.
 */
export function StreamingText({ text, progress, caret = false, className }: StreamingTextProps) {
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  const clamped = Math.min(1, Math.max(0, progress));
  const visible = Math.min(words.length, Math.ceil(clamped * words.length));

  return (
    <span className={cn("inline", className)} data-slot="streaming-text">
      {words.slice(0, visible).map((word, i) => (
        <span
          key={i}
          data-word={cleanWord(word) || undefined}
          className="animate-in fade-in duration-300 inline"
        >
          {word}
          {i < visible - 1 ? " " : ""}
        </span>
      ))}
      {caret && (
        <span
          aria-hidden="true"
          className="ml-0.5 inline-block h-[1em] w-0.5 translate-y-[0.15em] animate-pulse rounded-full bg-primary align-baseline"
        />
      )}
    </span>
  );
}
