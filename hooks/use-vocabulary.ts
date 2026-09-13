"use client";

import { useCallback, useEffect, useState } from "react";

import { loadVocabulary, normalizeFrench, saveVocabulary, type VocabEntry } from "@/lib/vocabulary";

/** Vocabulary list persisted in localStorage. */
export function useVocabulary() {
  const [entries, setEntries] = useState<VocabEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setEntries(loadVocabulary());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (loaded) saveVocabulary(entries);
  }, [entries, loaded]);

  const has = useCallback(
    (french: string) => {
      const key = normalizeFrench(french);
      return entries.some((e) => normalizeFrench(e.french) === key);
    },
    [entries],
  );

  const add = useCallback((entry: Omit<VocabEntry, "id" | "addedAt">) => {
    setEntries((prev) => {
      const key = normalizeFrench(entry.french);
      if (prev.some((e) => normalizeFrench(e.french) === key)) return prev;
      const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now());
      return [{ ...entry, id, addedAt: Date.now() }, ...prev];
    });
  }, []);

  const remove = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const clear = useCallback(() => setEntries([]), []);

  return { entries, loaded, has, add, remove, clear };
}
