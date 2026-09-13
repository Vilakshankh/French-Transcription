"use client";

import { useEffect, useRef } from "react";

/** Minimal typing for the parts of the YouTube IFrame Player API we use. */
export interface YTPlayer {
  getCurrentTime(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  pauseVideo(): void;
  loadVideoById(videoId: string): void;
  destroy(): void;
}

export const PlayerState = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 } as const;

interface YTNamespace {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: YTPlayer }) => void;
        onStateChange?: (e: { data: number }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

/** Loads https://www.youtube.com/iframe_api once and resolves with the global `YT` namespace. */
function loadYouTubeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") return new Promise(() => {});
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve(window.YT!);
    };
    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => {
      apiPromise = null;
      reject(new Error("Could not load the YouTube player API. Check your network connection."));
    };
    document.head.appendChild(script);
  });
  return apiPromise;
}

interface Props {
  videoId: string;
  onReady?: (player: YTPlayer) => void;
  onStateChange?: (state: number) => void;
  onError?: (message: string) => void;
}

const ERROR_MESSAGES: Record<number, string> = {
  2: "Invalid video ID.",
  5: "This video cannot be played in the HTML5 player.",
  100: "Video not found (removed or private).",
  101: "The owner does not allow this video to be embedded.",
  150: "The owner does not allow this video to be embedded.",
};

export default function YouTubePlayer({ videoId, onReady, onStateChange, onError }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const readyRef = useRef(false);

  // Keep the latest callbacks without re-creating the player.
  const callbacks = useRef({ onReady, onStateChange, onError });
  callbacks.current = { onReady, onStateChange, onError };
  const videoIdRef = useRef(videoId);
  videoIdRef.current = videoId;

  useEffect(() => {
    let cancelled = false;
    // The API replaces the target element with an iframe, so give it a disposable child.
    const host = document.createElement("div");
    containerRef.current?.appendChild(host);

    loadYouTubeApi()
      .then((YT) => {
        if (cancelled) return;
        playerRef.current = new YT.Player(host, {
          videoId: videoIdRef.current,
          playerVars: { rel: 0, playsinline: 1 },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              readyRef.current = true;
              callbacks.current.onReady?.(e.target);
            },
            onStateChange: (e) => callbacks.current.onStateChange?.(e.data),
            onError: (e) =>
              callbacks.current.onError?.(ERROR_MESSAGES[e.data] ?? `The player reported an error (${e.data}).`),
          },
        });
      })
      .catch((err: Error) => {
        if (!cancelled) callbacks.current.onError?.(err.message);
      });

    return () => {
      cancelled = true;
      readyRef.current = false;
      try {
        playerRef.current?.destroy();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
      host.remove();
    };
  }, []);

  useEffect(() => {
    if (readyRef.current && playerRef.current) {
      playerRef.current.loadVideoById(videoId);
    }
  }, [videoId]);

  return <div ref={containerRef} className="player-frame" />;
}
