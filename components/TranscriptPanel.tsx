"use client";

import { useEffect, useRef } from "react";
import { formatTime, type Cue } from "@/lib/youtube";

interface Props {
  cues: Cue[];
  activeIndex: number;
  autoScroll: boolean;
  onSeek: (index: number) => void;
}

const USER_SCROLL_GRACE_MS = 4000;

export default function TranscriptPanel({ cues, activeIndex, autoScroll, onSeek }: Props) {
  const paneRef = useRef<HTMLDivElement>(null);
  const lastUserScroll = useRef(0);

  // A wheel/touch/keyboard scroll pauses auto-scroll for a few seconds so we don't fight the user.
  const markUserScroll = () => {
    lastUserScroll.current = Date.now();
  };

  useEffect(() => {
    const pane = paneRef.current;
    if (!pane || !autoScroll || activeIndex < 0) return;
    if (Date.now() - lastUserScroll.current < USER_SCROLL_GRACE_MS) return;

    const el = pane.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    if (!el) return;
    const paneRect = pane.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const target = pane.scrollTop + (elRect.top - paneRect.top) - paneRect.height / 2 + elRect.height / 2;
    pane.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }, [activeIndex, autoScroll]);

  // Reset scroll position when a new transcript arrives.
  useEffect(() => {
    paneRef.current?.scrollTo({ top: 0 });
    lastUserScroll.current = 0;
  }, [cues]);

  return (
    <div
      ref={paneRef}
      className="transcript"
      onWheel={markUserScroll}
      onTouchMove={markUserScroll}
      onKeyDown={(e) => {
        if (["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "].includes(e.key)) markUserScroll();
      }}
      tabIndex={0}
    >
      {cues.map((cue, i) => (
        <button
          key={`${cue.start}-${i}`}
          type="button"
          data-index={i}
          className={"cue" + (i === activeIndex ? " active" : i < activeIndex ? " past" : "")}
          onClick={() => {
            lastUserScroll.current = 0; // a click means "take me there": re-enable auto-scroll
            onSeek(i);
          }}
        >
          <span className="time">{formatTime(cue.start)}</span>
          <span className="text">{cue.text}</span>
        </button>
      ))}
    </div>
  );
}
