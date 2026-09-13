"use client";

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { cleanWord } from "@/lib/youtube";

interface StreamingTextProps {
  text: string;
  /** 0..1 — how much of the text has "arrived". Omit to animate from 0 to 1 over `duration` ms. */
  progress?: number;
  /** Duration of the self-driven reveal when `progress` is omitted. */
  duration?: number;
  /** Show a blinking caret after the last revealed word. */
  caret?: boolean;
  className?: string;
}

/**
 * Reveals text word by word, like a streaming response. Each newly revealed word
 * fades in; already-revealed words stay put so the paragraph only ever grows.
 */
export function StreamingText({ text, progress, duration = 600, caret = false, className }: StreamingTextProps) {
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  const auto = useAutoProgress(progress === undefined, duration);
  const clamped = Math.min(1, Math.max(0, progress ?? auto));
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
          className="ml-0.5 inline-block h-[1em] w-0.5 animate-pulse rounded-full bg-primary align-middle"
        />
      )}
    </span>
  );
}

/** Drives progress from 0 to 1 over `duration` ms when `enabled`, otherwise stays at 1. */
function useAutoProgress(enabled: boolean, duration: number): number {
  const [value, setValue] = useState(enabled ? 0 : 1);
  useEffect(() => {
    if (!enabled) return;
    const start = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration);
      setValue(p);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [enabled, duration]);
  return value;
}
