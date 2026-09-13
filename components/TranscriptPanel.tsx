"use client";

import { useEffect, useMemo, useRef } from "react";

import { StreamingText } from "@/components/streaming-text";
import { cn } from "@/lib/utils";
import { findCueIndex, formatTime, type Cue } from "@/lib/youtube";

interface Props {
  cues: Cue[];
  /** Current playback position in seconds. */
  currentTime: number;
  /** Reveal text as it is spoken (true) or show the whole transcript (false). */
  stream: boolean;
  autoScroll: boolean;
  onSeek: (seconds: number) => void;
}

const USER_SCROLL_GRACE_MS = 4000;

interface MinuteGroup {
  minute: number;
  cues: { cue: Cue; index: number }[];
}

/** Groups cues so each minute of the video starts a new paragraph with a time mark. */
function groupByMinute(cues: Cue[]): MinuteGroup[] {
  const groups: MinuteGroup[] = [];
  cues.forEach((cue, index) => {
    const minute = Math.floor(cue.start / 60);
    const last = groups[groups.length - 1];
    if (last && last.minute === minute) {
      last.cues.push({ cue, index });
    } else {
      groups.push({ minute, cues: [{ cue, index }] });
    }
  });
  return groups;
}

/** How far (0..1) playback is through the cue at `index`. */
function cueProgress(cues: Cue[], index: number, t: number): number {
  const cue = cues[index];
  const next = cues[index + 1];
  const end = cue.dur > 0 ? Math.min(cue.start + cue.dur, next?.start ?? Infinity) : (next?.start ?? cue.start + 3);
  const span = Math.max(0.25, end - cue.start);
  return Math.min(1, Math.max(0, (t - cue.start) / span));
}

export default function TranscriptPanel({ cues, currentTime, stream, autoScroll, onSeek }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const lastUserScroll = useRef(0);
  const groups = useMemo(() => groupByMinute(cues), [cues]);
  const activeIndex = findCueIndex(cues, currentTime);

  const markUserScroll = () => {
    lastUserScroll.current = Date.now();
  };

  // Keep the line being spoken in view (unless the user just scrolled themselves).
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || !autoScroll || activeIndex < 0) return;
    if (Date.now() - lastUserScroll.current < USER_SCROLL_GRACE_MS) return;
    const el = viewport.querySelector<HTMLElement>("[data-active='true']");
    if (!el) return;
    const vr = viewport.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    // Aim to keep the active line around two thirds down the panel so upcoming text has room.
    const target = viewport.scrollTop + (er.top - vr.top) - vr.height * 0.66 + er.height / 2;
    viewport.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }, [activeIndex, autoScroll]);

  useEffect(() => {
    viewportRef.current?.scrollTo({ top: 0 });
    lastUserScroll.current = 0;
  }, [cues]);

  return (
    <div
      ref={viewportRef}
      className="h-full overflow-y-auto px-4 py-3 outline-none"
      onWheel={markUserScroll}
      onTouchMove={markUserScroll}
      onKeyDown={(e) => {
        if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key)) markUserScroll();
      }}
      tabIndex={0}
    >
      {groups.map((group) => {
        const started = group.cues[0].index <= activeIndex;
        if (stream && !started) return null;
        const minuteStart = group.minute * 60;
        return (
          <section key={group.minute} className="mb-4 last:mb-0" data-minute={group.minute}>
            <button
              type="button"
              onClick={() => {
                lastUserScroll.current = 0;
                onSeek(minuteStart);
              }}
              className="mb-1 rounded-sm font-mono text-xs tabular-nums text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {formatTime(minuteStart)}
            </button>
            <p className="text-sm leading-7 text-pretty">
              {group.cues.map(({ cue, index }) => {
                const isActive = index === activeIndex;
                const isPast = index < activeIndex;
                if (stream && !isActive && !isPast) return null;
                const seek = () => {
                  lastUserScroll.current = 0;
                  onSeek(cue.start);
                };
                return (
                  <span
                    key={index}
                    data-active={isActive || undefined}
                    data-past={isPast || undefined}
                    onClick={seek}
                    className={cn(
                      "cursor-pointer rounded-sm transition-colors",
                      isPast && "text-foreground/85 hover:text-foreground",
                      !isPast && !isActive && "text-muted-foreground/70 hover:text-foreground",
                      isActive && !stream && "bg-primary/10 px-0.5 text-foreground",
                      isActive && stream && "text-foreground",
                    )}
                  >
                    {isActive && stream ? (
                      <StreamingText text={cue.text} progress={cueProgress(cues, index, currentTime)} caret />
                    ) : (
                      cue.text
                    )}{" "}
                  </span>
                );
              })}
            </p>
          </section>
        );
      })}
    </div>
  );
}
