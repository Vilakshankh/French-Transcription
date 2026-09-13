"use client";

import { useCallback, useEffect, useState } from "react";

export interface TranscriptSettings {
  /** Reveal text as it is spoken instead of showing the whole transcript. */
  stream: boolean;
  /** Keep the line being spoken in view. */
  autoScroll: boolean;
  /** Show an English translation when hovering a word. */
  hoverTranslate: boolean;
  /** Transcript text size. */
  textSize: TextSize;
}

export type TextSize = "sm" | "md" | "lg";

export const TEXT_SIZES: { value: TextSize; label: string }[] = [
  { value: "sm", label: "Small" },
  { value: "md", label: "Medium" },
  { value: "lg", label: "Large" },
];

/** Tailwind classes for each transcript text size. */
export const TEXT_SIZE_CLASSES: Record<TextSize, string> = {
  sm: "text-sm leading-7",
  md: "text-base leading-8",
  lg: "text-lg leading-9",
};

export const DEFAULT_SETTINGS: TranscriptSettings = { stream: true, autoScroll: true, hoverTranslate: true, textSize: "sm" };

const STORAGE_KEY = "french-transcription:settings";

/** Transcript settings persisted in localStorage. */
export function useSettings() {
  const [settings, setSettings] = useState<TranscriptSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setSettings({ ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<TranscriptSettings>) });
    } catch {
      /* ignore bad or unavailable storage */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* ignore */
    }
  }, [settings, loaded]);

  const update = useCallback(<K extends keyof TranscriptSettings>(key: K, value: TranscriptSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  }, []);

  return { settings, update };
}
