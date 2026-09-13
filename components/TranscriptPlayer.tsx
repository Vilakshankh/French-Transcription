"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import YouTubePlayer, { PlayerState, type YTPlayer } from "./YouTubePlayer";
import TranscriptPanel from "./TranscriptPanel";
import { findCueIndex, parseVideoId, type TranscriptData } from "@/lib/youtube";

const POLL_MS = 200;

type LoadState =
  | { status: "loading" }
  | { status: "ready"; data: TranscriptData }
  | { status: "error"; message: string };

interface Props {
  initialVideoId: string;
}

export default function TranscriptPlayer({ initialVideoId }: Props) {
  const [videoId, setVideoId] = useState(initialVideoId);
  const [inputValue, setInputValue] = useState(`https://www.youtube.com/watch?v=${initialVideoId}`);
  const [lang, setLang] = useState<string | undefined>(undefined);
  const [transcript, setTranscript] = useState<LoadState>({ status: "loading" });
  const [activeIndex, setActiveIndex] = useState(-1);
  const [autoScroll, setAutoScroll] = useState(true);
  const [playerMessage, setPlayerMessage] = useState<{ text: string; error: boolean } | null>(null);

  const playerRef = useRef<YTPlayer | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cuesRef = useRef<TranscriptData["cues"]>([]);
  cuesRef.current = transcript.status === "ready" ? transcript.data.cues : [];

  // ----- transcript loading -----
  useEffect(() => {
    const controller = new AbortController();
    setTranscript({ status: "loading" });
    setActiveIndex(-1);

    const params = new URLSearchParams({ v: videoId });
    if (lang) params.set("lang", lang);

    fetch(`/api/transcript?${params}`, { signal: controller.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
        return body as TranscriptData;
      })
      .then((data) => setTranscript({ status: "ready", data }))
      .catch((err: Error) => {
        if (err.name !== "AbortError") setTranscript({ status: "error", message: err.message });
      });

    return () => controller.abort();
  }, [videoId, lang]);

  // Keep ?v= in the address bar in sync so the page is shareable.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("v") !== videoId) {
      url.searchParams.set("v", videoId);
      window.history.replaceState(null, "", url);
    }
  }, [videoId]);

  // ----- playback sync -----
  const syncNow = useCallback(() => {
    const player = playerRef.current;
    if (!player || !cuesRef.current.length) return;
    setActiveIndex(findCueIndex(cuesRef.current, player.getCurrentTime()));
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = null;
  }, []);

  const startPolling = useCallback(() => {
    if (pollRef.current) return;
    pollRef.current = setInterval(syncNow, POLL_MS);
  }, [syncNow]);

  useEffect(() => stopPolling, [stopPolling]);

  // Re-sync once the transcript arrives (the video may already be playing).
  useEffect(() => {
    if (transcript.status === "ready") syncNow();
  }, [transcript, syncNow]);

  const handlePlayerReady = useCallback(
    (player: YTPlayer) => {
      playerRef.current = player;
      syncNow();
    },
    [syncNow],
  );

  const handleStateChange = useCallback(
    (state: number) => {
      if (state === PlayerState.PLAYING) {
        startPolling();
      } else {
        syncNow(); // keep the highlight accurate after a pause or seek
        if (state !== PlayerState.BUFFERING) stopPolling();
      }
    },
    [startPolling, stopPolling, syncNow],
  );

  const handleSeek = useCallback((index: number) => {
    const cue = cuesRef.current[index];
    const player = playerRef.current;
    if (!cue || !player) return;
    player.seekTo(cue.start, true);
    player.playVideo();
    setActiveIndex(index);
  }, []);

  // ----- load form -----
  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const id = parseVideoId(inputValue);
    if (!id) {
      setPlayerMessage({ text: "That doesn't look like a YouTube URL or video ID.", error: true });
      return;
    }
    setPlayerMessage(null);
    if (id !== videoId) {
      setLang(undefined);
      setVideoId(id);
      setInputValue(`https://www.youtube.com/watch?v=${id}`);
    }
  };

  const data = transcript.status === "ready" ? transcript.data : null;
  const tracks = data?.available?.length
    ? data.available
    : data
      ? [{ code: data.languageCode, name: data.language, generated: data.isGenerated }]
      : [];

  return (
    <>
      <header className="topbar">
        <h1 className="brand">French Transcription</h1>
        <form className="load-form" onSubmit={handleSubmit} autoComplete="off">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Paste a YouTube URL or video ID"
            spellCheck={false}
            aria-label="YouTube URL or video ID"
          />
          <button type="submit">Load</button>
        </form>
      </header>

      <main className="layout">
        <section className="player-pane">
          <YouTubePlayer
            videoId={videoId}
            onReady={handlePlayerReady}
            onStateChange={handleStateChange}
            onError={(message) => setPlayerMessage({ text: message, error: true })}
          />
          <p className={"status" + (playerMessage?.error ? " error" : "")}>{playerMessage?.text ?? ""}</p>
        </section>

        <aside className="transcript-pane">
          <div className="transcript-toolbar">
            <div className="track-info">
              <label htmlFor="lang-select">Transcript</label>
              <select
                id="lang-select"
                value={data?.languageCode ?? ""}
                disabled={tracks.length <= 1}
                onChange={(e) => setLang(e.target.value)}
              >
                {tracks.length === 0 && <option value="">{transcript.status === "loading" ? "Loading…" : "—"}</option>}
                {tracks.map((t) => (
                  <option key={t.code} value={t.code}>
                    {t.name}
                    {t.generated ? " (auto)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <label className="toggle">
              <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
              Auto-scroll
            </label>
          </div>

          {transcript.status === "loading" && <p className="placeholder">Loading transcript…</p>}
          {transcript.status === "error" && (
            <p className="placeholder error">Could not load a transcript for this video.{"\n"}{transcript.message}</p>
          )}
          {data && data.cues.length === 0 && <p className="placeholder">This transcript is empty.</p>}
          {data && data.cues.length > 0 && (
            <TranscriptPanel cues={data.cues} activeIndex={activeIndex} autoScroll={autoScroll} onSeek={handleSeek} />
          )}
        </aside>
      </main>
    </>
  );
}
