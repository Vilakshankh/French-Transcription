"use client";

import { play, type SoundName } from "cuelume";

/** Plays a UI sound; safe to call anywhere (no-op on the server or when audio is blocked). */
export function playSound(name: SoundName, volume = 0.6): void {
  try {
    play(name, { volume });
  } catch {
    /* never let audio break the UI */
  }
}
