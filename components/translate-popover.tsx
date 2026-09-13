"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

export interface TranslateTarget {
  text: string;
  context?: string;
  /** Viewport-relative rectangle of the hovered word or selection. */
  rect: DOMRect;
}

interface Result {
  translation?: string;
  note?: string;
  error?: string;
}

const clientCache = new Map<string, Promise<Result>>();

function lookup(text: string, context?: string): Promise<Result> {
  const key = `${text.toLowerCase()}|${context ?? ""}`;
  const cached = clientCache.get(key);
  if (cached) return cached;
  const params = new URLSearchParams({ q: text });
  if (context) params.set("context", context);
  const promise = fetch(`/api/translate?${params}`)
    .then(async (res) => {
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return { error: body.error ?? `Request failed (${res.status})` } as Result;
      return { translation: body.translation as string, note: body.note as string | undefined };
    })
    .catch((err: Error) => ({ error: err.message }) as Result);
  clientCache.set(key, promise);
  promise.then((r) => {
    if (r.error) clientCache.delete(key); // let the user retry after a failure
  });
  return promise;
}

const GAP = 8;

/** Small tooltip that shows the English meaning of a French word or phrase. */
export function TranslatePopover({ target }: { target: TranslateTarget | null }) {
  const [result, setResult] = useState<Result | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number; below: boolean } | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!target) {
      setResult(null);
      setPos(null);
      return;
    }
    let cancelled = false;
    setResult(null);
    lookup(target.text, target.context).then((r) => {
      if (!cancelled) setResult(r);
    });
    return () => {
      cancelled = true;
    };
  }, [target]);

  // Position after render so we know the tooltip's own size.
  useEffect(() => {
    const el = ref.current;
    if (!target || !el) return;
    const { rect } = target;
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    const below = rect.top - height - GAP < 4;
    const top = below ? rect.bottom + GAP : rect.top - height - GAP;
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8);
    setPos({ top, left, below });
  }, [target, result]);

  if (!target) return null;

  return (
    <div
      ref={ref}
      role="tooltip"
      data-slot="translate-popover"
      className={cn(
        "pointer-events-none fixed z-50 max-w-72 rounded-md bg-foreground px-3 py-1.5 text-xs text-background shadow-md",
        "animate-in fade-in-0 zoom-in-95 duration-100",
        pos ? "visible" : "invisible",
      )}
      style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0 }}
    >
      <div className="truncate font-medium text-background/70">{target.text}</div>
      {!result && <div className="text-background/80">Translating…</div>}
      {result?.error && <div className="text-destructive-foreground/90">{result.error}</div>}
      {result?.translation && (
        <>
          <div className="font-medium">{result.translation}</div>
          {result.note && <div className="text-background/70">{result.note}</div>}
        </>
      )}
    </div>
  );
}
