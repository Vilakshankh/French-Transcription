"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import TranscriptPanel from "@/components/TranscriptPanel";
import YouTubePlayer, { PlayerState, type YTPlayer } from "@/components/YouTubePlayer";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { parseVideoId, type TranscriptData } from "@/lib/youtube";

const POLL_MS = 100;

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
  const [currentTime, setCurrentTime] = useState(0);
  const [stream, setStream] = useState(true);
  const [autoScroll, setAutoScroll] = useState(true);
  const [playerMessage, setPlayerMessage] = useState<{ text: string; error: boolean } | null>(null);

  const playerRef = useRef<YTPlayer | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ----- transcript loading -----
  useEffect(() => {
    const controller = new AbortController();
    setTranscript({ status: "loading" });

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
    if (!player) return;
    const t = player.getCurrentTime();
    setCurrentTime((prev) => (Math.abs(prev - t) < 0.01 ? prev : t));
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
        syncNow(); // keep the position accurate after a pause or seek
        if (state !== PlayerState.BUFFERING) stopPolling();
      }
    },
    [startPolling, stopPolling, syncNow],
  );

  const handleSeek = useCallback((seconds: number) => {
    const player = playerRef.current;
    if (!player) return;
    player.seekTo(seconds, true);
    player.playVideo();
    setCurrentTime(seconds);
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
      setCurrentTime(0);
      setInputValue(`https://www.youtube.com/watch?v=${id}`);
    }
  };

  const data = transcript.status === "ready" ? transcript.data : null;
  const tracks = data?.available?.length
    ? data.available
    : data
      ? [{ code: data.languageCode, name: data.language, generated: data.isGenerated }]
      : [];
  const trackItems = tracks.map((t) => ({ value: t.code, label: t.generated ? `${t.name} (auto)` : t.name }));

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <h1 className="font-heading text-base font-semibold tracking-tight whitespace-nowrap">French Transcription</h1>
          <form className="flex min-w-60 flex-1 gap-2 sm:max-w-xl" onSubmit={handleSubmit} autoComplete="off">
            <Input
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Paste a YouTube URL or video ID"
              spellCheck={false}
              aria-label="YouTube URL or video ID"
            />
            <Button type="submit">Load</Button>
          </form>
          <div className="ml-auto">
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl flex-1 gap-4 p-4 lg:grid-cols-[minmax(0,2fr)_minmax(340px,1fr)]">
        <section className="flex min-w-0 flex-col gap-2">
          <YouTubePlayer
            videoId={videoId}
            onReady={handlePlayerReady}
            onStateChange={handleStateChange}
            onError={(message) => setPlayerMessage({ text: message, error: true })}
          />
          <p
            className={playerMessage?.error ? "min-h-5 text-sm text-destructive" : "min-h-5 text-sm text-muted-foreground"}
            role={playerMessage?.error ? "alert" : undefined}
          >
            {playerMessage?.text ?? ""}
          </p>
        </section>

        <Card className="flex max-h-[70svh] min-h-80 flex-col gap-0 py-0 lg:max-h-[calc(100svh-7rem)]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="font-heading text-sm font-medium">Transcript</span>
              {data?.isGenerated && <Badge variant="secondary">auto-generated</Badge>}
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-2">
              <Select
                value={data?.languageCode ?? null}
                onValueChange={(value) => value && setLang(value)}
                items={trackItems}
                disabled={tracks.length <= 1}
              >
                <SelectTrigger size="sm" className="min-w-36" aria-label="Transcript language">
                  <SelectValue placeholder={transcript.status === "loading" ? "Loading…" : "Language"} />
                </SelectTrigger>
                <SelectContent>
                  {trackItems.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label className="gap-2">
                <Switch size="sm" checked={stream} onCheckedChange={setStream} aria-label="Stream text as it is spoken" />
                Stream
              </Label>
              <Label className="gap-2">
                <Switch size="sm" checked={autoScroll} onCheckedChange={setAutoScroll} aria-label="Auto-scroll" />
                Auto-scroll
              </Label>
            </div>
          </div>
          <Separator />

          <div className="min-h-0 flex-1">
            {transcript.status === "loading" && <p className="px-4 py-3 text-sm text-muted-foreground">Loading transcript…</p>}
            {transcript.status === "error" && (
              <div className="px-4 py-3 text-sm">
                <p className="font-medium text-destructive">Could not load a transcript for this video.</p>
                <p className="mt-1 text-muted-foreground">{transcript.message}</p>
              </div>
            )}
            {data && data.cues.length === 0 && <p className="px-4 py-3 text-sm text-muted-foreground">This transcript is empty.</p>}
            {data && data.cues.length > 0 && (
              <TranscriptPanel
                cues={data.cues}
                currentTime={currentTime}
                stream={stream}
                autoScroll={autoScroll}
                onSeek={handleSeek}
              />
            )}
          </div>
        </Card>
      </main>
    </div>
  );
}
