"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { StreamingText } from "@/components/streaming-text";
import { TranslatePopover, type TranslateTarget } from "@/components/translate-popover";
import { cn } from "@/lib/utils";
import { cleanWord, findCueIndex, formatTime, type Cue } from "@/lib/youtube";

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
const HOVER_DELAY_MS = 350;
const MAX_SELECTION_CHARS = 200;

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

/** Renders a cue's text as hoverable word spans. */
function Words({ text }: { text: string }) {
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);
  return (
    <>
      {words.map((word, i) => (
        <span key={i} data-word={cleanWord(word) || undefined}>
          {word}
          {i < words.length - 1 ? " " : ""}
        </span>
      ))}
    </>
  );
}

function hasTextSelection(): boolean {
  return Boolean(window.getSelection()?.toString().trim());
}

export default function TranscriptPanel({ cues, currentTime, stream, autoScroll, onSeek }: Props) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const lastUserScroll = useRef(0);
  const groups = useMemo(() => groupByMinute(cues), [cues]);
  const activeIndex = findCueIndex(cues, currentTime);

  // ----- hover / selection translation -----
  const [target, setTarget] = useState<TranslateTarget | null>(null);
  const pinnedRef = useRef(false); // true while showing a selection (survives mouse movement)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoveredEl = useRef<HTMLElement | null>(null);

  const clearHoverTimer = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
  };

  const contextFor = useCallback(
    (el: HTMLElement): string | undefined => {
      const cueEl = el.closest<HTMLElement>("[data-cue]");
      const index = Number(cueEl?.dataset.cue);
      return Number.isFinite(index) ? cues[index]?.text : undefined;
    },
    [cues],
  );

  const handleMouseOver = (e: React.MouseEvent) => {
    if (pinnedRef.current) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-word]");
    if (!el || el === hoveredEl.current) return;
    hoveredEl.current = el;
    clearHoverTimer();
    hoverTimer.current = setTimeout(() => {
      const word = el.dataset.word;
      if (!word || hoveredEl.current !== el) return;
      setTarget({ text: word, context: contextFor(el), rect: el.getBoundingClientRect() });
    }, HOVER_DELAY_MS);
  };

  const handleMouseOut = (e: React.MouseEvent) => {
    if (pinnedRef.current) return;
    const el = (e.target as HTMLElement).closest<HTMLElement>("[data-word]");
    if (!el || el !== hoveredEl.current) return;
    const next = e.relatedTarget as Node | null;
    if (next && el.contains(next)) return;
    hoveredEl.current = null;
    clearHoverTimer();
    setTarget(null);
  };

  // Selecting a phrase translates the whole phrase and keeps the tooltip open until the next click.
  const handleSelectionEnd = () => {
    const selection = window.getSelection();
    const text = selection?.toString().replace(/\s+/g, " ").trim() ?? "";
    if (!selection || selection.rangeCount === 0 || !text) {
      if (pinnedRef.current) {
        pinnedRef.current = false;
        setTarget(null);
      }
      return;
    }
    const range = selection.getRangeAt(0);
    const viewport = viewportRef.current;
    if (!viewport || !viewport.contains(range.commonAncestorContainer)) return;
    if (text.length > MAX_SELECTION_CHARS) return;
    const start = range.startContainer.parentElement;
    clearHoverTimer();
    hoveredEl.current = null;
    pinnedRef.current = true;
    setTarget({ text, context: start ? contextFor(start) : undefined, rect: range.getBoundingClientRect() });
  };

  useEffect(() => {
    // A click anywhere dismisses a pinned selection tooltip once the selection is gone.
    const onMouseDown = () => {
      if (pinnedRef.current) {
        pinnedRef.current = false;
        setTarget(null);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, []);

  useEffect(() => clearHoverTimer, []);

  const markUserScroll = () => {
    lastUserScroll.current = Date.now();
  };

  // Hide the hover tooltip while the panel scrolls, otherwise it drifts away from its word.
  const handleScroll = () => {
    if (target && !pinnedRef.current) {
      clearHoverTimer();
      hoveredEl.current = null;
      setTarget(null);
    }
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
    <>
      <div
        ref={viewportRef}
        className="h-full overflow-y-auto px-4 py-3 outline-none"
        onWheel={markUserScroll}
        onTouchMove={markUserScroll}
        onScroll={handleScroll}
        onMouseOver={handleMouseOver}
        onMouseOut={handleMouseOut}
        onMouseUp={handleSelectionEnd}
        onTouchEnd={handleSelectionEnd}
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
                    if (hasTextSelection()) return; // the user was selecting text, not clicking to seek
                    lastUserScroll.current = 0;
                    onSeek(cue.start);
                  };
                  return (
                    <span
                      key={index}
                      data-cue={index}
                      data-active={isActive || undefined}
                      data-past={isPast || undefined}
                      onClick={seek}
                      className={cn(
                        "cursor-pointer rounded-sm transition-colors [&_[data-word]:hover]:underline [&_[data-word]:hover]:decoration-dotted [&_[data-word]:hover]:underline-offset-4",
                        isPast && "text-foreground/85 hover:text-foreground",
                        !isPast && !isActive && "text-muted-foreground/70 hover:text-foreground",
                        isActive && !stream && "bg-primary/10 px-0.5 text-foreground",
                        isActive && stream && "text-foreground",
                      )}
                    >
                      {isActive && stream ? (
                        <StreamingText text={cue.text} progress={cueProgress(cues, index, currentTime)} caret />
                      ) : (
                        <Words text={cue.text} />
                      )}{" "}
                    </span>
                  );
                })}
              </p>
            </section>
          );
        })}
      </div>
      <TranslatePopover target={target} />
    </>
  );
}
